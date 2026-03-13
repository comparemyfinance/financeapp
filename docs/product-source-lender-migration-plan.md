# Safe Multi-PR Plan: Product Source Lender Flow Migration (Jigsaw / CarMoney / CF247)

Date: 2026-03-13  
Status: Planning only (no behavior change implemented)

## Goal

Move Jigsaw, CarMoney, and CF247 into the Product Source lender-row + common pre-qual/application flow while preserving production stability and backward compatibility.

Key safety principle: **selected lender identity must remain distinct from validation/submission provider identity**.

---

## Locked decisions captured

- Canonical lender IDs (and display names) are exact string matches: `Jigsaw`, `CarMoney`, `CF247`.
- Jigsaw/CarMoney/CF247 rows always return `HIGH` eligibility in placeholder flow.
- Deterministic placeholder ranking for these three must beat all current lender rows.
- PCP rows: these three get best comparative balloon treatment only.
- HP rows: no balloon manipulation; use APR = 1% placeholder.
- All `MEDIUM`/`HIGH` rows support `APPLY` opening common Lender Apply modal.
- Modal must expose `VALIDATE` for all lenders.
- `VALIDATE` uses Jigsaw validation rules as placeholder for all lenders.
- Only `Jigsaw` may use live Jigsaw auth/submission endpoints.
- Non-Jigsaw lenders must use fabricated placeholder credentials/APIs and simulated success path.
- Selected lender identity must stay visible in UI, payloads, and status messages.
- Legacy modal buttons remain until parity checklist is passed.

---

## Capability/provider model (to add in `Lenderapi.gs`)

Add an additive lender capability registry consumed by Product Source and application modal flows.

Suggested model:

```js
// Lenderapi.gs
function getLenderCapabilities_() {
  return {
    Jigsaw: {
      lenderId: "Jigsaw",
      displayName: "Jigsaw",
      validationProvider: "JigsawRules",
      submissionProvider: "JigsawLive",
      placeholderRanking: 1000,
      forcedEligibility: "HIGH",
      supportsApply: true,
      supportsValidate: true,
      isLiveSubmission: true,
    },
    CarMoney: {
      lenderId: "CarMoney",
      displayName: "CarMoney",
      validationProvider: "JigsawRules",
      submissionProvider: "SimulatedSuccess",
      placeholderRanking: 999,
      forcedEligibility: "HIGH",
      supportsApply: true,
      supportsValidate: true,
      isLiveSubmission: false,
    },
    CF247: {
      lenderId: "CF247",
      displayName: "CF247",
      validationProvider: "JigsawRules",
      submissionProvider: "SimulatedSuccess",
      placeholderRanking: 998,
      forcedEligibility: "HIGH",
      supportsApply: true,
      supportsValidate: true,
      isLiveSubmission: false,
    },
  };
}
```

Supporting helper seams:

- `resolveValidationProvider_(selectedLender)`
- `resolveSubmissionProvider_(selectedLender)`
- `validateWithProvider_(providerId, payload)`
- `submitWithProvider_(providerId, payload)`

Design invariants:

1. `selectedLender` is the customer-visible lender identity.
2. `validationProvider` defines which rule engine executes validation.
3. `submissionProvider` defines transport/auth path.
4. Router must hard-block non-Jigsaw requests from Jigsaw live submission/auth path.

---

## Additive router actions (do not replace legacy first)

In `server/router/actions.gs`, add generic lender actions while keeping `validateJigsaw`/`submitJigsaw` intact:

- `openLenderApplication` (or `prepareLenderApplication`)
  - validates lender/applicability, returns modal state payload.
- `validateLenderApplication`
  - input includes `selectedLender`, `validationProvider` (optional hint), and payload source from current Jigsaw path.
  - output includes selected lender in response/status text.
- `submitLenderApplication` (initially optional/no-op in UI)
  - routed by `submissionProvider`.
  - enforces: only `selectedLender === 'Jigsaw'` may call live Jigsaw path.
  - non-Jigsaw returns simulated success when validation already passed.

