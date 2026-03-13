# Domain Model

## Purpose

Defines the core domain entities and terms used in the CRM + vehicle-finance workflow.

## Core entities

### Lead

Initial customer inquiry before a fully qualified deal exists.

- Typical attributes: contact details, vehicle interest, source/referrer, timestamps.
- Lifecycle: created -> contacted -> converted to deal (or archived).

### Deal

Primary operational record in the system.

- Typical attributes: `id`, customer profile, vehicle details, finance details, status/stage, audit timestamps.
- Behavior:
  - Can be created/updated/deleted.
  - Participates in pipeline and document/application generation.
  - May be linked to external references (e.g., Jigsaw introducer/reference IDs).

### Customer

Person applying for or discussing finance options.

- Typical attributes: personal details, address history, employment, banking details, consent fields.
- Usually represented as fields attached to a Deal record.

### Vehicle

Vehicle related to the deal/application.

- Typical attributes: VRN, make/model, year, mileage, VIN, color.
- Supports lookup and enrichment paths.

### Finance Scenario / Quote

Computed lending option for comparison.

- Typical attributes: lender, APR, term, monthly payment, balloon, commission, total payable.
- Sources:
  - Placeholder lender logic in `Lenderapi.gs`.
  - Potential external lender/integration data.

### Application Submission

Payload sent to external lender/integration APIs.

- Typical attributes: mapped customer/vehicle/finance data, introducer references, validation status.
- Includes validate and submit paths.

### Document / Client File

Drive-backed files associated with customer/deal context.

- Typical attributes: folder ID/name, file ID/name/url/icon, last updated, preview URL.

### Session/Auth Token

Cache-backed token for user session state.

- Lifecycle: login issues token -> token attached to action payloads -> logout invalidates token.

## Supporting concepts

### Pipeline Stage

Operational status bucket for deals (e.g., prospecting, in-progress, completed).

- Used for board/list rendering and reporting views.

### Referrer / Partner

Source partner introducing leads/deals.

- Used for reporting and partner activity summaries.

### Integration Event

Webhook or API interaction record (especially Jigsaw-related).

- May result in deal field updates and log entries.

## Key invariants

- `Deal.id` should be unique and stable once issued.
- Protected actions require valid auth token.
- Write operations should remain concurrency-safe.
- Response payloads should follow stable success/error envelopes.

## Glossary

- **VRN:** Vehicle Registration Number.
- **APR:** Annual Percentage Rate.
- **Balloon/GFV:** End-of-term residual payment.
- **Introducer Reference:** External lender/integration reference tied to a deal.
- **Delta load:** Polling pattern for updated deal records.
