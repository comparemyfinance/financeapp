import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

test('validateLenderApplication routes through provider dispatch and preserves selected lender identity', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const out = ctx.routeAction_(
    'validateLenderApplication',
    {
      token: login.token,
      selectedLender: 'CarMoney',
      deal: { id: 'D-101', firstName: 'Alex' },
    },
    {},
  );

  assert.equal(out.success, true);
  assert.equal(out.selectedLender, 'CarMoney');
  assert.equal(out.validationProvider, 'JigsawRules');
  assert.equal(out.submissionProvider, 'SimulatedSuccess');
  assert.match(out.statusMessage, /CarMoney validation successful/);
  assert.equal(out.result.mode, 'placeholder');
});

test('validateLenderApplication maps Jigsaw to JigsawLive submission provider metadata', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const out = ctx.routeAction_(
    'validateLenderApplication',
    {
      token: login.token,
      selectedLender: 'Jigsaw',
      deal: { id: 'D-102' },
    },
    {},
  );

  assert.equal(out.success, true);
  assert.equal(out.selectedLender, 'Jigsaw');
  assert.equal(out.validationProvider, 'JigsawRules');
  assert.equal(out.submissionProvider, 'JigsawLive');
  assert.match(out.statusMessage, /Jigsaw validation successful/);
});

test('validateLenderApplication requires selectedLender and deal payload', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const missingLender = ctx.routeAction_(
    'validateLenderApplication',
    { token: login.token, deal: { id: 'D-103' } },
    {},
  );
  assert.equal(missingLender.success, false);
  assert.equal(missingLender.code, 'VALIDATION_ERROR');

  const missingDeal = ctx.routeAction_(
    'validateLenderApplication',
    { token: login.token, selectedLender: 'CF247' },
    {},
  );
  assert.equal(missingDeal.success, false);
  assert.equal(missingDeal.selectedLender, 'CF247');
  assert.equal(missingDeal.validationProvider, 'JigsawRules');
  assert.match(missingDeal.statusMessage, /CF247 validation failed/);
  assert.equal(missingDeal.result.code, 'VALIDATION_ERROR');
});
