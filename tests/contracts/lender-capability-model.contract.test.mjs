import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

test('lender capability model maps required providers for Jigsaw/CarMoney/CF247', () => {
  const ctx = boot();
  const caps = ctx.getLenderCapabilities_();

  assert.ok(caps.Jigsaw);
  assert.equal(caps.Jigsaw.validationProvider, 'JigsawRules');
  assert.equal(caps.Jigsaw.submissionProvider, 'JigsawLive');
  assert.equal(caps.Jigsaw.isLiveSubmission, true);

  assert.ok(caps.CarMoney);
  assert.equal(caps.CarMoney.validationProvider, 'JigsawRules');
  assert.equal(caps.CarMoney.submissionProvider, 'SimulatedSuccess');
  assert.equal(caps.CarMoney.isLiveSubmission, false);

  assert.ok(caps.CF247);
  assert.equal(caps.CF247.validationProvider, 'JigsawRules');
  assert.equal(caps.CF247.submissionProvider, 'SimulatedSuccess');
  assert.equal(caps.CF247.isLiveSubmission, false);
});

test('standard lenders use placeholder provider model invariants', () => {
  const ctx = boot();
  const cap = ctx.getLenderCapability_('Zopa');

  assert.equal(cap.validationProvider, 'JigsawRules');
  assert.equal(cap.submissionProvider, 'SimulatedSuccess');
  assert.equal(cap.isLiveSubmission, false);
});

test('FINCLUSION inherits the standard placeholder capability model', () => {
  const ctx = boot();
  const cap = ctx.getLenderCapability_('FINCLUSION');

  assert.equal(cap.displayName, 'FINCLUSION');
  assert.equal(cap.validationProvider, 'JigsawRules');
  assert.equal(cap.submissionProvider, 'SimulatedSuccess');
  assert.equal(cap.isLiveSubmission, false);
});

test('provider profile resolves common alias names to canonical lenders deterministically', () => {
  const ctx = boot();

  const bnp = ctx.getLenderCapability_('BNP Paribas');
  assert.equal(bnp.displayName, 'BNP Paribas Finance');
  assert.equal(bnp.canonicalLender, 'BNP Paribas Finance');
  assert.equal(bnp.aliasMatched, true);

  const northridge = ctx.getLenderCapability_('Northridge');
  assert.equal(northridge.displayName, 'Northridge Finance');
  assert.equal(northridge.canonicalLender, 'Northridge Finance');

  const startline = ctx.getLenderCapability_('Startline');
  assert.equal(startline.displayName, 'Startline Finance');
  assert.equal(startline.canonicalLender, 'Startline Finance');

  const advantage = ctx.getLenderCapability_('Advantage');
  assert.equal(advantage.displayName, 'Advantage Finance');
  assert.equal(advantage.canonicalLender, 'Advantage Finance');
});

test('provider resolver helpers preserve selected lender identity and map deterministically', () => {
  const ctx = boot();

  assert.equal(ctx.resolveValidationProvider_('CarMoney'), 'JigsawRules');
  assert.equal(ctx.resolveSubmissionProvider_('CarMoney'), 'SimulatedSuccess');

  assert.equal(ctx.resolveValidationProvider_('Jigsaw'), 'JigsawRules');
  assert.equal(ctx.resolveSubmissionProvider_('Jigsaw'), 'JigsawLive');

  const unknown = ctx.getLenderCapability_('Future Lender');
  assert.equal(unknown.lenderId, 'Future Lender');
  assert.equal(unknown.displayName, 'Future Lender');
  assert.equal(unknown.canonicalLender, 'Future Lender');
  assert.equal(unknown.validationProvider, 'JigsawRules');
  assert.equal(unknown.submissionProvider, 'SimulatedSuccess');
});
