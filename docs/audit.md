# Refactor Audit and Plan

Date: 2026-03-05

## Phase 0 Inventory

### Entrypoints

- Apps Script server entrypoints: `doGet`, `doPost`, and internal bridge `handleWebClientRequest` in `Code.gs`.
- HTML shell/template: `index.html` with include-based tabs loaded via `<?!= include(...) ?>`.
- Feature tabs/templates: `tabProductSource.html`, `tabSalesPipeline.html`, `tabTwilio.html`, `tabComparisonCalc.html`, `tabDocumentUpload.html`, `tabClientFiles.html`, `tabWhatsApp.html`.
- Server-side modules: `Code.gs`, `Auth.js`, `Lenderapi.gs`.
- Tooling and CI: `package.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.

### Key features/modules

- CRM and deal persistence lifecycle (sheet-backed CRUD) in `Code.gs`.
- Auth/session token issuing and checks in `Auth.js` + `Code.gs` auth routes.
- Data access and locking wrappers in `Code.gs` (`withLock_`, `getRowsData_`, `saveDeal_`, `batchUpdate_`).
- UI composition and tab interactions in `index.html` and tab templates.
- Integrations: Jigsaw/UrlFetch API calls in `Code.gs` and lender flows in `Lenderapi.gs`.

### Deployment paths

- GitHub Action on `main` pushes with `clasp` and deploys Apps Script (`.github/workflows/deploy.yml`).
- Repo includes helper script `scripts/codex_push.sh`.

## Current Breakpoints

### Syntax blockers

- **Fixed:** `index.html` contained a dangling `})();` in the main script block causing parser failure (`Unexpected token '}'`).
- Added deterministic syntax validator (`scripts/validate-syntax.mjs`) to parse:
  - `.gs` and `.js` files directly
  - embedded `<script>` blocks in `.html` / `.script.html`

### Top runtime console errors/risk hotspots (prioritized)

1. `Unexpected token '}'` in `index.html` main script block (fixed).
2. Missing `google.script.run` in non-Apps-Script hosting path (`tabSalesPipeline.html`).
3. Null access risks in delegated click handlers when modal/tabs are absent (`index.html`).
4. Potential auth/session drift from localStorage token stale state (`index.html`).
5. API stack/details leakage in error responses (`Code.gs` route catch path).
6. Dynamic `innerHTML` rendering of error text (`index.html`) may surface XSS bugs.
7. Silent catches suppressing diagnostics and making failures appear as no-op (`Code.gs`, `index.html`).
8. External API timeout/retry ambiguity around Jigsaw fetch path (`Code.gs`).
9. Sheet row mismatch/update conflict path can throw generic errors without UX mapping (`Code.gs`).
10. Any tab file without `<script>` blocks bypasses embedded parse validation (validator logs warnings).

## Prioritized Refactor Plan

1. **Safety gates first (done):** CI verify-only formatting + syntax validation.
2. **Architecture staging:** introduce `server/`, `client/`, `templates/`, `shared/` with migration flag and compatibility adapters.
3. **Vertical slice migration order:** Data layer → Auth/session → Router/controller → UI composition.
4. **Hardening pass:** remove unsafe interpolation patterns, centralize escaping helpers.
5. **Frontend hygiene:** shrink inline script surface and preserve apps-script compatibility.
