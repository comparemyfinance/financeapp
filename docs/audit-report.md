# Audit Report (Architecture, Data Flow, Risk Backlog)

Date: 2026-03-03
Scope: repository-level static audit; no runtime behavior changes.

## 1) Architecture Map

### Components

- **Backend/API (Apps Script):** `Code.gs` routes actions from `doPost` and `handleWebClientRequest` through `routeAction_`, then reads/writes Google Sheets and calls external APIs.
- **Auth module:** `Auth.js` implements plaintext user/password validation and cache-backed tokens.
- **Frontend UI:** `Index.html` calls backend via `google.script.run.handleWebClientRequest(...)`, stores auth token in browser storage, renders CRM UI.
- **Config/Deployment:** `appsscript.json` defines runtime/webapp exposure; GitHub Actions deploy with `clasp`.

### Data Stores

- Google Sheet as system of record for deals and logs.
- Apps Script CacheService for row index cache and auth/session tokens.
- Script Properties for third-party environment credentials/secrets.
- Browser `localStorage` for frontend token/session state.

## 2) Data Flows

### Flow A — UI bootstrap and session gate

1. `doGet` serves `Index.html` for non-API requests.
2. Frontend checks `localStorage` token (`CMF_AUTH_TOKEN`) and calls `authStatus`.
3. If valid, UI initializes; otherwise login modal remains.

### Flow B — Auth

1. Frontend submits username/password via `authLogin`.
2. `auth_login_plain_` validates against `AUTH_USERS` and writes UUID token to CacheService with TTL.
3. Frontend stores token in `localStorage` and attaches it to subsequent calls.

### Flow C — CRUD/CRM operations

1. Frontend calls action via `google.script.run`.
2. `handleWebClientRequest` -> `routeAction_`.
3. `routeAction_` gates non-auth actions via `auth_check_token_`.
4. For write operations, `withLock_` wraps Sheet mutations.

### Flow D — Jigsaw integrations/webhooks

1. API actions call `UrlFetchApp.fetch` with bearer token from `getJigsawToken_`.
2. Webhook requests are validated with HMAC secret and then update Sheet/log rows.

## 3) Hot Paths

1. **Full-sheet reads on load/delta**: `getRowsData_`/`loadIndex_` read all rows and convert to objects for `getDelta`/`getAll`, making latency scale with sheet size.
2. **Per-row sheet reads/writes in batch update**: `batchUpdate_` performs row-by-row `getRange(...).getValues()` and `setValues()`, increasing Apps Script quota/latency pressure.
3. **Token retrieval + external HTTP retries** in `jigsawFetch_` on 401/403 are central to every lender/Jigsaw network call.

## 4) Error Handling Gaps / Unsafe Patterns

- Several broad `catch` blocks swallow errors silently (e.g., cache and lookup checks), reducing observability and complicating incident triage.
- `routeAction_` returns `details` and `stack` to clients on exceptions; this can leak implementation details.
- Auth users and one Jigsaw password are committed in plaintext source.
- Frontend stores auth token in `localStorage`, increasing token theft risk under XSS.
- Dynamic `innerHTML` is used with interpolated error/message values in multiple places.
- Web app deployment is configured as `ANYONE_ANONYMOUS`, increasing exposed attack surface.

## 5) Dependencies and Versions

### Runtime/Platform

- Google Apps Script runtime: `V8`.
- Enabled advanced service: Drive API `v3`.

### CI/CD Actions & Tooling

- `actions/checkout@v4`
- `actions/setup-node@v4` (Node `20`)
- Global npm tool in deploy workflow: `@google/clasp` (unpinned latest)

## 6) Ranked Backlog (Exact References)

## P0 (Immediate)

1. **Remove hardcoded credentials from source and rotate now.**
   - `Auth.js` plaintext users/passwords.
   - `Code.gs` hardcoded `JIGSAW_PASSWORD` default in setup helper.
2. **Stop returning stack traces to client responses.**
   - `routeAction_` currently includes `details` and `stack` in API error payload.
3. **Restrict deployment exposure from anonymous where possible.**
   - Webapp manifest currently allows anonymous access.

## P1 (Near-term)

1. **Migrate token storage from `localStorage` to safer session model** (short-lived token + server revocation/introspection; ideally HttpOnly cookie where architecture permits).
2. **Reduce XSS surface from `innerHTML` for dynamic messages** (switch to `textContent`/escaping helpers).
3. **Implement login throttling/lockout and audit trails** to reduce brute-force risk.
4. **Pin deploy tool version (`@google/clasp`)** for reproducibility and supply-chain stability.

## P2 (Planned hardening/perf)

1. **Optimize full-sheet read hot paths** by incremental deltas/indexed retrieval and caching with invalidation strategy.
2. **Consolidate row-wise updates to batched range operations** where practical.
3. **Replace silent catches with structured logging/metrics** to improve mean time to detect/recover.

## 7) Evidence (file:line)

- UI/API entry and router: `Code.gs` doGet/bridge/router and auth gate. (Code.gs:328-347, 356-363, 380-407)
- HTTP POST parse/routing: `Code.gs` doPost. (Code.gs:540-559)
- Full read/index hot path: `Code.gs` loadIndex*/getRowsData*. (Code.gs:266-276, 301-304)
- Batch row-by-row operations: `Code.gs` batchUpdate\_. (Code.gs:670-714)
- Error payload includes stack: `Code.gs` routeAction\_ catch block. (Code.gs:514-520)
- Hardcoded Jigsaw password helper: `Code.gs` setup properties. (Code.gs:911-919)
- Plaintext auth users/passwords: `Auth.js`. (Auth.js:1-11, 18-27)
- Frontend token in localStorage: `Index.html` auth bootstrap/login/logout. (Index.html:8900-8914, 8949-8953)
- Dynamic error HTML interpolation: `Index.html`. (Index.html:7988)
- Anonymous webapp exposure: `appsscript.json`. (appsscript.json:14-16)
- Workflow action/tool versions: `.github/workflows/deploy.yml` and `.github/workflows/ci.yml`. (deploy.yml:14-20, ci.yml:11)
