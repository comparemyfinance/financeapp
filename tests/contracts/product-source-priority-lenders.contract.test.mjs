import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

function isPriorityLender(name = '') {
  return ['Jigsaw', 'CarMoney', 'CF247'].includes(String(name));
}

test('getLenderQuotesBatch includes Jigsaw/CarMoney/CF247 with 1% APR and top ranking', () => {
  const ctx = boot();
  const out = ctx.getLenderQuotesBatch({
    settlementFigure: 10000,
    remainingTerm: 48,
    origLoan: 12000,
    financeType: 'PCP',
  });

  assert.equal(out.success, true);
  assert.ok(Array.isArray(out.products));

  const byName = new Map(out.products.map((p) => [p.lender, p]));
  ['Jigsaw', 'CarMoney', 'CF247'].forEach((name) => {
    assert.equal(byName.has(name), true);
    assert.equal(byName.get(name).apr, 1);
  });

  const topThree = out.products.slice(0, 3).map((p) => p.lender);
  assert.equal(topThree.join('|'), 'Jigsaw|CarMoney|CF247');
});

test('priority lenders get deterministic best PCP balloon, but HP does not apply balloon boost', () => {
  const ctx = boot();

  const pcp = ctx.getLenderQuotesBatch({
    settlementFigure: 12000,
    remainingTerm: 48,
    origLoan: 15000,
    financeType: 'PCP',
  });
  assert.equal(pcp.success, true);

  const pcpProducts = pcp.products || [];
  const pcpPriority = pcpProducts.filter((p) => isPriorityLender(p.lender));
  const pcpStandard = pcpProducts.filter((p) => !isPriorityLender(p.lender));
  const maxStandardBalloon = Math.max(
    ...pcpStandard.map((p) => p.calculatedBalloonPayment),
  );
  pcpPriority.forEach((p) => {
    assert.ok(p.calculatedBalloonPayment > maxStandardBalloon);
  });

  const hp = ctx.getLenderQuotesBatch({
    settlementFigure: 12000,
    remainingTerm: 48,
    origLoan: 15000,
    financeType: 'HP',
  });
  assert.equal(hp.success, true);

  const baseBalloon =
    12000 * ctx.getBalloonPerc_(48, 15000);
  hp.products
    .filter((p) => isPriorityLender(p.lender))
    .forEach((p) => {
      assert.ok(Math.abs(p.calculatedBalloonPayment - baseBalloon) < 1e-6);
    });
});

test('finance navigator soft-score forces HIGH eligibility for Jigsaw/CarMoney/CF247', () => {
  const ctx = boot();

  const out = ctx.getFinanceNavigatorSoftScore({
    clientId: 'client-low-score',
    clientScore: 20,
    lenders: [
      { lenderId: 'jigsaw', lenderName: 'Jigsaw', baseApr: 1 },
      { lenderId: 'carmoney', lenderName: 'CarMoney', baseApr: 1 },
      { lenderId: 'cf247', lenderName: 'CF247', baseApr: 1 },
      { lenderId: 'zopa', lenderName: 'Zopa', baseApr: 17.9 },
    ],
  });

  assert.equal(out.success, true);
  assert.ok(Array.isArray(out.offers));

  ['jigsaw', 'carmoney', 'cf247'].forEach((key) => {
    const offer = out.offers.find((item) => item.lenderId === key);
    assert.ok(offer);
    assert.equal(offer.decision, 'accept');
    assert.equal(offer.acceptanceLabel, 'High');
    assert.equal(offer.acceptanceScore, 90);
    assert.equal(offer.aprOffer, 1);
  });
});

test('listLenders includes FINCLUSION so backend lender defaults stay in parity with Product Source UI', () => {
  const ctx = boot();
  const out = ctx.listLenders_();

  assert.ok(Array.isArray(out));
  assert.ok(out.some((item) => item.lender === 'FINCLUSION'));
});

test('getLenderQuote accepts common lender aliases used by UI labels and future provider mappings', () => {
  const ctx = boot();
  const sharedPayload = {
    settlementFigure: 10000,
    remainingTerm: 48,
    origLoan: 12000,
  };

  const bnp = ctx.getLenderQuote({ ...sharedPayload, lender: 'BNP Paribas' });
  assert.equal(bnp.success, true);
  assert.equal(bnp.quoteOutputs.lender, 'BNP Paribas Finance');

  const northridge = ctx.getLenderQuote({
    ...sharedPayload,
    lender: 'Northridge',
  });
  assert.equal(northridge.success, true);
  assert.equal(northridge.quoteOutputs.lender, 'Northridge Finance');

  const startline = ctx.getLenderQuote({
    ...sharedPayload,
    lender: 'Startline',
  });
  assert.equal(startline.success, true);
  assert.equal(startline.quoteOutputs.lender, 'Startline Finance');
});

test('backend provider registry accepts lender labels already surfaced in modal logos and UI copy', () => {
  const ctx = boot();
  const lenderNames = [
    'Finclusion',
    'Alphera',
    'Moneybarn',
    'Moneyway',
    'Startline',
    'Oodle',
    'Tandem',
    'Zopa',
    'V12',
    'Credit Agricole',
    'Close Brothers',
    'Northridge',
    'Lendable',
    'BNP Paribas',
    'Motonovo',
    'Advantage',
  ];

  lenderNames.forEach((name) => {
    const cap = ctx.getLenderCapability_(name);
    assert.notEqual(cap.displayName, 'Unknown');
    assert.equal(cap.supportsApply, true);
    assert.equal(cap.supportsValidate, true);
  });
});
