# Runtime Truth (Quick Agent Map)

Use this first in a cold session.

## Entrypoints

- `Code.gs`: `doGet`, `doPost`, `handleWebClientRequest`

## Routing

- `server/router/actions.gs`: `routeAction_`, action registries, action handler ownership

## Config

- `server/shared/config.gs`: `configGet_`, `requireConfig_`, spreadsheet/root-folder resolvers

## Auth

- `Auth.js`: token login/status/logout and auth checks

## Response helpers

- `server/shared/response.gs`: canonical `makeError_`, `safeObj_`, JSON output helpers

## Frontend runtime

- Canonical shared wrapper/session bootstrap: `Index.html`
- Feature UI + transitional duplicates: `tab*.html` (notably `tabSalesPipeline.html`)

### Operating habit update (frontend)

- Session/bootstrap source of truth: `Index.html`
- Shared `apiCall` source of truth: `Index.html`
- Tab-local wrappers are compatibility paths unless explicitly requested

## Tests

- Contracts: `tests/contracts/*`
- Smoke: `tests/smoke/*`
- GAS harness: `tests/helpers/gas-test-harness.mjs`

## Canonical docs

- Architecture: `docs/architecture.md`
- Action contracts: `docs/API_ACTIONS.md`
- Config/runtime assumptions: `docs/ENVIRONMENT.md`
- Error envelope policy: `docs/ERROR_POLICY.md`
- Canonical ownership map: `docs/CANONICAL_FILES.md`

## Transitional/ambiguous surfaces

- See `docs/KNOWN_AMBIGUITIES.md` before editing large UI/runtime-sensitive files.
