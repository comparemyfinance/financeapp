# Canonical Files (Runtime Truth)

Use this map to avoid editing the wrong file.

## Backend canonical ownership

- **Entrypoints only:** `Code.gs`
  - `doGet`, `doPost`, `handleWebClientRequest`
- **Action routing and ownership:** `server/router/actions.gs`
  - `routeAction_`
  - `PUBLIC_ACTION_HANDLERS_`, `PROTECTED_ACTION_HANDLERS_`
- **Config access and required config resolution:** `server/shared/config.gs`
- **Error/response envelope helpers:** `server/shared/response.gs`
- **Auth/session backend:** `Auth.js`
- **Lender domain behavior + outbound lender/provider integrations:** `Lenderapi.gs`

## Frontend canonical ownership (current)

- **Primary shell + canonical API wrapper/session bootstrap:** `Index.html`
- **Feature-local UI behavior:** `tab*.html`
- **Transitional/delegated duplicate runtime logic exists in `tabSalesPipeline.html`**. Treat `Index.html` as canonical when behavior diverges unless runtime wiring explicitly routes through tab-owned logic.

### Operating habit update (frontend)

- Session/bootstrap source of truth is `Index.html`.
- Shared `apiCall` source of truth is `Index.html`.
- Tab-local wrappers are compatibility paths unless explicitly requested.

## Edit-here guidance

- Add/modify backend actions -> `server/router/actions.gs`
- Change config resolution behavior -> `server/shared/config.gs`
- Change error envelope behavior -> `server/shared/response.gs`
- Change Apps Script entry transport behavior -> `Code.gs`
- Change outbound lender/provider behavior (`validateJigsaw`, `submitJigsaw`, placeholder lender adapters) -> `Lenderapi.gs`
- Change shared frontend auth/API wrapper behavior -> `Index.html`

## Transitional areas

See `docs/KNOWN_AMBIGUITIES.md` for active duplicate/ambiguous surfaces and safe-edit guidance.

## Frontend runtime quick map

- For cold-session Product Source/lender-modal edit targeting, use `docs/LIVE_FRONTEND_RUNTIME_MAP.md`.
