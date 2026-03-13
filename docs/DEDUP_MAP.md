# Dedup Map (Phase 3B)

This file records ambiguity hotspots that had competing implementations and their canonical owners.

| Function / Behavior                               | Current Locations                                                                   | Canonical Location                                                                                  | Status        | Notes                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| `handleLiveSearch`                                | `tabSalesPipeline.html` handlers object (Drive Files section)                       | `tabSalesPipeline.html` Drive Files “BRAIN” handlers block                                          | Canonicalized | Duplicate later copy in same handlers object removed; one implementation remains. |
| `runFolderSearch`                                 | `tabSalesPipeline.html` handlers object (Drive Files section)                       | `tabSalesPipeline.html` Drive Files “BRAIN” handlers block                                          | Canonicalized | Duplicate later copy removed to avoid key-shadow ambiguity.                       |
| `openClientFolder`                                | `tabSalesPipeline.html` handlers object (Drive Files section)                       | `tabSalesPipeline.html` Drive Files “BRAIN” handlers block                                          | Canonicalized | Duplicate later copy removed; existing richer implementation kept.                |
| Session/token read-write-clear (`CMF_AUTH_TOKEN`) | Previously repeated across `App.apiCall`, auth bootstrap helpers, and Jigsaw helper | `App.utils.readSessionToken` / `writeSessionToken` / `clearSessionToken` in `tabSalesPipeline.html` | Centralized   | Call sites now use shared helpers instead of direct `localStorage` access.        |
| Auth bootstrap behavior                           | Login gate, session check, login/logout handlers in `tabSalesPipeline.html`         | Shared auth bootstrap block using `App.utils` token helpers                                         | Centralized   | Token access path unified through `App.utils` to reduce drift.                    |
| Client API error handling behavior                | `App.apiCall` Google Script branch + fetch fallback                                 | `App.apiCall` + `App.utils.getApiErrorMessage` and `window.__cmfHandleAuthRequired`                 | Centralized   | Error message derivation and auth-required handling now share one path.           |

## Implementation policy

- If additional copies of the same handler reappear, keep only one callable implementation and reference this document in cleanup PRs.
- For auth/session behavior in this tab runtime, prefer `App.utils` token helpers over direct `localStorage` usage.
- For client API errors, route through `App.utils.getApiErrorMessage` and auth-required hook.
