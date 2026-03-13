import fs from 'node:fs';
import vm from 'node:vm';

const files = [
  'server/shared/config.gs',
  'server/shared/response.gs',
  'server/router/actions.gs',
  'Code.gs',
  'Auth.js',
  'Lenderapi.gs',
].filter((f) => fs.existsSync(f));

const ctx = {
  console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperties: () => true }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'x' }), openById: () => ({ getSheetByName: () => ({}) }) },
  DriveApp: { getFolderById: () => ({}) },
  Logger: { log: () => {} },
};
ctx.global = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(src, ctx, { filename: file });
  } catch (err) {
    const msg = err && err.stack ? err.stack : String(err);
    console.error(`GAS runtime parse/load failed in ${file}:\n${msg}`);
    process.exit(1);
  }
}

console.log('GAS runtime parse/load validation passed.');
