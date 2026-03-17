# Environment & Runtime Assumptions (Runtime Truth)

## Runtime platform

- Google Apps Script V8 (`appsscript.json`)
- Web App deployment
- Advanced Drive API v3 enabled

## Config ownership

Canonical config helpers live in `server/shared/config.gs`.

Key helpers:

- `configGet_(key, fallback)`
- `requireConfig_(keys)`
- `getSpreadsheetConfigId_()`
- `getRootFolderId_()`
- `getConfigResolutionMeta_(key)`

## Config resolution order (current)

### `SPREADSHEET_ID`

1. Script Property `SPREADSHEET_ID`
2. Legacy fallback constants/runtime globals (if present):
   - `LEGACY_SPREADSHEET_ID`
   - `globalThis.SPREADSHEET_ID` / `SPREADSHEET_ID`
3. For spreadsheet open paths only, `Code.gs` may still use active spreadsheet fallback when compatible (`getSpreadsheetResolution_`).

### `ROOT_FOLDER_ID`

1. Script Property `ROOT_FOLDER_ID`
2. Legacy fallback constants/runtime globals (if present):
   - `LEGACY_ROOT_FOLDER_ID`
   - `globalThis.ROOT_FOLDER_ID` / `ROOT_FOLDER_ID`
3. If unresolved: explicit error `Missing required config: ROOT_FOLDER_ID`

## Required Script Properties

- `SPREADSHEET_ID`
- `ROOT_FOLDER_ID`
- `AUTH_USERS_JSON`
- `ONEAUTO_API_KEY` _(server-side vehicle finance lookup)_
- `JIGSAW_USERNAME` _(integration paths)_
- `JIGSAW_PASSWORD` _(integration paths)_
- `JIGSAW_SHARED_SECRET` _(webhook verification)_

## Optional Script Properties

- `JIGSAW_ENV`
- Jigsaw endpoint override properties

## Operational dependencies

- Google Sheets (deals + supporting sheets)
- Google Drive (`searchFolders`/`getFolderFiles` paths)
- `CacheService`, `LockService`, `PropertiesService`

## Deployment assumptions

- CI deploy via `clasp` on push to `main`
- Required GitHub secrets:
  - `CLASPRC_JSON_B64`
  - `CLASP_SCRIPT_ID`
  - `GAS_DEPLOYMENT_ID`
- Web app access must remain `ANYONE_ANONYMOUS` in `appsscript.json` so the Apps Script URL can render the CRM login screen before app-level auth runs.
- API/data exposure is protected in code by token-gated actions and the `doGet(api=1)` auth check, not by forcing Google sign-in at the deployment layer.

## Validation baseline

```bash
npm run lint
npm test
```

Then validate critical runtime flows in Apps Script environment.
