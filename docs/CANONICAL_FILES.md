# Canonical Files (Contract Freeze - Phase 3A)

This document defines where changes must be made when multiple implementations or mirrored logic exist.

## Backend canonical entrypoint

- **Canonical backend entrypoint:** `Code.gs`
  - `doGet`
  - `doPost`
  - `handleWebClientRequest`
  - `routeAction_`

If you are changing API action handling, routing, auth gating behavior, or server-side integration flow control, edit `Code.gs` first.

## Primary UI shell

- **Canonical primary UI shell:** `Index.html`

`Index.html` is the template served by `HtmlService.createTemplateFromFile('Index')` and is the root runtime shell.

## Transitional / mirrored files

- `tab*.html` files are feature partials and include significant client-side behavior.
- Some UI/domain text and interaction logic may be mirrored between `Index.html` and specific `tab*.html` files.
- Historical docs mention mirrored content specifically for Demands & Needs related content.

## Canonical choice when duplicate logic exists

When duplicate or near-duplicate client logic exists, use this rule set:

1. **Server contracts:** canonical in `Code.gs`.
2. **Global shell/auth bootstrapping:** canonical in `Index.html`.
3. **Feature-local interaction logic:** canonical in the owning `tab*.html`.
4. **If duplicate logic appears in both `Index.html` and `tab*.html`:**
   - Treat the implementation currently exercised by runtime tab wiring as canonical.
   - Remove or clearly mark stale duplicate code in follow-up cleanup PR.
   - Update this file if the canonical location changes.

## Edit here, not there

### API actions and payload/response behavior

- Edit here: `Code.gs` (+ `docs/API_ACTIONS.md`, `docs/ERROR_POLICY.md` if changed)
- Not there: tab-local ad-hoc backend contract assumptions without docs update

### Auth/session rules

- Edit here: `Auth.js` and shared auth call sites in `Index.html`
- Not there: fragmented per-tab auth divergence unless intentionally scoped and documented

### Lender quote math

- Edit here: `Lenderapi.gs`
- Not there: duplicate formula rewrites scattered across templates without reconciliation plan

### Architecture/domain guidance

- Edit here: `docs/architecture.md`, `docs/domain-model.md`, `docs/change-playbook.md`
- Not there: comments-only guidance that becomes undiscoverable

## Duplication handling policy

If you discover duplicate behavior:

- Do not perform broad rewrites in the same PR as unrelated changes.
- Add explicit comments/TODO markers only when necessary and actionable.
- Prefer incremental consolidation with compatibility checks.

## Required update policy

Any PR that changes canonical location of behavior MUST update:

- this file (`docs/CANONICAL_FILES.md`)
- `docs/architecture.md`
- any impacted section in `AGENTS.md`
