# Contributing

## Setup

- Runtime: Google Apps Script (V8).
- Deploy/sync tool: `clasp`.
- CI is intentionally lightweight and currently runs sanity file-existence checks.

## Branching

- Work on a feature branch and open a PR to `main`.
- Keep PRs small and scoped.

## Conflict Resolution Rule (GitHub UI “Keep current”)

Do **not** rely solely on GitHub's conflict UI action **“Keep current”** when resolving merge conflicts.

Failure mode: “Keep current” can accidentally drop one side's changes, or leave malformed JS/HTML in template files. CI only catches this when checks are actually run.

After resolving conflicts, always run:

```bash
npm ci
npm run lint
npm test
npm run format:check
```

Use `npm ci` whenever `package-lock.json` changed or if dependency drift is suspected.

### Conflict resolution checklist

- Rebase/merge locally and inspect conflict hunks instead of accepting “Keep current” blindly.
- Manually review all conflicted `.html`, `.gs`, and workflow/template files.
- Run `npm ci` if the lockfile changed or dependencies seem out of sync.
- Run `npm run lint` and ensure it exits cleanly.
- Run `npm test` and ensure sanity checks pass.
- Run `npm run format:check` (or `npx prettier --check .`) before pushing.

## Local Checks

Install tooling once:

```bash
npm ci
```

Run from repo root:

```bash
npm run lint
npm test
npm run format:check
```

For auto-formatting before commit:

```bash
npm run format
```

`npm test` includes the original sanity checks (`Code.gs`, `Index.html`, `appsscript.json`).

## Optional local post-merge hook safeguard

Git hooks are local-only and opt-in. This repo includes `.githooks/post-merge` for merge-safety checks on developer machines.

Enable once:

```bash
npm run hooks:install
```

The hook is intentionally scoped to local development and:

- exits immediately in CI (`CI` env var set),
- runs `npm run lint`,
- runs `npm run format:check`,
- exits with an error if `npm` is not available.

## How to verify locally

```bash
npm run hooks:install
npm run lint
npm test
npm run format:check
```

(Optional) simulate the hook directly:

```bash
.githooks/post-merge
```

## Optional Manual Validation

- Review `appsscript.json` for deployment/access settings before release.
- If deploying via CI, ensure required GitHub secrets are configured:
  - `CLASPRC_JSON_B64`
  - `CLASP_SCRIPT_ID`
  - `GAS_DEPLOYMENT_ID`

## Security Expectations

- Follow `SECURITY.md` for threat model and secret handling.
- Do not commit plaintext credentials, tokens, or shared secrets.
