# Test Strategy (Phase 3A)

This document defines validation expectations before refactors and contract changes.

## Test layers

## 1) Structural validation

Structural checks confirm repository integrity and parse-level correctness.

Current structural checks:

- `npm run sanity`
  - verifies required key files exist
- `npm run lint`
  - formatting check (`prettier --check`)
  - syntax validation (`scripts/validate-syntax.mjs`)
- `npm test`
  - sanity + syntax validation

Structural validation does **not** prove runtime behavior correctness.

## 2) Behavioral validation

Behavioral validation confirms action contracts and workflow behavior remain stable.

Behavioral validation should include:

- action-level contract assertions (payload in / envelope out)
- auth-gated vs public action behavior
- write-path side effects on sheet state
- integration action success/failure path handling
- UI critical-path smoke flows in Apps Script runtime context

## Critical flows requiring contract tests

At minimum, treat these as contract-critical:

1. Auth lifecycle

- `authLogin`
- `authStatus`
- `authLogout`
- protected-action denial when token invalid/missing

2. Deal persistence lifecycle

- `save` (including conflict/no-match behavior)
- `delete`
- `batchUpdate`
- `load/getDelta/getAll` response shape stability

3. Client files flows

- `searchFolders`
- `getFolderFiles`
- legacy folderId alias handling (temporary compatibility)

4. Integration flows

- `validateJigsaw` / `validateJigsawReferral`
- `submitJigsaw` / `submitJigsawReferral`
- webhook/secret validation behavior (where applicable)

5. Lender/quote flows

- `listLenders`
- `getLenderQuote`
- `getLenderQuotesBatch`
- score path outputs/error handling

## Smoke test scope

Smoke tests should verify, at minimum:

- app can load in Apps Script web app context
- login succeeds with valid credentials and fails safely with invalid credentials
- one read action and one write action complete successfully
- one integration validate path returns expected envelope
- client-files search/list renders expected response handling

## Pre-refactor mandatory test gate

Before any significant refactor (router, auth, persistence, integration, large template rework):

1. Run structural checks (`npm run lint`, `npm test`).
2. Execute contract smoke tests for impacted actions.
3. Compare response envelopes against `docs/API_ACTIONS.md`.
4. Confirm error behavior follows `docs/ERROR_POLICY.md` (or compatibility bridge documented).

## Refactor safety requirements

- No contract-affecting change ships without matching doc updates.
- If behavior changes are intentional, include explicit before/after examples in PR description.
- If only structural changes are made, expected outputs must remain unchanged.

## Coverage goals (incremental)

- Maintain 100% structural-check pass rate.
- Add and maintain contract checks for all critical flows listed above.
- Reduce reliance on manual verification by codifying repeatable smoke scripts over time.
