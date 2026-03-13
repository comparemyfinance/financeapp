import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

test('submitLenderApplication returns simulated success for non-Jigsaw lenders after validation passes', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const out = ctx.routeAction_(
    'submitLenderApplication',
    {
      token: login.token,
      selectedLender: 'CarMoney',
      deal: { id: 'D-201', firstName: 'Casey' },
    },
    {},
  );

  assert.equal(out.success, true);
  assert.equal(out.selectedLender, 'CarMoney');
  assert.equal(out.validationProvider, 'JigsawRules');
  assert.equal(out.submissionProvider, 'SimulatedSuccess');
  assert.equal(out.validation.success, true);
  assert.equal(out.result.mode, 'placeholder');
  assert.match(out.statusMessage, /CarMoney submission successful/);
});

test('submitLenderApplication keeps Jigsaw as only live-capable provider and blocks active submit path', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const out = ctx.routeAction_(
    'submitLenderApplication',
    {
      token: login.token,
      selectedLender: 'Jigsaw',
      deal: { id: 'D-202', firstName: 'Riley' },
    },
    {},
  );

  assert.equal(out.success, false);
  assert.equal(out.selectedLender, 'Jigsaw');
  assert.equal(out.validationProvider, 'JigsawRules');
  assert.equal(out.submissionProvider, 'JigsawLive');
  assert.equal(out.validation.success, true);
  assert.equal(out.result.code, 'SUBMIT_NOT_ACTIVE');
  assert.match(out.statusMessage, /Jigsaw submission failed/);
});

test('submitLenderApplication blocks submit when validation fails', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');

  const out = ctx.routeAction_(
    'submitLenderApplication',
    {
      token: login.token,
      selectedLender: 'CF247',
    },
    {},
  );

  assert.equal(out.success, false);
  assert.equal(out.stage, 'validate');
  assert.equal(out.selectedLender, 'CF247');
  assert.equal(out.validation.success, false);
  assert.equal(out.validation.result.code, 'VALIDATION_ERROR');
  assert.match(out.statusMessage, /CF247 submit blocked: validation failed/);
});
