import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

test('router dispatches canonical action correctly (healthCheck)', () => {
  const ctx = boot();
  const out = ctx.routeAction_('healthCheck', {}, {});
  assert.equal(out.success, true);
  assert.equal(out.status, 'healthy');
});

test('unknown action returns canonical unknown-action error', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  const out = ctx.routeAction_('totallyUnknownAction', { token: login.token }, {});
  assert.equal(out.success, false);
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'UNKNOWN_ACTION');
  assert.match(out.error.message, /Unknown action/);
});

test('missing auth returns canonical auth error', () => {
  const ctx = boot();
  const out = ctx.routeAction_('listLenders', {}, {});
  assert.equal(out.success, false);
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'AUTH_REQUIRED');
  assert.equal(out.authRequired, true);
});

test('login happy path returns canonical success envelope', () => {
  const ctx = boot();
  const out = ctx.routeAction_('authLogin', { username: 'kyle', password: 'CMF2025' }, {});
  assert.equal(out.success, true);
  assert.ok(typeof out.token === 'string' && out.token.length > 0);
  assert.equal(out.user, 'kyle');
});

test('expired session returns canonical auth failure', () => {
  const ctx = boot();
  // force auth token miss / expiry by checking status with unknown token
  const out = ctx.routeAction_('listLenders', { token: 'expired-token' }, {});
  assert.equal(out.success, false);
  assert.equal(out.error.code, 'AUTH_REQUIRED');
  assert.equal(out.authRequired, true);
});

test('legacy alias still works: load -> getDelta', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  let called = 0;
  ctx.getRowsData_ = () => {
    called += 1;
    return [{ id: 'D1' }];
  };
  const out = ctx.routeAction_('load', { token: login.token }, {});
  assert.equal(out.success, true);
  assert.deepEqual(out.data, [{ id: 'D1' }]);
  assert.equal(called, 1);
});

test('live search returns canonical response shape', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.searchClientFolders_ = (q) => ({
    success: true,
    folders: [{ id: 'F1', name: `Folder-${q || 'all'}`, updated: new Date().toISOString() }],
  });
  const out = ctx.routeAction_('searchFolders', { token: login.token, query: 'smith' }, {});
  assert.equal(out.success, true);
  assert.ok(Array.isArray(out.folders));
  assert.ok(out.folders[0].id);
});

test('folder search/open client folder returns canonical response shape', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.getFolderFiles_ = (id) => ({
    success: true,
    folderName: `Folder-${id}`,
    files: [{ id: 'file-1', name: 'doc.pdf', url: 'https://example/doc.pdf' }],
  });
  const out = ctx.routeAction_('getFolderFiles', { token: login.token, folderId: 'F-10' }, {});
  assert.equal(out.success, true);
  assert.equal(typeof out.folderName, 'string');
  assert.ok(Array.isArray(out.files));
});

test('jigsaw validate alias dispatch preserves payload invariants', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  let captured = null;
  ctx.validateJigsawAction_ = (payload) => {
    captured = payload;
    return { success: true, ok: true, echoed: payload?.dealId || null };
  };
  const payload = { token: login.token, dealId: 'D-55', nested: { keep: true } };
  const out = ctx.routeAction_('validateJigsawReferral', payload, {});
  assert.equal(out.success, true);
  assert.equal(out.echoed, 'D-55');
  assert.deepEqual(captured.nested, { keep: true });
});

test('client error envelope never exposes stack traces', () => {
  const ctx = boot();
  const out = ctx.safeObj_(() => {
    throw new Error('boom');
  });
  assert.equal(out.success, false);
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'INTERNAL_ERROR');
  assert.equal(typeof out.error.message, 'string');
  assert.equal('stack' in out, false);
  assert.equal('details' in out, false);
});

test('missing folderId returns canonical validation error shape', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  const out = ctx.routeAction_('getFolderFiles', { token: login.token }, {});
  assert.equal(out.success, false);
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'VALIDATION_ERROR');
  assert.match(out.error.message, /Missing folderId/);
});


test('auth login returns config error when AUTH_USERS_JSON is missing', () => {
  const ctx = boot();
  ctx.PropertiesService.getScriptProperties().setProperties({}, true);
  const out = ctx.routeAction_('authLogin', { username: 'kyle', password: 'CMF2025' }, {});
  assert.equal(out.success, false);
  assert.equal(out.error.code, 'CONFIG_ERROR');
});

test('drive search returns internal error when ROOT_FOLDER_ID is missing', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.PropertiesService.getScriptProperties().setProperties({
    AUTH_USERS_JSON: JSON.stringify({ kyle: 'CMF2025' }),
    SPREADSHEET_ID: 'TEST_SPREADSHEET_ID'
  }, true);
  const out = ctx.routeAction_('searchFolders', { token: login.token, query: 'x' }, {});
  assert.equal(out.success, false);
  assert.equal(out.error.code, 'INTERNAL_ERROR');
});
