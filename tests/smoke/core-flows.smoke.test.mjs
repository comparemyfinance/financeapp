import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

test('smoke: login -> authStatus -> protected call -> logout', () => {
  const ctx = createGasContext();
  loadGasRuntime(ctx);

  const login = ctx.routeAction_('authLogin', { username: 'kyle', password: 'CMF2025' }, {});
  assert.equal(login.success, true);

  const status = ctx.routeAction_('authStatus', { token: login.token }, {});
  assert.equal(status.success, true);
  assert.equal(status.loggedIn, true);

  const lenders = ctx.routeAction_('listLenders', { token: login.token }, {});
  assert.equal(lenders.success, true);
  assert.ok(Array.isArray(lenders.lenders));

  const logout = ctx.routeAction_('authLogout', { token: login.token }, {});
  assert.equal(logout.success, true);

  const denied = ctx.routeAction_('listLenders', { token: login.token }, {});
  assert.equal(denied.success, false);
  assert.equal(denied.error.code, 'AUTH_REQUIRED');
});
