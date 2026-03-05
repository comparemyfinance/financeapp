# Runtime Review: Efficiency, Stability, Security (Step C follow-up)

Date: 2026-03-03
Scope: Apps Script runtime (`.gs`), frontend JS/HTML/CSS.

## Syntax and parse checks run

- `npx prettier --check Auth.js Code.gs Lenderapi.gs index.html`
- `node --check Auth.js`
- `cp Code.gs /tmp/Code.gs.js && node --check /tmp/Code.gs.js`
- `cp Lenderapi.gs /tmp/Lenderapi.gs.js && node --check /tmp/Lenderapi.gs.js`

Result: no syntax/parsing errors detected in checked files.

---

## Prioritized issues (with exact locations)

### P0 — Security / data exposure

1. **Hardcoded Jigsaw credential in setup helper**
   - `Code.gs` includes a plaintext `JIGSAW_PASSWORD` value in `setupJigsawUatProperties_`.
   - Location: `Code.gs:1080-1085`.
   - Risk: secret leakage and accidental reuse in production-like environments.

2. **Sensitive payload logging to sheet**
   - `appendJigsawLog_` persists full `request`/`response` JSON blobs.
   - Locations: `Code.gs:1154-1169`, and callers such as `Code.gs:1345-1353`, `1416-1423`, `1696-1702`, `1800-1806`.
   - Risk: PII/secret retention in logs and broader sheet-level exposure.

3. **Stack traces still returned through `safeObj_`**
   - `safeObj_` response still includes `stack` and detailed error text.
   - Location: `Code.gs:921-927`.
   - Risk: internal implementation detail leakage to clients.

### P1 — Stability / runtime correctness

4. **Read endpoint wrapped in global lock**
   - `doGet(...?api=1)` performs read under `withLock_(30000, ...)`.
   - Location: `Code.gs:393-398`.
   - Risk: unnecessary contention and avoidable latency during high read traffic.

5. **Action routing sanitization maps malformed action to `unknown` (generic path)**
   - Current behavior falls through to unknown action response; no explicit malformed-action telemetry.
   - Locations: `Code.gs:401-407`, `430-596`.
   - Risk: reduced observability during client misuse/injection probing.

### P2 — Efficiency / scalability

6. **`getDelta/getAll` still does full-sheet materialization**
   - `getRowsData_` calls `loadIndex_`, which reads all rows/columns and maps every row to objects.
   - Locations: `Code.gs:309-327`, `350-353`, route usage at `Code.gs:578-579`.
   - Risk: latency and quota growth with sheet size.

7. **Log sheet writes are append-per-event with no batching/sampling**
   - `appendJigsawLog_` always `appendRow` for each event.
   - Location: `Code.gs:1154-1171`.
   - Risk: elevated write volume and log-sheet bloat under webhook bursts.

---

## Proposed small PRs (one concern per PR)

### PR-S1: Secret handling + logging hygiene (security)

**Scope (small/non-breaking):**

- Remove hardcoded `JIGSAW_PASSWORD` default from setup helper; require explicit Script Properties injection.
- Add lightweight redaction utility for known sensitive keys before log persistence (e.g., `password`, `token`, `authorization`, `secret`).
- Keep current log schema; only sanitize values.

**Files:**

- `Code.gs`

**Verification:**

- `npx prettier --check Code.gs`
- `cp Code.gs /tmp/Code.gs.js && node --check /tmp/Code.gs.js`
- Manual GAS smoke: run `setupJigsawUatProperties_` in editor and confirm no plaintext password write.

### PR-S2: Error boundary tightening (security/stability)

**Scope (small/non-breaking):**

- In `safeObj_`, stop returning `stack`/raw `details`; return generic error code/message.
- Keep server-side `console.error` logging for diagnostics.

**Files:**

- `Code.gs`

**Verification:**

- `npx prettier --check Code.gs`
- `cp Code.gs /tmp/Code.gs.js && node --check /tmp/Code.gs.js`
- Manual call: force a thrown error in a wrapped handler and verify client payload excludes stack.

### PR-T1: Read-path lock removal (efficiency/stability)

**Scope (small/non-breaking):**

- Remove lock wrapping from read-only `doGet(...?api=1)` path.
- Keep lock usage for write endpoints unchanged.

**Files:**

- `Code.gs`

**Verification:**

- `npx prettier --check Code.gs`
- `cp Code.gs /tmp/Code.gs.js && node --check /tmp/Code.gs.js`
- Manual concurrent read smoke (multiple browser refreshes) and confirm unchanged response shape.

### PR-T2: Delta optimization guardrail (efficiency)

**Scope (small/non-breaking):**

- Add optional fast path for delta polling: when `since` is present and parseable, read only needed columns/rows for updated candidates before full object materialization fallback.
- Preserve current API response schema.

**Files:**

- `Code.gs`

**Verification:**

- `npx prettier --check Code.gs`
- `cp Code.gs /tmp/Code.gs.js && node --check /tmp/Code.gs.js`
- Manual compare: old/new `getDelta` response fields for same fixture data.

---

## Notes

- No breaking changes proposed.
- No dependency upgrades required for these PRs.
- Existing CI steps (`npm run lint`, `npm test`) remain applicable as baseline checks.
