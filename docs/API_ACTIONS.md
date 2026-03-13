# API Actions (Contract Freeze - Phase 3A)

This document freezes the **current** backend action surface handled by `routeAction_` in `Code.gs`.

## Canonical transport

- UI/internal calls: `google.script.run.handleWebClientRequest({ action, payload })`
- HTTP calls: `POST` JSON body parsed by `doPost`, then delegated to `routeAction_`.
- Canonical request shape:

```json
{
  "action": "string",
  "payload": {}
}
```

> Note: legacy callers sometimes send fields outside `payload` (e.g., `query`, `folderId`). Current router still tolerates this for selected actions.

## Current response conventions (as-is)

Current implementation mostly returns:

```json
{ "success": true, "...": "..." }
```

or

```json
{ "success": false, "error": "..." }
```

A formal future envelope is defined in `docs/ERROR_POLICY.md`; until migrated, this file documents current canonical behavior for compatibility.

---

## Action catalog

### `healthCheck`

- Auth: **No**
- Canonical payload:
  ```json
  {}
  ```
- Legacy aliases accepted: none
- Side effects: none
- Canonical success:
  ```json
  { "success": true, "status": "healthy" }
  ```
- Canonical error: generic router error envelope (`success:false`, `error`, optional details/stack today)

### `authLogin`

- Auth: **No**
- Canonical payload:
  ```json
  { "username": "string", "password": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: creates cache token session
- Canonical success:
  ```json
  { "success": true, "token": "uuid", "user": "username" }
  ```
- Canonical error:
  ```json
  { "success": false, "error": "Invalid username or password." }
  ```

### `authStatus`

- Auth: **No** (uses token in payload)
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: none
- Canonical success (authenticated):
  ```json
  { "success": true, "loggedIn": true, "user": "username" }
  ```
- Canonical success (not authenticated):
  ```json
  { "success": true, "loggedIn": false }
  ```

### `authLogout`

- Auth: **No** (best-effort token invalidation)
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: removes cache token if present
- Canonical success:
  ```json
  { "success": true }
  ```

### `listLenders`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: none
- Canonical success:
  ```json
  { "success": true, "lenders": [] }
  ```

### `getLenderQuote`

- Auth: **Yes**
- Canonical payload:
  ```json
  {
    "token": "string",
    "lenderKey": "string",
    "settlementFigure": 0,
    "remainingTerm": 0,
    "origLoan": 0
  }
  ```
- Legacy aliases accepted: `lender` in place of `lenderKey`
- Side effects: none
- Canonical success:
  ```json
  {
    "success": true,
    "lenderKey": "string",
    "mode": "placeholder",
    "quoteInputs": {},
    "quoteOutputs": {},
    "reasons": [],
    "raw": {}
  }
  ```
- Canonical error: `success:false` + validation message

### `getLenderQuotesBatch`

- Auth: **Yes**
- Canonical payload:
  ```json
  {
    "token": "string",
    "settlementFigure": 0,
    "remainingTerm": 0,
    "origLoan": 0
  }
  ```
- Legacy aliases accepted: none
- Side effects: none
- Canonical success:
  ```json
  {
    "success": true,
    "mode": "placeholder",
    "products": [],
    "lenders": []
  }
  ```

### `getFinanceNavigatorSoftScore`

- Auth: **Yes**
- Canonical payload: object with token + scoring inputs
- Legacy aliases accepted: implementation-dependent field normalization
- Side effects: none
- Canonical success: `{ "success": true, ... }`
- Canonical error: `{ "success": false, "error": "..." }`

### `getPartnerActivitySummary`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: read-only sheet summary
- Canonical success:
  ```json
  { "success": true, "data": [] }
  ```

### `acquireLock`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "dealId": "string", "clientId": "string" }
  ```
- Legacy aliases accepted: top-level fields via `fullRequest`
- Side effects: when enabled, writes lock heartbeat in cache
- Canonical success:
  - when disabled toggle:
    ```json
    { "success": true, "disabled": true }
    ```
  - when enabled:
    ```json
    { "success": true, "lock": { "dealId": "..." } }
    ```
- Canonical error: invalid lock action/ownership etc.

### `heartbeatLock`

- Auth: **Yes**
- Canonical payload: same family as `acquireLock`
- Legacy aliases accepted: top-level fields via `fullRequest`
- Side effects: refreshes lock heartbeat when enabled
- Canonical success: `success:true` lock heartbeat acknowledgement

### `releaseLock`

