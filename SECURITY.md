# Security Policy

## Scope

This repository is a Google Apps Script CRM web app with:

- Frontend UI in `index.html` served by Apps Script `doGet`.
- Backend API/router in `Code.gs` and authentication helpers in `Auth.js`.
- Deployment via GitHub Actions and `clasp`.

## Threat Model

### Assets

- Deal/customer data stored in Google Sheets.
- Authentication tokens used by browser clients.
- Third-party lender/Jigsaw credentials and webhook secrets.
- Deployment credentials in GitHub/Aps Script secrets.

### Trust Boundaries

1. **Browser ↔ Apps Script Web App**: user-controlled inputs and tokens cross this boundary.
2. **Apps Script ↔ Google Sheets/Drive**: privileged script access to stored CRM data.
3. **Apps Script ↔ Third-party APIs (Jigsaw/lenders)**: outbound HTTP requests with bearer tokens.
4. **GitHub Actions ↔ Apps Script deployment**: CI/CD secrets and deployment permissions.

### Primary Threats

- Unauthorized API access (weak auth, token theft, replay).
- Secret leakage (hardcoded credentials, logs, or client-visible fields).
- Injection/XSS from unsanitized HTML rendering.
- Data integrity issues from concurrent writes and partial failures.
- Webhook spoofing/signature bypass.

## Current Security Controls

- Token-based session checks before most actions (`routeAction_`, `auth_check_token_`).
- HMAC webhook signature verification for Jigsaw webhooks.
- Script and cache locks around many write paths.
- CI deploy credentials stored in GitHub Actions secrets.

## Secrets Hygiene

### Required Rules

1. **Never hardcode credentials, API keys, usernames/passwords, or shared secrets** in committed files.
2. Store runtime secrets only in **Apps Script Script Properties** (or a managed secret store), not in source.
3. Store CI/CD secrets only in **GitHub Actions Secrets**.
4. Do not log raw secrets, bearer tokens, or full webhook payloads containing sensitive PII.
5. Rotate secrets immediately if they were committed or exposed.

### Incident Response (Secret Exposure)

1. Revoke/rotate exposed secret at provider.
2. Remove secret from code and history if required.
3. Update Script Properties/GitHub secrets.
4. Redeploy.
5. Document impact window and remediation in `/docs/audit-report.md` backlog.

## Secure Development Checklist

- Validate and normalize all user inputs at trust boundaries.
- Avoid `innerHTML` for untrusted data; prefer `textContent` or explicit escaping.
- Return generic server errors in production (no stack traces to clients).
- Add auth throttling/lockout for login endpoints.
- Keep web app access as restrictive as operationally possible.
- Re-run checks from `CONTRIBUTING.md` before every PR.
