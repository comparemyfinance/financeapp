// ============================================================
// SHARED CONFIG HELPERS (Wave 1 logical extraction)
// ============================================================

// === Spreadsheet backing store (Deals) ===
const SHEET_NAME = 'Deals';
const PARTNER_ACTIVITY_SHEET_NAME = 'VRNdata';

// Optional legacy fallbacks for pre-Script-Properties deployments.
const LEGACY_SPREADSHEET_ID = '';
const LEGACY_ROOT_FOLDER_ID = '';

// === Runtime toggles (when serving UI from the same Apps Script project) ===
const ENABLE_CACHE_LOCKS = false; // CacheService-based acquire/heartbeat/release
const ENABLE_OPTIMISTIC_LOCK = false; // lastUpdated vs updatedAt conflict check

const CONFIG_DEFAULTS_ = {
  SPREADSHEET_ID: '',
  SHEET_NAME: SHEET_NAME,
  PARTNER_ACTIVITY_SHEET_NAME: PARTNER_ACTIVITY_SHEET_NAME,
  ROOT_FOLDER_ID: '',
};

function getLegacyConfigFallback_(key) {
  try {
    if (key === 'SPREADSHEET_ID') {
      const inlineLegacy = String(LEGACY_SPREADSHEET_ID || '').trim();
      if (inlineLegacy) return inlineLegacy;
      const globalLegacy =
        typeof globalThis !== 'undefined' && globalThis && globalThis.SPREADSHEET_ID
          ? String(globalThis.SPREADSHEET_ID).trim()
          : '';
      if (globalLegacy) return globalLegacy;
      return typeof SPREADSHEET_ID !== 'undefined' ? String(SPREADSHEET_ID || '').trim() : '';
    }
    if (key === 'SHEET_NAME') {
      return typeof SHEET_NAME !== 'undefined' ? String(SHEET_NAME || '').trim() : '';
    }
    if (key === 'PARTNER_ACTIVITY_SHEET_NAME') {
      return typeof PARTNER_ACTIVITY_SHEET_NAME !== 'undefined'
        ? String(PARTNER_ACTIVITY_SHEET_NAME || '').trim()
        : '';
    }
    if (key === 'ROOT_FOLDER_ID') {
      const inlineLegacy = String(LEGACY_ROOT_FOLDER_ID || '').trim();
      if (inlineLegacy) return inlineLegacy;
      const globalLegacy =
        typeof globalThis !== 'undefined' && globalThis && globalThis.ROOT_FOLDER_ID
          ? String(globalThis.ROOT_FOLDER_ID).trim()
          : '';
      if (globalLegacy) return globalLegacy;
      return typeof ROOT_FOLDER_ID !== 'undefined' ? String(ROOT_FOLDER_ID || '').trim() : '';
    }
  } catch (_) {}
  return '';
}


function getConfigResolutionMeta_(key) {
  let scriptProp = '';
  try {
    scriptProp = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
  } catch (_) {}
  if (scriptProp) return { key: key, source: 'script_property', hasValue: true };

  const legacy = String(getLegacyConfigFallback_(key) || '').trim();
  if (legacy) return { key: key, source: 'legacy_constant', hasValue: true };

  const fallbackDefault =
    Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS_, key) && String(CONFIG_DEFAULTS_[key] || '').trim()
      ? 'default'
      : 'missing';
  return { key: key, source: fallbackDefault, hasValue: fallbackDefault !== 'missing' };
}


function configGet_(key, fallback) {
  const fallbackDefault =
    Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS_, key)
      ? CONFIG_DEFAULTS_[key]
      : '';
  const legacyFallback = getLegacyConfigFallback_(key);
  const fb = fallback !== undefined ? fallback : (legacyFallback || fallbackDefault);
  const meta = getConfigResolutionMeta_(key);
  if (meta.source === 'script_property') {
    try {
      const val = String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
      if (val) return val;
    } catch (_) {}
  }
  return String(fb || '').trim();
}

function configBool_(key, defVal) {
  const raw = String(configGet_(key, defVal ? 'true' : 'false'))
    .trim()
    .toLowerCase();
  if (!raw) return !!defVal;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function requireConfig_(keys) {
  const missing = [];
  (keys || []).forEach((k) => {
    const v = String(configGet_(k, '') || '').trim();
    if (!v) missing.push(k);
  });
  if (missing.length)
    throw new Error('Missing required config: ' + missing.join(', '));
}

function getProp_(k) {
  return configGet_(k, '');
}
function boolProp_(k, defVal) {
  return configBool_(k, defVal);
}

function configSetMany_(obj, deleteAllOthers) {
  return PropertiesService.getScriptProperties().setProperties(
    obj || {},
    !!deleteAllOthers,
  );
}

function getSpreadsheetConfigId_() {
  const v = String(configGet_('SPREADSHEET_ID', '') || '').trim();
  return v;
}

function getRootFolderId_() {
  const v = String(configGet_('ROOT_FOLDER_ID', '') || '').trim();
  if (!v) throw new Error('Missing required config: ROOT_FOLDER_ID');
  return v;
}
