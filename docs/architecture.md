# Target Architecture (Staged Migration)

## Goals

- Keep production app runnable during refactor.
- Isolate concerns (routing, data access, auth, UI modules).
- Make template and script syntax failures detectable pre-merge.

## Structure

- `server/`: Apps Script controllers/services (new code path, gated).
- `client/`: browser-side modules extracted from large inline script blocks.
- `templates/`: HTML partials/includes for tab composition.
- `shared/`: schemas, contract validators, common transforms.
- `scripts/`: validation/build/deploy helpers.
- `tests/`: smoke tests and contract checks.

## Routing conventions

- Keep existing `doGet` / `doPost` and `handleWebClientRequest` stable as compatibility API.
- Route all actions through a single dispatcher contract (`action`, `payload`, metadata).
- Introduce new handler registry behind migration feature flag before removing legacy switch logic.

## Contract conventions

- Validate requests at route boundaries.
- Use explicit success/error envelope:
  - `{ success: true, data, meta? }`
  - `{ success: false, error, code?, correlationId? }`
- Never expose stack traces to clients in production responses.

## Data layer conventions

- Centralize sheet reads/writes behind one service module with:
  - lock handling
  - cache/index consistency
  - deterministic errors
- Add helper adapters so legacy functions can call new service without full rewrite.

## Frontend conventions

- Keep tab wiring event delegation as a compatibility layer.
- Move tab-specific behavior to per-feature modules gradually.
- Prefer `textContent` and explicit escaping helpers over raw `innerHTML` for dynamic user content.

## Rollout strategy

1. Land quality gates and syntax validators.
2. Fix hard parser/runtime blockers.
3. Migrate feature slices with smoke checks.
4. Remove dead legacy code only after parity checks pass.
