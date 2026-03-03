# Contributing

## Setup

- Runtime: Google Apps Script (V8).
- Deploy/sync tool: `clasp`.
- CI is intentionally lightweight and currently runs sanity file-existence checks.

## Branching

- Work on a feature branch and open a PR to `main`.
- Keep PRs small and scoped.

## Local Checks

Install tooling once:

```bash
npm ci
```

Run from repo root:

```bash
npm run lint
npm test
```

For auto-formatting before commit:

```bash
npm run format
```

`npm test` includes the original sanity checks (`Code.gs`, `Index.html`, `appsscript.json`).

## Optional Manual Validation

- Review `appsscript.json` for deployment/access settings before release.
- If deploying via CI, ensure required GitHub secrets are configured:
  - `CLASPRC_JSON_B64`
  - `CLASP_SCRIPT_ID`
  - `GAS_DEPLOYMENT_ID`

## Security Expectations

- Follow `SECURITY.md` for threat model and secret handling.
- Do not commit plaintext credentials, tokens, or shared secrets.
