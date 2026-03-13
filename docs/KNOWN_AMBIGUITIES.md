# Known Ambiguities (Current State)

This file tracks remaining areas that can mislead cold AI agents.

## 1) Duplicate frontend API wrapper surfaces

- Why it matters: API transport/error behavior exists in both `Index.html` and `tabSalesPipeline.html`, so edits can diverge.
- Canonical today: `Index.html` shared API wrapper.
- Safe to edit: **Yes**, but keep behavior aligned if touching tab-level duplicate path.
- Cleanup status: planned later; not addressed in runtime recovery patches.

## 2) Duplicate/overlapping CMFSession bootstrap surfaces

- Why it matters: session token lifecycle logic appears in more than one frontend location.
- Canonical today: `Index.html` `window.CMFSession` bootstrap.
- Safe to edit: **Somewhat safe**; verify tab-level behavior after changes.
- Cleanup status: planned later.

## 3) Very large mixed files

- Why it matters: hidden coupling and difficult local reasoning increase regression risk.
- Files:
  - `Index.html`
  - `tabSalesPipeline.html`
  - `Code.gs`
- Canonical today:
  - Shared shell/runtime wrapper -> `Index.html`
  - Router ownership -> `server/router/actions.gs`
  - Entrypoints/domain helpers still in `Code.gs`
- Safe to edit: **Somewhat safe** for small scoped changes only.
- Cleanup status: incremental only; no broad split currently in-flight.

## 4) Transitional diagnostics present in runtime router

- Why it matters: diagnostic helpers/actions are useful but can be mistaken for permanent public contract.
- Current surfaces:
  - `runtimeDiagnostics` action
  - action failure diagnostic logging helpers
- Canonical today: `server/router/actions.gs` + helper usage from `Code.gs`.
- Safe to edit: **Yes**, but keep client-safe response rules (no secrets/stacks).
- Cleanup status: optional future hardening/removal once runtime stability is fully verified.
