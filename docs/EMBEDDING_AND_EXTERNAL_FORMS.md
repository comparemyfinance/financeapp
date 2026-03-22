# Embedding And External Forms

## Purpose

This document defines the current design constraints for iframe-based subprojects and externally hosted application forms used from this CRM.

Use this before changing:

- the CRM Application tab in `Index.html`
- any embedded tab that points at another Apps Script web app
- any plan to surface the same external form inside `square.online` or another external website

## Current Runtime Reality

- The CRM contains an Application chooser in `Index.html` that can select an external form URL and load a launch fallback for it.
- The current chooser targets two external Apps Script web apps:
  - Sales Agent Apply
  - Refi Direct Apply
- A separate Customer Document Upload flow already uses an iframe pattern from the CRM shell.

## Current Support Status

- **CRM internal iframe support for the two current application URLs:** not currently reliable.
- **External website iframe support (for example `square.online`) for the same URLs:** not currently documented as supported, and likely blocked for the same reasons unless the external deployment is changed.

Why:

- `docs/application-embed-validation.md` recorded Google sign-in redirects for both application URLs.
- The checked responses included frame-blocking headers such as `X-Frame-Options` and `Content-Security-Policy: frame-ancestors 'self'`.
- When that happens, the browser blocks the embedded flow before the target form can render.

## Design Rules

### 1. Default to open-in-new-tab until framing is revalidated

For external Apps Script forms, the safe default is:

- CRM shows chooser/launch controls
- user opens the target form in a new tab/window
- CRM explains why the form opens separately

Do not treat the existence of an Application launcher shell in `Index.html` as proof that the target form is safely embeddable.

### 2. Keep auth and privileged API access server-side

Do not push secrets, lender credentials, or privileged API keys into embedded client apps.

That means:

- `AUTH_USERS_JSON`, `ONEAUTO_API_KEY`, `JIGSAW_*`, and similar config remain server-side
- cross-origin iframe content should not be trusted with CRM secrets
- if an embedded/external form needs backend data, prefer a server-mediated integration rather than direct browser calls with shared credentials

### 3. Treat cross-origin calls as a contract, not an implementation detail

If another subproject must run in an iframe or on an external website, document:

- allowed host page origins
- target app origin
- whether cookies/session are required
- whether the app must be publicly reachable without Google sign-in
- how data is exchanged:
  - no data exchange
  - query parameters for bootstrap only
  - `postMessage` with explicit origin allowlist
  - backend API calls mediated by this CRM

### 4. Do not assume Apps Script iframe behavior matches ordinary hosting

Apps Script web apps can still fail embedding even when CRM HTML itself uses `ALLOWALL`, because the embedded target app must also permit framing and avoid redirecting into a Google-controlled sign-in page.

For a target app to be considered iframe-safe, verify all of the following:

- the deployed web app is reachable without interactive Google sign-in
- response headers do not block framing for the intended parent origin(s)
- any external APIs used by the embedded app do not require browser-side cross-origin access that will fail in the target host
- the user journey works both inside the CRM and, if required, on the external website

## Recommended Integration Modes

### Mode A: New-tab launch

Use when:

- the external form is on Apps Script
- the target redirects to Google sign-in
- frame headers are not under your control
- the same form must also work on a third-party site such as `square.online`

This is the current recommended mode for Sales Agent Apply and Refi Direct Apply.

### Mode B: True iframe embed

Use only after revalidation confirms:

- no Google sign-in redirect for the end user
- iframe-allowing headers for the required parent hosts
- stable cross-origin behavior for any API calls inside the embedded app

If this mode is adopted, add:

- exact supported hostnames
- the deployment/auth assumptions
- the message-passing contract if used
- fallback behavior when the iframe cannot load

### Mode C: Host-page shell plus backend proxy

Use when:

- the UI needs to appear embedded
- but target APIs or auth flows are too fragile cross-origin

In this model, the host page owns the shell and calls its own backend, rather than embedding a full remote app that makes privileged browser-side calls.

## Required Validation Before Shipping An Embedded Form

1. Confirm the target deployment is intended to be public enough for iframe use.
2. Inspect redirect chain and response headers.
3. Test load inside the CRM host.
4. Test load inside the external host if required, such as `square.online`.
5. Verify any API calls made by the embedded page succeed in-browser from the real host origin.
6. Verify fallback UX when embedding fails.
7. Update this file and `docs/application-embed-validation.md` with the latest result.

## Known Gaps In This Repo

- There is no formal `postMessage` contract documented for the Application tab.
- There is no documented supported-host allowlist for embedded subprojects.
- There is no repo-level guide for how the external Sales Agent / Refi Direct projects should expose an iframe-safe build.
- There is no documented `square.online` compatibility matrix yet.

## Source References

- Runtime shell and chooser: `Index.html`
- Current validation record: `docs/application-embed-validation.md`
- Runtime ownership map: `docs/LIVE_FRONTEND_RUNTIME_MAP.md`
