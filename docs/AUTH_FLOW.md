# Auth & Session Flow (Phase 3C)

This document defines the canonical frontend auth/session path and backend auth behavior.

## Canonical frontend session utility

- Canonical utility object: `window.CMFSession`
- Canonical methods:
  - `readToken()`
  - `writeToken(token, ttlSeconds)`
  - `clearToken()`
  - `isFresh()`
  - `authPayload(base)`
  - `onUnauthenticated(message)`

`window.CMFSession` is the single source for:

- token read/write/clear
- token freshness checks
- auth payload construction
- unauthenticated fallback behavior

## Canonical idle session manager

- Canonical owner: `Index.html` auth bootstrap
- Idle timeout: 15 minutes
- Activity sources reset the timer:
  - `pointerdown`
  - `keydown`
  - `touchstart`
  - `scroll`
  - `visibilitychange` when the app becomes visible again
- On timeout, the frontend:
  - best-effort releases any active deal lock / heartbeat
  - best-effort calls `authLogout`
  - clears the local token
  - returns to the login overlay with an inactivity message

## Frontend flow

1. Login submits credentials via `authLogin`.
2. On success, token is stored via `CMFSession.writeToken(...)`.
3. API calls use `CMFSession.authPayload(...)` for token injection.
4. Before protected calls, `CMFSession.isFresh()` can short-circuit stale sessions.
5. An idle watcher runs only while the authenticated app shell is visible.
6. When auth-required is detected, `CMFSession.onUnauthenticated(...)` clears token and triggers login fallback.
7. Manual logout calls `authLogout` and clears token via `CMFSession.clearToken()`.
8. Inactivity logout follows the same logout path after 15 minutes with no tracked activity.

## Backend auth flow

- Public actions: `authLogin`, `authStatus`, `authLogout`, `healthCheck`
- Protected actions are gated by `auth_check_token_`.
- Invalid/missing token returns canonical error via backend error helper (`makeError_`) with `AUTH_REQUIRED` and `authRequired: true`.

## Contract notes

- Existing compatibility fields (`success`, `error`) remain present.
- Canonical policy target (`ok` + error code/message object) is defined in `docs/ERROR_POLICY.md`.
- Any auth contract changes must update:
  - `docs/API_ACTIONS.md`
  - `docs/ERROR_POLICY.md`
  - this file