Compatibility notes:

- Existing `validateJigsaw` and `submitJigsaw` remain available through transition.
- New actions should share response envelope style used by existing clients.
- Payload source path should mirror current Jigsaw flow to minimize risk.

---

## Staged implementation plan (5 PRs max)

## PR1 — Introduce lender capability registry + provider seams (backend only)

**Purpose**

- Create provider-separation foundation without changing UI behavior.
- Centralize lender capability metadata and deterministic ranking constants.

**Likely files**

- `Lenderapi.gs`
- `docs/architecture.md`
- `docs/API_ACTIONS.md`
- `docs/domain-model.md`

**Risk level**

- Low.

**API/router changes**

- None required externally in this PR.
- Internal helper exposure only.

**Doc/contract updates**

- Document `selectedLender` vs `validationProvider` vs `submissionProvider` model.
- Document forced eligibility and ranking/balloon placeholder policy for 3 named lenders.

**Manual verification checklist**

- Product Source existing lender simulation output unchanged.
- No existing action response shape changes.
- Capability lookup returns exact lender IDs: `Jigsaw`, `CarMoney`, `CF247`.

**Rollback point**

- Revert PR1 commit(s); no API contract introduced yet.

---

## PR2 — Additive generic router actions + provider guardrails (backend)

**Purpose**

- Introduce generic lender action endpoints with strict guardrails.
- Keep legacy Jigsaw endpoints untouched.

**Likely files**

- `server/router/actions.gs`
- `Code.gs` (if action registration is here)
- `Lenderapi.gs`
- `docs/API_ACTIONS.md`
- `docs/change-playbook.md`

**Risk level**

- Medium (new actions, guarded rollout).

**API/router changes**

- Add `openLenderApplication`.
- Add `validateLenderApplication`.
- Add `submitLenderApplication` (not yet wired in UI except optional hidden/dev).
- Preserve `validateJigsaw` and `submitJigsaw`.
- Enforce hard rule: non-Jigsaw cannot reach Jigsaw live submission/auth branch.

**Doc/contract updates**

- Add request/response examples including selected lender + provider identities.
- Add guardrail statement on non-Jigsaw submission path.

**Manual verification checklist**

- `validateJigsaw`/`submitJigsaw` still behave exactly as before.
- `validateLenderApplication` with `selectedLender=CarMoney` reports CarMoney in status while using `JigsawRules`.
- `submitLenderApplication` with non-Jigsaw never attempts Jigsaw live endpoint.
- Invalid lender ID returns safe, consistent error envelope.

**Rollback point**

- Disable new generic actions via router registration revert while leaving capability model intact.

---

## PR3 — Product Source rows/pre-qual integration for Jigsaw/CarMoney/CF247 (UI + backend integration)

**Purpose**

- Render these three as first-class Product Source lender rows with deterministic top ranking and eligibility.
- Ensure APPLY availability for MEDIUM/HIGH and payload continuity.

**Likely files**

- `tabProductSource.html`
- `Lenderapi.gs`
- `server/router/actions.gs` (if needed for pre-qual action hookup)
- `docs/domain-model.md`
- `docs/architecture.md`

**Risk level**

- Medium.

**API/router changes**

- Use additive generic actions from PR2 for apply/validate entry points.
- Keep old modal buttons unchanged.

**Doc/contract updates**

- Product Source row behavior docs:
  - forced HIGH eligibility for three lenders,
  - deterministic ranking precedence,
  - PCP vs HP placeholder behavior.

**Manual verification checklist**

- Product Source includes rows for `Jigsaw`, `CarMoney`, `CF247` with exact IDs.
- These rows rank above existing lenders deterministically.
- PCP rows show best comparative balloon for only these three.
- HP rows show APR=1% placeholder and no balloon manipulation.
- APPLY shown for all MEDIUM/HIGH rows.
- Selected lender ID survives into apply payload.

