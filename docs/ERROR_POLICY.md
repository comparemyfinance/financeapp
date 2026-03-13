# Error Policy (Contract Freeze - Phase 3A)

This document defines the canonical client-safe error policy and migration target.

## Canonical client-safe error envelope (target)

```json
{
  "ok": false,
  "error": {
    "code": "STRING_CODE",
    "message": "Safe human-readable message"
  }
}
```

## Success envelope companion (recommended)

```json
{
  "ok": true,
  "data": {}
}
```

## Mandatory policy requirements

- No stack traces in client responses.
- No secret leakage (credentials, tokens, signatures, raw auth headers, internal IDs that must remain private).
- No raw exception dumps (`err.toString()`, full exception object, serialized stack frames) to client.
- Stable machine-readable error codes.
- Deep/internal details may be logged server-side only.

## Current state (compatibility reality)

Current implementation still commonly emits:

- `{ "success": false, "error": "..." }`
- In some catch paths: `details` and/or `stack` are currently present.

This is **not** the desired end state. New or refactored paths should converge toward this policy while preserving compatibility during migration.

## Stable error codes (contract set)

Use these codes for canonicalized errors:

- `AUTH_REQUIRED` – missing/invalid/expired auth token
- `VALIDATION_ERROR` – bad input shape, missing required fields
- `NOT_FOUND` – requested entity missing
- `CONFLICT` – optimistic-lock or concurrent update conflict
- `FORBIDDEN` – action blocked by policy/role/config
- `INTEGRATION_ERROR` – upstream API failure
- `RATE_LIMITED` – throttling/lock contention related refusal
- `UNKNOWN_ACTION` – unsupported action name
- `INTERNAL_ERROR` – unexpected server-side failure

## Error mapping guidance

- Keep original client-safe message concise and non-sensitive.
- Map implementation-specific errors into stable codes.
- Preserve legacy `success:false` compatibility where required, but avoid adding new `details`/`stack` fields.

Example transitional-compatible shape:

```json
{
  "success": false,
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing folderId"
  }
}
```

## Server-side logging guidance

Allowed in server logs:

- correlation IDs
- exception type
- sanitized request context
- stack traces (server-side only)

Not allowed in logs without redaction:

- plaintext credentials
- bearer tokens
- webhook shared secrets
- full PII payload dumps unless explicitly required and controlled

## Rollout rules

1. New handlers should emit canonical policy-compliant errors.
2. Existing handlers can be migrated incrementally.
3. Every migration PR must verify no client-breaking envelope regressions.
4. `docs/API_ACTIONS.md` must be updated when action-level error behavior changes.
