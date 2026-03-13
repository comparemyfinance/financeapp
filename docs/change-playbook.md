# Change Playbook

How to safely make common changes in this repository without changing behavior unintentionally.

## Before you change anything

1. Read `AGENTS.md` and `docs/architecture.md`.
2. Identify whether change is:
   - contract-affecting (API/action/response)
   - behavior-preserving refactor
   - docs-only/tooling-only
3. Prefer smallest viable change set.

## Baseline checks

Run before and after code changes:

```bash
npm run sanity
npm run lint
npm test
```

## Common change recipes

### 1) Add or modify a backend action

Files: usually `Code.gs` (+ docs if contract changes)

- Add explicit action branch in router.
- Validate payload shape defensively.
- Keep response envelope consistent.
- For writes, use existing locking patterns.
- Update docs (`README.md`/`docs/architecture.md`/API notes) if externally visible.

### 2) Change auth/session behavior

Files: `Auth.js`, token-calling sites in `Index.html` / tabs

- Keep backward compatibility for existing token consumers where possible.
- Ensure login/status/logout flow still works end-to-end.
- Avoid introducing plaintext secrets or new unsafe storage practices.

### 3) Update lender/quote logic

Files: `Lenderapi.gs` (and matching UI assumptions)

- Preserve expected field names in quote outputs.
- Keep calculation helpers deterministic.
- Note any formula changes in docs/changelog section of PR.

### 4) Modify UI tab behavior

Files: `Index.html`, `tab*.html`

- Keep feature logic in the relevant tab where possible.
- Reuse shared helpers instead of duplicating functions.
- Escape dynamic content where possible.
- Verify affected flows manually in Apps Script web app context.

### 5) Add new sheet/Drive/integration dependency

Files: usually `Code.gs`, docs

- Centralize identifiers/config in one place.
- Prefer script properties for secrets and environment-specific values.
- Document required setup variables in README/docs.

## Refactor rules (behavior-preserving)

- No silent contract changes.
- No mixed unrelated refactors in same PR.
- Move/rename with compatibility wrappers when needed.
- If you duplicate temporarily, include follow-up cleanup note.

## PR checklist

- [ ] Change is scoped and explained.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] Docs updated for any public/contract/operational change.
- [ ] No unrelated files changed.
- [ ] No credentials/secrets added.

## When to split into multiple PRs

Split if change touches more than one of:

- API contract behavior
- auth/session model
- persistence/locking mechanics
- external integration behavior
- major UI rendering logic

## High-risk areas requiring extra caution

- `routeAction_` and write operations in `Code.gs`
- auth token issuance/validation in `Auth.js`
- large inline scripts in `Index.html` and `tabSalesPipeline.html`
- Jigsaw/webhook validation and request/response handling
