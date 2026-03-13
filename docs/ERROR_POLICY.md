# Error Policy (Current Runtime)

## Canonical error envelope (current)

```json
{
  "success": false,
  "ok": false,
  "error": {
    "code": "STRING_CODE",
    "message": "Safe human-readable message"
  }
}
```

## Canonical success convention (current)

Most handlers return:

```json
{ "success": true, "...": "..." }
```

Some include additional fields as needed by domain flows.

## Current implementation owner

- Error construction helper: `server/shared/response.gs` (`makeError_`)
- Safe wrapper behavior: `server/shared/response.gs` (`safeObj_`)
- Route-level fallback behavior: `server/router/actions.gs` (`routeAction_` catch)

## Policy requirements

- No stack traces in client responses.
- No secrets in client responses.
- Preserve specific safe backend messages when known (for example missing config messages).
- Keep machine-readable error codes in `error.code`.

## Common codes in use

- `AUTH_REQUIRED`
- `VALIDATION_ERROR`
- `CONFIG_ERROR`
- `UNKNOWN_ACTION`
- `INTERNAL_ERROR`
- `RATE_LIMITED`
- `FORBIDDEN`

## Server-side diagnostics

- Detailed stack/context may be logged server-side only.
- Client should receive safe messages only.

## Change rule

Any change to error shape/codes/messages must update:

- `docs/API_ACTIONS.md`
- this file
- relevant contract tests under `tests/contracts/`
