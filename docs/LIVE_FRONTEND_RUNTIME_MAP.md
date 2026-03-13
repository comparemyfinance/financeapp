# Live Frontend Runtime Map

Use this first for Product Source/front-end runtime edits.

## Canonical owners (edit here)

- Product Source renderer: `Index.html` (Product Source table/render/update path)
- Lender Apply modal runtime: `Index.html` (`ensureLenderAppModal` / `openLenderAppModal` path)
- Session/bootstrap: `Index.html` (`window.CMFSession`)
- Shared API wrapper: `Index.html` (`App.apiCall`)

## Parallel/duplicate paths still present

- `tabProductSource.html` contains parallel Product Source + lender modal logic.
- `tabSalesPipeline.html` contains transitional session/bootstrap + `apiCall` compatibility paths.

## Operational edit rules

- If changing Product Source rendering behavior:
  - Edit: `Index.html`
  - Verify parity impact in: `tabProductSource.html`
  - Run: `npm test` (Product Source contracts/smoke)

- If changing Lender Apply modal behavior:
  - Edit: `Index.html`
  - Verify parity impact in: `tabProductSource.html`
  - Run: `npm test` (lender application contracts + Product Source UI contracts)

- If changing session/bootstrap or shared API transport:
  - Edit: `Index.html`
  - Verify compatibility paths in: `tabSalesPipeline.html`
  - Run: `npm test`
