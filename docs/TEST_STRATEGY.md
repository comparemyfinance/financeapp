# Test Strategy (Operational Map)

## 1) Structural checks

Purpose: fast integrity + parse checks.

Commands:

```bash
npm run sanity
npm run lint
npm run validate:syntax
npm run validate:gas-runtime
```

Files/scripts:

- `scripts/validate-syntax.mjs`
- `scripts/validate-gas-runtime.mjs`

## 2) Behavioral contract tests

Purpose: action contracts + error/auth/config behavior.

Command:

```bash
npm run test:behavioral
```

Key files:

- `tests/contracts/router-auth-drive-error.contract.test.mjs`
- `tests/contracts/frontend-error-normalization.contract.test.mjs`
- Harness: `tests/helpers/gas-test-harness.mjs`

## 3) Smoke tests

Purpose: critical end-to-end baseline flow.

Executed as part of `npm run test:behavioral`.

Key file:

- `tests/smoke/core-flows.smoke.test.mjs`

## 4) Standard agent validation path

Run this for most PRs:

```bash
npm run lint
npm test
```

`npm test` currently runs:

- sanity
- syntax validation
- GAS runtime validation
- behavioral tests (contracts + smoke)

## 5) Change-to-test mapping

- Router/action changes -> `tests/contracts/router-auth-drive-error.contract.test.mjs`
- Error envelope/client error changes -> `tests/contracts/frontend-error-normalization.contract.test.mjs`
- Auth/session lifecycle changes -> contract + smoke tests
- Config resolution changes -> contract tests covering spreadsheet/root-folder/auth config
