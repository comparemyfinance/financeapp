# Demands & Needs Letter Word/Character Baseline (2026-03-05)

## Scope compared
- **Current project letter source**: the Demands & Needs HTML template block in:
  - `Index.html`
  - `tabProductSource.html`
- **Proposed draft**: the letter text supplied by stakeholder on 5 March 2026.

## Counting method
- Removed HTML tags from the current template block and converted HTML entities to plain text.
- Removed template placeholder expressions (e.g. `${...}`) before counting.
- Word count regex: `\b[\w’'-]+\b`.
- Character counts recorded as:
  - **chars (with spaces/newlines)**
  - **chars (non-space only)**

## Results

| Version | Words | Chars (with spaces) | Chars (non-space) |
|---|---:|---:|---:|
| Current project template | 1,932 | 12,224 | 10,289 |
| Proposed 5 Mar 2026 draft | 1,609 | 10,452 | 8,743 |
| **Difference (draft - current)** | **-323** | **-1,772** | **-1,546** |

## Interpretation
- Draft saves **323 words** versus current wording.
- Draft saves **1,772 characters** (including spaces/newlines).
- Draft saves **1,546 non-space characters**.

## Notes for implementation PR
- To preserve formatting/layout/PDF generation behavior, text-only substitution should be applied in both:
  - `tabProductSource.html` (authoring/source tab)
  - `Index.html` (mirrored runtime tab)
- Keep section structure and existing variable interpolation points unchanged unless a legal text update requires structural edits.