**Rollback point**

- Feature-flag/remove Product Source insertion logic and revert UI wiring, leaving generic backend actions available.

---

## PR4 — Common Lender Apply modal VALIDATE path for all lenders (legacy buttons retained)

**Purpose**

- Wire modal VALIDATE button to generic validation flow for all eligible lenders.
- Preserve lender identity in modal labels/status while reusing Jigsaw rules engine where configured.

**Likely files**

- `tabSalesPipeline.html`
- `tabProductSource.html` (handoff payload if needed)
- `server/router/actions.gs`
- `Lenderapi.gs`
- `docs/API_ACTIONS.md`

**Risk level**

- Medium-high (user-facing modal logic).

**API/router changes**

- UI calls `openLenderApplication` and `validateLenderApplication`.
- `submitLenderApplication` remains not primary in UI (APPLY opens modal; VALIDATE active).
- Legacy dedicated Jigsaw/CarMoney/CF247 buttons still present and functional.

**Doc/contract updates**

- Modal payload schema and status-message requirements.
- Clarify selected lender display must not be replaced by provider names.

**Manual verification checklist**

- APPLY from Product Source opens common modal for all MEDIUM/HIGH lenders.
- VALIDATE works for Jigsaw/CarMoney/CF247 and shows selected lender name in all status text.
- CarMoney/CF247 validation returns simulated success path post-rule-pass.
- Jigsaw validation continues using existing rule expectations.
- Legacy modal buttons still work unchanged.

**Rollback point**

- Rewire modal call sites back to legacy button handlers and keep backend additions dormant.

---

## PR5 — Parity gate + remove legacy modal buttons (cleanup only after checklist pass)

**Purpose**

- Remove dedicated legacy modal buttons only once parity is proven in production-like validation.

**Likely files**

- `tabSalesPipeline.html`
- `docs/change-playbook.md`
- `docs/architecture.md`

**Risk level**

- Medium (UX change, no new backend behavior).

**API/router changes**

- None mandatory.
- Legacy router actions may remain for one deprecation window before later removal.

**Doc/contract updates**

- Add parity checklist result and deprecation timeline for legacy buttons/actions.

**Manual verification checklist (must be green before merge)**

- Common modal path fully supports Jigsaw/CarMoney/CF247 from Product Source.
- All success/error/loading states equivalent or better than legacy path.
- Selected lender identity preserved in payloads, UI labels, and logs.
- No non-Jigsaw request can trigger Jigsaw live auth/submission.
- Support team sign-off on workflow continuity.

**Rollback point**

- Revert PR5 only to restore legacy buttons immediately.

---

## Safest order for removing legacy Application modal buttons

1. Keep buttons through PR1–PR4.
2. In PR4, instrument parity checklist metrics/logging and run side-by-side UAT.
3. Remove buttons only in PR5 after explicit parity sign-off.
4. Keep legacy backend actions available for at least one release cycle after UI removal.
5. Remove deprecated router actions in a later dedicated PR after zero-usage confirmation.

---

## Critical assumptions to document before implementation

1. Canonical lender IDs are case-sensitive and exactly `Jigsaw`, `CarMoney`, `CF247`.
2. Existing Jigsaw payload source path is stable and reusable by generic actions without schema drift.
3. Placeholder/simulated provider responses are acceptable for non-Jigsaw lenders in all target environments.
4. Ranking constants chosen for the three lenders will not break downstream sorting assumptions.
5. Modal UX copy can reference selected lender even when provider differs.
6. Logging/telemetry fields may include both selected lender and provider IDs for auditability.
7. Legacy and generic actions can coexist without caller ambiguity during rollout.
8. No compliance policy requires distinct validation logic per lender before launch of shared placeholder rules.

---

## Backward compatibility posture

- Additive actions first, destructive removals last.
- Preserve existing response envelopes and legacy actions during migration.
- Preserve legacy modal controls until parity is proven.
- Isolate Jigsaw live integration by explicit provider gating.
