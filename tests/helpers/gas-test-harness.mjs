import fs from 'node:fs';
import vm from 'node:vm';

function createCacheStore() {
  const store = new Map();
  return {
    get(key) {
      const rec = store.get(String(key));
      if (!rec) return null;
      if (rec.exp && Date.now() > rec.exp) {
        store.delete(String(key));
        return null;
      }
      return rec.value;
    },
    put(key, value, ttlSeconds) {
      const ttl = Number(ttlSeconds || 0);
      const exp = ttl > 0 ? Date.now() + ttl * 1000 : null;
      store.set(String(key), { value: String(value), exp });
    },
    remove(key) {
      store.delete(String(key));
    },
  };
}

export function createGasContext() {
  const scriptCache = createCacheStore();
  const scriptProperties = new Map();
  scriptProperties.set('AUTH_USERS_JSON', JSON.stringify({ kyle: 'CMF2025', admin: 'admin123' }));
  scriptProperties.set('SPREADSHEET_ID', 'TEST_SPREADSHEET_ID');
  scriptProperties.set('ROOT_FOLDER_ID', 'TEST_ROOT_FOLDER_ID');
  scriptProperties.set('JIGSAW_USERNAME', 'TEST_USER');
  scriptProperties.set('JIGSAW_PASSWORD', 'TEST_PASS');
  scriptProperties.set('ONEAUTO_API_KEY', 'TEST_ONEAUTO_KEY');
  const ctx = {
    console,
    Date,
    JSON,
    Math,
    Object,
    String,
    Number,
    Boolean,
    Array,
    RegExp,
    Error,
    setTimeout,
    clearTimeout,
    Utilities: {
      getUuid: () => `uuid-${Math.random().toString(16).slice(2)}`,
    },
    CacheService: {
      getScriptCache: () => scriptCache,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => scriptProperties.get(String(k)) || null,
        setProperties: (obj = {}, deleteAll = false) => {
          if (deleteAll) scriptProperties.clear();
          Object.entries(obj).forEach(([k, v]) => scriptProperties.set(String(k), String(v)));
        },
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => true,
        tryLock: () => true,
        releaseLock: () => true,
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt) => ({
        _txt: String(txt),
        setMimeType() {
          return this;
        },
        getContent() {
          return this._txt;
        },
      }),
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutputFromFile: () => ({ getContent: () => '' }),
      createTemplateFromFile: () => ({
        evaluate: () => ({
          setTitle() {
            return this;
          },
          setXFrameOptionsMode() {
            return this;
          },
        }),
      }),
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'http://example.test' }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => 'tester@example.com' }),
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => ({
          getLastColumn: () => 1,
          getRange: () => ({
            getValues: () => [['id']],
            getValue: () => '',
            setValues: () => true,
          }),
          getLastRow: () => 1,
          getDataRange: () => ({ getValues: () => [['id']] }),
          appendRow: () => true,
          insertSheet: () => ({
            getLastRow: () => 0,
            appendRow: () => true,
            getRange: () => ({ getValues: () => [[]], setValues: () => true }),
            getLastColumn: () => 1,
          }),
        }),
      }),
    },
    DriveApp: {
      getFolderById: () => ({
        getName: () => 'folder',
        getFiles: () => ({
          hasNext: () => false,
          next: () => null,
        }),
      }),
      searchFolders: () => ({
        hasNext: () => false,
        next: () => null,
      }),
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => '{}',
      }),
    },
    Logger: { log: () => {} },
  };
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

export function loadGasRuntime(ctx) {
  const files = [
    'server/shared/config.gs',
    'server/shared/response.gs',
    'server/router/actions.gs',
    'Code.gs',
    'Auth.js',
    'Lenderapi.gs',
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    vm.runInContext(src, ctx, { filename: file });
  }
  return ctx;
}