- Auth: **Yes**
- Canonical payload: same family as `acquireLock`
- Legacy aliases accepted: top-level fields via `fullRequest`
- Side effects: removes lock entry when enabled
- Canonical success: `success:true` (or disabled true)

### `searchFolders`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "query": "string" }
  ```
- Legacy aliases accepted:
  - top-level `query`
- Side effects: Drive read only
- Canonical success:
  ```json
  { "success": true, "folders": [] }
  ```

### `getFolderFiles`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "folderId": "string" }
  ```
- Temporary legacy aliases accepted:
  - payload as string (`"folderId"`)
  - `payload.folder_id`, `payload.id`, `payload.driveFolderId`
  - nested `payload.folder.id`, `payload.selectedFolder.id`, `payload.node.id`
  - top-level `folderId`/legacy variants
- Side effects: Drive read only
- Canonical success:
  ```json
  { "success": true, "folderName": "string", "files": [] }
  ```
- Canonical error:
  ```json
  { "success": false, "error": "Missing folderId" }
  ```

### `load`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: alias of `getDelta`/`getAll` read path
- Side effects: read-only sheet load
- Canonical success:
  ```json
  { "success": true, "data": [] }
  ```

### `getDelta`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "since": "ISO_DATETIME" }
  ```
- Legacy aliases accepted: behavior currently same as `load`/`getAll` full read
- Side effects: read-only sheet load
- Canonical success:
  ```json
  { "success": true, "data": [] }
  ```

### `getAll`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string" }
  ```
- Legacy aliases accepted: same branch as `load`/`getDelta`
- Side effects: read-only sheet load
- Canonical success:
  ```json
  { "success": true, "data": [] }
  ```

### `validateJigsaw`

- Auth: **Yes**
- Canonical payload: integration-specific validation payload object + token
- Legacy aliases accepted: `validateJigsawReferral`
- Side effects: external API call + logs/aux updates
- Canonical success:
  ```json
  { "success": true, ... }
  ```
- Canonical error:
  ```json
  { "success": false, "error": "..." }
  ```

### `validateJigsawReferral`

- Auth: **Yes**
- Canonical payload: same as `validateJigsaw`
- Legacy aliases accepted: alias branch
- Side effects: same as `validateJigsaw`
- Canonical success/error: same family

### `submitJigsaw`

- Auth: **Yes**
- Canonical payload: integration submit payload object + token
- Legacy aliases accepted: `submitJigsawReferral`
- Side effects: external API call + persistence/log updates
- Canonical success:
  ```json
  { "success": true, ... }
  ```
- Canonical error:
  ```json
  { "success": false, "error": "..." }
  ```

### `submitJigsawReferral`

- Auth: **Yes**
- Canonical payload: same as `submitJigsaw`
- Legacy aliases accepted: alias branch
- Side effects: same as `submitJigsaw`
- Canonical success/error: same family

### `save`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "...dealFields": "..." }
  ```
- Legacy aliases accepted: `ID`/`VRN` header variants tolerated inside deal object
- Side effects:
  - sheet row update (no insert mode)
  - row cache update
  - optional optimistic conflict rejection
- Canonical success:
  ```json
  { "success": true, "updated": true, "deal": {} }
  ```
- Canonical error: `success:false` with message (including conflict/no match)

### `delete`

- Auth: **Yes**
- Canonical payload:
  ```json
  { "token": "string", "id": "string" }
  ```
- Legacy aliases accepted: none
- Side effects: deletes row + invalidates row index cache
- Canonical success:
  ```json
  { "success": true, "deleted": 1, "id": "string" }
  ```

### `batchUpdate`

- Auth: **Yes**
- Canonical payload:
  ```json
  {
    "token": "string",
    "updates": [{ "id": "string", "...patch": "..." }]
  }
  ```
- Legacy aliases accepted: minimal; relies on update object shapes
- Side effects: multiple row updates + cache invalidation/update behavior
- Canonical success:
  ```json
  { "success": true, "updated": 0, "deals": [] }
  ```

### Unknown action behavior

- If authenticated and action is unrecognized:
  ```json
  { "success": false, "error": "Unknown action: <action>" }
  ```
- If not authenticated for protected routes:
  ```json
  { "success": false, "error": "AUTH_REQUIRED", "authRequired": true }
  ```

---

## Contract freeze notes

- **Do not remove** temporary aliases until clients are migrated and verified.
- New actions must be added to this file as part of the same PR that introduces them.
- Error-envelope migration plan is governed by `docs/ERROR_POLICY.md`.
