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

test('drive search returns config error when ROOT_FOLDER_ID is missing', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.PropertiesService.getScriptProperties().setProperties({
    AUTH_USERS_JSON: JSON.stringify({ kyle: 'CMF2025' }),
    SPREADSHEET_ID: 'TEST_SPREADSHEET_ID'
  }, true);
  const out = ctx.routeAction_('searchFolders', { token: login.token, query: 'x' }, {});
  assert.equal(out.success, false);
  assert.equal(out.error.code, 'CONFIG_ERROR');
  assert.match(out.error.message, /Missing required config: ROOT_FOLDER_ID/);
});


test('configGet_ prefers Script Properties over legacy constants', () => {
  const ctx = boot();
  ctx.SPREADSHEET_ID = 'LEGACY_SPREADSHEET_ID';
  const out = ctx.configGet_('SPREADSHEET_ID');
  assert.equal(out, 'TEST_SPREADSHEET_ID');
});

test('configGet_ falls back to legacy constants when Script Properties are missing', () => {
  const ctx = boot();
  ctx.SPREADSHEET_ID = 'LEGACY_SPREADSHEET_ID';
  ctx.ROOT_FOLDER_ID = 'LEGACY_ROOT_FOLDER_ID';
  ctx.PropertiesService.getScriptProperties().setProperties({
    AUTH_USERS_JSON: JSON.stringify({ kyle: 'CMF2025' })
  }, true);
  assert.equal(ctx.configGet_('SPREADSHEET_ID'), 'LEGACY_SPREADSHEET_ID');
  assert.equal(ctx.configGet_('ROOT_FOLDER_ID'), 'LEGACY_ROOT_FOLDER_ID');
});

test('getDelta resolves spreadsheet config via shared resolver path', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.PropertiesService.getScriptProperties().setProperties({
    AUTH_USERS_JSON: JSON.stringify({ kyle: 'CMF2025' }),
    ROOT_FOLDER_ID: 'TEST_ROOT_FOLDER_ID',
    SPREADSHEET_ID: 'TEST_SPREADSHEET_ID'
  }, true);
  let openedId = '';
  ctx.SpreadsheetApp.openById = (id) => {
    openedId = id;
    return {
      getSheetByName: () => ({
        getLastColumn: () => 1,
        getRange: () => ({ getValues: () => [['id']] }),
        getLastRow: () => 1,
        getDataRange: () => ({ getValues: () => [['id'], ['D1']] }),
      }),
    };
  };
  const out = ctx.routeAction_('getDelta', { token: login.token }, {});
  assert.equal(out.success, true);
  assert.equal(openedId, 'TEST_SPREADSHEET_ID');
});

test('partner activity action resolves spreadsheet config via shared resolver path', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.PropertiesService.getScriptProperties().setProperties({
    AUTH_USERS_JSON: JSON.stringify({ kyle: 'CMF2025' }),
    ROOT_FOLDER_ID: 'TEST_ROOT_FOLDER_ID',
    SPREADSHEET_ID: 'TEST_SPREADSHEET_ID'
  }, true);
  let openedId = '';
  ctx.SpreadsheetApp.openById = (id) => {
    openedId = id;
    return {
      getSheetByName: () => ({
        getDataRange: () => ({
          getValues: () => [
            ['referer', 'finance_company'],
            ['Alice', 'Lender A']
          ]
        })
      })
    };
  };
  const out = ctx.routeAction_('getPartnerActivitySummary', { token: login.token }, {});
  assert.equal(out.success, true);
  assert.equal(openedId, 'TEST_SPREADSHEET_ID');
});


test('runtimeDiagnostics action returns safe metadata only', () => {
  const ctx = boot();
  const out = ctx.routeAction_('runtimeDiagnostics', {}, {});
  assert.equal(out.success, true);
  assert.equal(typeof out.hasSpreadsheetIdResolved, 'boolean');
  assert.equal(typeof out.spreadsheetIdSource, 'string');
  assert.equal(typeof out.hasRootFolderIdResolved, 'boolean');
  assert.equal(typeof out.rootFolderIdSource, 'string');
  assert.equal(typeof out.canOpenSpreadsheet, 'boolean');
  assert.equal(typeof out.canAccessRootFolder, 'boolean');
  assert.equal(typeof out.hasAuthConfig, 'boolean');
  assert.equal('spreadsheetId' in out, false);
  assert.equal('rootFolderId' in out, false);
  assert.equal('authUsersJson' in out, false);
});

test('router catch preserves backend error message for getDelta failures', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  ctx.getSheet_ = () => {
    throw new Error('Diagnostic failure from getDelta');
  };
  const out = ctx.routeAction_('getDelta', { token: login.token }, {});
  assert.equal(out.success, false);
  assert.equal(out.error.code, 'INTERNAL_ERROR');
  assert.equal(out.error.message, 'Diagnostic failure from getDelta');
});

test('getDelta and partner activity both use shared getSpreadsheetId_ resolver', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  let calls = 0;
  ctx.getSpreadsheetId_ = () => {
    calls += 1;
    return 'SHARED_SPREADSHEET';
  };
  ctx.SpreadsheetApp.openById = () => ({
    getSheetByName: (name) => {
      if (name === 'VRNdata') {
        return {
          getDataRange: () => ({
            getValues: () => [
              ['referer', 'finance_company'],
              ['Alice', 'Lender A'],
            ],
          }),
        };
      }
      return {
        getLastColumn: () => 1,
        getRange: () => ({ getValues: () => [['id']] }),
        getLastRow: () => 1,
        getDataRange: () => ({ getValues: () => [['id'], ['D1']] }),
      };
    },
  });

  const a = ctx.routeAction_('getDelta', { token: login.token }, {});
  const b = ctx.routeAction_('getPartnerActivitySummary', { token: login.token }, {});
  assert.equal(a.success, true);
  assert.equal(b.success, true);
  assert.ok(calls >= 2);
});

test('searchFolders uses shared ROOT_FOLDER_ID resolver helper', () => {
  const ctx = boot();
  const login = ctx.auth_login_plain_('kyle', 'CMF2025');
  let called = 0;
  ctx.getRootFolderId_ = () => {
    called += 1;
    return 'ROOT_OK';
  };
  ctx.Drive = {
    Files: {
      list: () => ({ files: [{ id: 'F1', name: 'Folder One', modifiedTime: '2025-01-01T00:00:00.000Z' }] }),
    },
  };
  const out = ctx.routeAction_('searchFolders', { token: login.token, query: 'one' }, {});
  assert.equal(out.success, true);
  assert.equal(called, 1);
  assert.ok(Array.isArray(out.folders));
});

test('batchUpdate matches by sourceSheet fallback when id and vrn are missing', () => {
  const ctx = boot();

  const headers = ['id', 'vrn', 'sourceSheet', 'customerName'];
  const rows = [['', '', 'SRC-42', 'Before']];
  const writes = [];

  function makeRange(row, col, numRows, numCols) {
    return {
      getValues: () => {
        if (row === 1 && numRows === 1) return [headers.slice(col - 1, col - 1 + numCols)];
        if (row >= 2) {
          const start = row - 2;
          return rows
            .slice(start, start + numRows)
            .map((r) => r.slice(col - 1, col - 1 + numCols));
        }
        return [[]];
      },
      setValues: (vals) => {
        writes.push({ row, col, numRows, numCols, vals });
        if (row >= 2 && numRows === 1 && vals && vals[0]) {
          rows[row - 2] = vals[0].slice();
        }
        return true;
      },
      getValue: () => {
        const data = this.getValues();
        return data && data[0] ? data[0][0] : '';
      },
    };
  }

  const sheet = {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange: (row, col, numRows, numCols) => makeRange(row, col, numRows, numCols),
  };

  const out = ctx.batchUpdate_(sheet, [{ sourceSheet: 'SRC-42', customerName: 'After' }]);
  assert.equal(out.success, true);
  assert.equal(out.updated, 1);
  assert.equal(out.skipped, 0);
  assert.equal(writes.length, 1);
  assert.equal(rows[0][3], 'After');
});
