/*
IMPORTANT INSTALL NOTE:
- Replace your entire Code.gs with this file (do not paste fragments).
- Ensure there is ONLY ONE doGet() in the project.
- handleWebClientRequest() MUST be top-level (not inside doGet).
*/

/*******************************************************
 * Client CRM Server.gs  —  Web App backend (Optimized + Concurrent-safe)
 * GET  -> returns a bare array of row objects
 * POST -> { action: 'save' | 'delete' | 'batchUpdate' | 'getDelta' }
 *******************************************************/



/**
 * ======================================================================
 * AI-READABLE GUIDE (Do not delete)
 * ======================================================================
 * This Apps Script is deployed as a Web App and serves as the backend API
 * for the CMF CRM front-end.
 *
 * Key principles:
 *  - All responses are JSON via json_({ ... }). Never return HTML from API.
 *  - Concurrency: write operations are wrapped in withLock_(ms, fn).
 *  - Resilience: doPost parses payload safely and returns {success:false}
 *    on errors instead of throwing (prevents front-end white screens).
 *
 * Primary data store:
 *  - Spreadsheet ID: SPREADSHEET_ID
 *  - Main sheet: SHEET_NAME (Deals)
 *
 * API surface (POST actions):
 *  - save                : upsert a deal row
 *  - delete              : delete a deal by id
 *  - batchUpdate         : apply multiple updates
 *  - getDelta            : fetch incremental updates (sync)
 *  - healthCheck         : lightweight connectivity probe
 *  - vrnLookup / payload : VRN / vehicle lookup helpers (if present)
 *  - jigsaw*             : Jigsaw integration actions + webhook handler
 *  - searchFolders       : (Client Files live search) shortlist folders
 *  - getFolderFiles      : (Client Files click) list files for a folder
 *
 * CLIENT FILES (Google Drive) design:
 *  Step 1 (live search):  action='searchFolders', payload={query}
 *      -> returns {success:true, folders:[{id,name,updated}]}
 *  Step 2 (open folder):  action='getFolderFiles', payload={folderId}
 *      -> returns {success:true, folderName, files:[{id,name,url,...}]}
 *  Notes:
 *    - We scope folder search to ROOT_FOLDER_ID to avoid scanning all Drive.
 *    - We return /preview URLs for iframe embedding on the front-end.
 *
 * If you add new actions:
 *  - Add a new case in doPost switch(action)
 *  - Keep payload validation strict (null/undefined safe)
 *  - Wrap Drive/Sheet writes with withLock_ to avoid race conditions
 * ======================================================================
 */
// === Spreadsheet backing store
/**
 * ======================================================================
 * DEPLOYMENT + TROUBLESHOOTING NOTES (AI + Humans)
 * ======================================================================
 *
 * Web App deployment (Apps Script):
 *  - Deploy -> New deployment -> Type: Web app
 *  - Execute as: typically "Me" (service account) so it can read/write Sheets/Drive
 *  - Who has access: choose based on your security model
 *      * "Anyone" (public) is easiest but least secure
 *      * "Anyone with Google account" is common for internal tools
 *
 * Common frontend/network failures:
 *  - "Failed to fetch" (browser): usually CORS/preflight, redirect-to-login,
 *    or the script returning HTML error instead of JSON.
 *    Fix: send POST with Content-Type text/plain (avoids preflight) and ensure
 *    doPost always returns json_({success:false,...}) on errors.
 *
 * Identity notes (updatedBy / locks):
 *  - Session.getActiveUser().getEmail() may be blank depending on deployment
 *    and whether the caller is within a Google Workspace domain.
 *  - Where email isn't reliable, prefer a client-supplied stable id:
 *      payload.clientId / payload.userEmail.
 *
 * Logging:
 *  - This API intentionally keeps responses JSON-only.
 *  - For debugging, prefer:
 *      Logger.log(...) during development
 *      appendJigsawLog_(...) for Jigsaw events
 *    Avoid throwing uncaught errors, because the Web App will emit HTML.
 * ======================================================================
 */

// === Spreadsheet backing store (Deals) ===
const SPREADSHEET_ID = '1V5X_1MIk3VToNTFY7UkEaEs8bkOju7eybjTCkVuFji0';
const SHEET_NAME     = 'Deals';

// === Runtime toggles (when serving UI from the same Apps Script project) ===
// If you are running the CRM UI from HtmlService in this same project, you generally do NOT
// need CacheService heartbeat locks or optimistic lastUpdated conflicts.
const ENABLE_CACHE_LOCKS = false;       // CacheService-based acquire/heartbeat/release
const ENABLE_OPTIMISTIC_LOCK = false;   // lastUpdated vs updatedAt conflict check
 // Main deals table sheet name

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  return sheet;
}

function ensureHeaders_(sheet, keysToInclude) {
  // IMPORTANT: Column creation from payload keys is disabled.
  // This prevents the web app from adding duplicate headers like "VRN", "ID", etc.
  const lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h || '').trim());
}


function canonicalHeader_(h) {
  const key = String(h || '').trim().toLowerCase();
  if (['id', 'deal id', 'dealid'].includes(key)) return 'id';
  if (['vrn', 'vehicle reg', 'vehiclereg', 'vehicle registration', 'registration', 'reg'].includes(key)) return 'vrn';
  if (['updated at', 'updated_at'].includes(key)) return 'updatedAt';
  if (['updated by', 'updated_by'].includes(key)) return 'updatedBy';
  if (['sourcesheet','source sheet','source_sheet','sheet source','source'].includes(key)) return 'sourceSheet';
  return '';
}

function headerIndexMap_(headers) {
  const m = {};
  headers.forEach((h, i) => {
    m[h] = i + 1;
    const c = canonicalHeader_(h);
    if (c && !m[c]) m[c] = i + 1;
  });
  return m;
}


function normVrn_(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}


function rowsToObjects_(headers, rows) {
  return rows.map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (typeof v === 'string' && v) {
          const trimmed = v.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { v = JSON.parse(trimmed); } catch (_) {}
          }
        }
        obj[h] = v;
      });
      return obj;
    }).filter(o => Object.values(o).some(x => String(x || '').trim() !== ''));
}

function objectToRow_(headers, obj) {
  return headers.map(h => {
    let v = obj[h];
    if (v === undefined || v === null) return '';
    if (Object.prototype.toString.call(v) === '[object Date]') return v;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      const looksIsoDate = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
      if ((h === 'receivedDate' || /Date$/.test(h)) && looksIsoDate) {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d;
      }
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
}



// ------------------------------------------------------------
// Row index cache (speedup): maps id/vrn -> row number
// Uses CacheService for fast lookups; auto-rebuilds on mismatch.
// ------------------------------------------------------------
function cacheKey_(suffix) {
  return 'CMFCRM:' + SPREADSHEET_ID + ':' + SHEET_NAME + ':' + suffix;
}

function getRowIndexCache_() {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(cacheKey_('rowIndex'));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function setRowIndexCache_(obj) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(cacheKey_('rowIndex'), JSON.stringify(obj), 300); // 5 minutes
  } catch (e) { /* ignore */ }
}

function invalidateRowIndexCache_() {
  try { CacheService.getScriptCache().remove(cacheKey_('rowIndex')); } catch (e) {}
}

function rebuildRowIndexCache_(sheet, headers) {
  const hmap = headerIndexMap_(headers);
  const ID_COL = hmap['id'] || 7;
  const VRN_COL = hmap['vrn'] || 6;
  const lastRow = sheet.getLastRow();
  const n = Math.max(0, lastRow - 1);
  const idMap = {};
  const vrnMap = {};
  if (n > 0) {
    const ids = sheet.getRange(2, ID_COL, n, 1).getValues();
    const vrns = sheet.getRange(2, VRN_COL, n, 1).getValues();
    for (let i = 0; i < n; i++) {
      const rowNum = 2 + i;
      const id = String(ids[i][0] || '').trim();
      if (id) idMap[id] = rowNum;
      const vrnKey = normVrn_(vrns[i][0]);
      if (vrnKey) vrnMap[vrnKey] = rowNum;
    }
  }
  const obj = { t: Date.now(), lastRow: lastRow, idMap: idMap, vrnMap: vrnMap };
  setRowIndexCache_(obj);
  return obj;
}

function findRowForDeal_(sheet, headers, id, vrnKey) {
  // Try cache first
  let c = getRowIndexCache_();
  const now = Date.now();
  if (!c || !c.idMap || !c.vrnMap || (now - (c.t || 0) > 300000) || (c.lastRow !== sheet.getLastRow())) {
    c = rebuildRowIndexCache_(sheet, headers);
  }

  let rowNum = null;
  if (id && c.idMap && c.idMap[id]) rowNum = c.idMap[id];
  if (!rowNum && vrnKey && c.vrnMap && c.vrnMap[vrnKey]) rowNum = c.vrnMap[vrnKey];

  // Verify row still matches (cache may be stale due to deletes/manual edits)
  if (rowNum) {
    const hmap = headerIndexMap_(headers);
    const ID_COL = hmap['id'] || 7;
    const VRN_COL = hmap['vrn'] || 6;
    try {
      const idCell = String(sheet.getRange(rowNum, ID_COL, 1, 1).getValue() || '').trim();
      const vrnCell = normVrn_(sheet.getRange(rowNum, VRN_COL, 1, 1).getValue());
      const ok = (id && idCell === id) || (vrnKey && vrnCell === vrnKey);
      if (ok) return rowNum;
    } catch (e) {}
    // Cache mismatch -> rebuild once and retry
    c = rebuildRowIndexCache_(sheet, headers);
    rowNum = null;
    if (id && c.idMap && c.idMap[id]) rowNum = c.idMap[id];
    if (!rowNum && vrnKey && c.vrnMap && c.vrnMap[vrnKey]) rowNum = c.vrnMap[vrnKey];
  }

  return rowNum;
}
function loadIndex_(sheet, headers) {
  const hmap = headerIndexMap_(headers);
  const ID_COL = hmap['id'] || 7;      // Column G fallback
  const VRN_COL = hmap['vrn'] || 6;    // Column F fallback
  const SRC_COL = hmap['sourceSheet'] || null;
  const lastRow = sheet.getLastRow();
  const lastCol = headers.length;
  const result = { headers, hmap, idToRow: new Map(), vrnToRow: new Map(), rows: [], objects: [] };
  if (lastRow <= 1) return result;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  result.objects = rowsToObjects_(headers, values);

  const idIdx = hmap['id'] ? (hmap['id'] - 1) : (7 - 1);
  const vrnIdx = hmap['vrn'] ? (hmap['vrn'] - 1) : (6 - 1);
  const srcIdx = hmap['sourceSheet'] ? (hmap['sourceSheet'] - 1) : null;

  for (let i = 0; i < values.length; i++) {
    if (idIdx !== null) {
      const id = String(values[i][idIdx] || '').trim();
      if (id) result.idToRow.set(id, 2 + i);
    }
    if (vrnIdx !== null) {
      const vrn = normVrn_(values[i][vrnIdx]);
      if (vrn) result.vrnToRow.set(vrn, 2 + i);
    }
  }
  return result;
}


/**
 * getRowsData_(sheet)
 * Returns all rows as array of objects keyed by header.
 * Used by getDelta polling.
 */
function getRowsData_(sheet) {
  const headers = ensureHeaders_(sheet, []);
  const idx = loadIndex_(sheet, headers);
  return idx.objects || [];
}



function mergeInto_(existingObj, patchObj) {
  const base = existingObj ? JSON.parse(JSON.stringify(existingObj)) : {};
  Object.keys(patchObj || {}).forEach(k => {
    if (k === 'lastUpdated') return;
    base[k] = patchObj[k];
  });
  base.updatedAt = new Date();
  try { if (Session.getActiveUser) base.updatedBy = Session.getActiveUser().getEmail(); } catch (_) {}
  return base;
}

/**
 * HTTP GET handler.
 * Returns a JSON array of deals (or an index HTML for health checks depending
 * on loadIndex_ usage).
 *
 * AI NOTE: Keep doGet side-effect free (read-only). Any writes should be POST.
 */

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const wantsApiJson = (params.api === '1' || params.format === 'json');

  // GET /exec -> serve the CRM UI (Index.html)
  if (!wantsApiJson) {
    const t = HtmlService.createTemplateFromFile('Index');
    t.serviceUrl = ScriptApp.getService().getUrl();
    return t.evaluate()
      .setTitle('CMF Refi Orchestrator')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // GET /exec?api=1 -> return all deals as JSON (read-only)
  return withLock_(30000, () => {
    const sheet = getSheet_();
    const headers = ensureHeaders_(sheet, []);
    const idx = loadIndex_(sheet, headers);
    return createJsonOutput_(idx.objects);
  });
}


/**
 * Bridge function for internal google.script.run calls.
 * google.script.run cannot invoke doPost/doGet; it calls server functions directly.
 * This returns a plain JS object (NOT a ContentService TextOutput).
 */
function handleWebClientRequest(request) {
  const req = request || {};
  const action = req.action || 'unknown';
  const payload = (req.payload != null) ? req.payload : {};
  const result = routeAction_(action, payload, req);
  // Return JSON string for maximum compatibility with google.script.run
  return safeClientJson_(result);
}

function safeClientJson_(obj) {
  return JSON.stringify(obj, (k, v) => {
    // Convert Dates to ISO strings
    if (v instanceof Date) return v.toISOString();
    return v;
  });
}

/**
 * Shared router used by both doPost (HTTP) and handleWebClientRequest (internal).
 * IMPORTANT: MUST return plain JS objects only.
 */
// ==========================================
// SHARED ROUTER (used by doPost and google.script.run)
// ==========================================
function routeAction_(action, payload, fullRequest) {
  const legacy = fullRequest || {};

  try {
    // ------------------------
    // READ ONLY / FAST ACTIONS
    // ------------------------
    if (action === 'healthCheck') return { success: true, status: 'healthy' };
    // ------------------------
    // AUTH (TOKEN-BASED)
    // ------------------------
    if (action === 'authLogin') {
      const u = payload && payload.username;
      const p = payload && payload.password;
      return auth_login_plain_(u, p);
    }
    if (action === 'authStatus') {
      const chk = auth_check_token_(payload && payload.token);
      return chk.success ? { success: true, loggedIn: true, user: chk.user } : { success: true, loggedIn: false };
    }
    if (action === 'authLogout') {
      return auth_logout_token_(payload && payload.token);
    }

    // Gate everything else
    const auth = auth_check_token_(payload && payload.token);
    if (!auth.success) return auth;

    // ------------------------
    // LENDER API (PLACEHOLDER PREP - READ ONLY)
    // ------------------------
    if (action === 'listLenders') {
      return { success: true, lenders: listLenders_() };
    }
    if (action === 'getLenderQuote') {
      return getLenderQuote(payload || {});
    }
    if (action === 'getLenderQuotesBatch') {
      return getLenderQuotesBatch(payload || {});
    }




    // Cache-based locks
    if (action === 'acquireLock' || action === 'releaseLock' || action === 'heartbeatLock') {
      if (!ENABLE_CACHE_LOCKS) return { success: true, disabled: true };
      return safeObj_(() => handleDealLocking_(legacy));
    }

    // Drive search
    if (action === 'searchFolders') {
      const q = (payload && payload.query != null) ? payload.query : (legacy.query != null ? legacy.query : '');
      return safeObj_(() => searchClientFolders_(q));
    }

    // Folder listing
    if (action === 'getFolderFiles') {
      // Be tolerant: callers may send folderId in various shapes (string payload, nested folder object, etc.)
      let folderId = '';

      // 1) If payload is a string, treat it as the folderId
      if (typeof payload === 'string') folderId = payload;

      // 2) If payload is an object, try common keys
      if (!folderId && payload && typeof payload === 'object') {
        folderId =
          payload.folderId || payload.folder_id || payload.id || payload.driveFolderId ||
          // sometimes payload.folder is an object {id,...} or a string
          (typeof payload.folder === 'string' ? payload.folder : (payload.folder && (payload.folder.id || payload.folder.folderId || payload.folder.driveFolderId))) ||
          // other likely nesting
          (payload.selectedFolder && (payload.selectedFolder.id || payload.selectedFolder.folderId || payload.selectedFolder.driveFolderId)) ||
          (payload.node && (payload.node.id || payload.node.folderId || payload.node.driveFolderId)) ||
          '';
      }

      // 3) Legacy/top-level keys (in case older callers pass folderId outside payload)
      if (!folderId && legacy) {
        folderId =
          legacy.folderId || legacy.folder_id || legacy.id || legacy.driveFolderId ||
          (typeof legacy.folder === 'string' ? legacy.folder : (legacy.folder && (legacy.folder.id || legacy.folder.folderId || legacy.folder.driveFolderId))) ||
          '';
      }

      folderId = String(folderId || '').trim();

      if (!folderId) {
        return { success: false, error: 'Missing folderId', hint: 'Send payload.folderId (or payload.id / payload.folder.id)' };
      }

      return safeObj_(() => getFolderFiles_(folderId));
    }

    // Load / Delta read (treat 'load' as alias for getDelta)
    if (action === 'load' || action === 'getDelta' || action === 'getAll') {
      const sheet = getSheet_();
      const data = getRowsData_(sheet);
      return { success: true, data: data };
    }

    // ------------------------
    // WRITE ACTIONS (LockService)
    // --------------
    // ------------------------
    // JIGSAW (VALIDATE / SUBMIT)
    // NOTE: These actions call external APIs; DO NOT wrap in the global sheet lock.
    // ------------------------
    if (action === 'validateJigsaw' || action === 'validateJigsawReferral') {
      return safeObj_(() => validateJigsawAction_(payload));
    }
    if (action === 'submitJigsaw' || action === 'submitJigsawReferral') {
      return safeObj_(() => submitJigsawAction_(payload));
    }

    return withLock_(30000, () => {
      const sheet = getSheet_();

      if (action === 'save') {
        return safeObj_(() => saveDeal_(sheet, payload));
      }

      if (action === 'delete') {
        return safeObj_(() => deleteDeal_(sheet, payload && payload.id));
      }

      if (action === 'batchUpdate') {
        return safeObj_(() => batchUpdate_(sheet, payload && payload.updates));
      }
      return { success: false, error: 'Unknown action: ' + action };
    });

  } catch (err) {
    return {
      success: false,
      error: String((err && err.message) ? err.message : err),
      details: String(err),
      stack: (err && err.stack) ? String(err.stack) : null,
      action: action
    };
  }
}



/**
 * HTTP POST handler.
 * Expects JSON request body with at least an `action` field.
 *
 * Payload shape (typical):
 *  { action: string, ...otherFields }
 *
 * Returns: json_({ success: boolean, ... })
 *
 * AI NOTE: Add new API actions ONLY via switch(action) below.
 * Wrap any writes with withLock_() to avoid simultaneous edits corrupting rows.
 */

function doPost(e) {
  // Validate POST
  if (!e || !e.postData || !e.postData.contents) {
    return createJsonOutput_({ success: false, error: "Valid POST data required" });
  }

  // Parse Payload
  let request;
  try {
    request = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonOutput_({ success: false, error: "Invalid JSON", details: err.toString() });
  }

  const action = (request && request.action) ? request.action : 'unknown';
  const payload = (request && request.payload) ? request.payload : {};

  // Route and wrap for HTTP
  const result = routeAction_(action, payload, request);
  return createJsonOutput_(result);
}



function saveDeal_(sheet, deal) {

/**
 * SAVE/UPSERT STRATEGY (IMPORTANT)
 * ------------------------------------------------------
 * This backend currently operates in "NO INSERTS" mode:
 *  - If the deal cannot be matched to an existing row, we throw.
 *
 * Matching order:
 *  1) id          (canonical header 'id', fallback col G)
 *  2) vrn         (canonical header 'vrn', fallback col F; normalized)
 *  3) sourceSheet (optional; useful for diagnostics)
 *
 * Optimistic lock:
 *  - Frontend sends deal.lastUpdated (its last known server updatedAt).
 *  - Server compares existingObj.updatedAt against lastUpdated.
 *  - If another user updated more recently, we reject with CONFLICT.
 *  - We allow a small clock/network buffer and (if verifiable) bypass when
 *    the same user did the last update (prevents self-conflicts on rapid saves).
 *
 * NOTE: Session.getActiveUser().getEmail() may be blank in some deployments.
 *       The bypass only triggers when BOTH currentUser and lastUser are present.
 * ------------------------------------------------------
 */
  if (!deal) throw new Error('Missing payload');

  const headers = ensureHeaders_(sheet, Object.keys(deal));
  const hmap = headerIndexMap_(headers);
  const ID_COL = hmap['id'] || 7;      // Column G fallback
  const VRN_COL = hmap['vrn'] || 6;    // Column F fallback
  const SRC_COL = hmap['sourceSheet'] || hmap['sourcesheet'] || null;


  const id = String(deal.id || deal.ID || '').trim();
  const vrnKey = normVrn_(deal.vrn || deal.VRN || '');
  const vrnSpaced = (deal.vrn || deal.VRN || '').toString().trim().toUpperCase();
  const sourceSheetKey = String(deal.sourceSheet || deal.sourcesheet || deal.SourceSheet || '').trim();

  if (!id && !vrnKey && !sourceSheetKey) throw new Error('Missing deal.id (or vrn/sourceSheet fallback)');

  let rowNum = null;
  let existingObj = {};

  // Fast lookup via CacheService index (falls back to rebuild on mismatch)
  rowNum = findRowForDeal_(sheet, headers, id, vrnKey);

  // No inserts allowed
  if (!rowNum) {
    throw new Error('No matching deal found for id "' + id + '"' + (vrnKey ? ' or vrn "' + vrnKey + '"' : '') + (sourceSheetKey ? ' or sourceSheet "' + sourceSheetKey + '"' : ''));
  }
  const vals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  existingObj = rowsToObjects_(headers, [vals])[0];
// Optimistic Lock (optional)
if (ENABLE_OPTIMISTIC_LOCK && deal.lastUpdated && existingObj.updatedAt) {
  const clientT = new Date(deal.lastUpdated).getTime();
  const serverT = new Date(existingObj.updatedAt).getTime();

  // Who is saving vs who last saved (server writes updatedBy in mergeInto_)
  const currentUser = (Session.getActiveUser && Session.getActiveUser().getEmail()) || '';
  const lastUser = String(existingObj.updatedBy || '').trim();

  // Only bypass conflicts if we can actually verify both users
  const canBypassSelfConflict = currentUser && lastUser && (currentUser === lastUser);

  // Increase buffer to 15s; enforce only when not the same verified user
  if (!canBypassSelfConflict && serverT > clientT + 15000) {
    throw new Error(
      "CONFLICT: This deal was updated by " + (lastUser || "another user") + ". Please refresh."
    );
  }
}

  const merged = mergeInto_(existingObj, deal);

  // Ensure the sheet "id" stays populated (prefer existing id; otherwise use incoming id; otherwise vrn fallback)
  if (String(existingObj.id || '').trim()) merged.id = String(existingObj.id).trim();
  else if (id) merged.id = id;
  else merged.id = vrnSpaced || vrnKey;

  const rowVals = objectToRow_(headers, merged);
  sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowVals]);
  // Update row index cache best-effort (keeps subsequent saves fast)
  try {
    const c = getRowIndexCache_() || { t: Date.now(), lastRow: sheet.getLastRow(), idMap: {}, vrnMap: {} };
    c.t = Date.now();
    c.lastRow = sheet.getLastRow();
    if (merged.id) c.idMap[String(merged.id).trim()] = rowNum;
    const vkey = normVrn_(merged.vrn || '');
    if (vkey) c.vrnMap[vkey] = rowNum;
    setRowIndexCache_(c);
  } catch (e) {}

  return { success: true, updated: true, deal: merged };
}


function deleteDeal_(sheet, id) {
  const headers = ensureHeaders_(sheet, []);
  const idx = loadIndex_(sheet, headers);
  const row = idx.idToRow.get(String(id).trim());
  if (!row) return { success: true, deleted: 0 };
  sheet.deleteRow(row);
  invalidateRowIndexCache_();
  return { success: true, deleted: 1, id };
}

function batchUpdate_(sheet, deals) {
  if (!Array.isArray(deals)) throw new Error('payload must be array');

  const keySet = new Set(['id', 'vrn']);
  deals.forEach(d => Object.keys(d || {}).forEach(k => keySet.add(k)));

  const headers = ensureHeaders_(sheet, Array.from(keySet));
  const idx = loadIndex_(sheet, headers);

  const updates = [];
  let skipped = 0;

  deals.forEach(d => {
    if (!d) return;

    const id = String(d.id || d.ID || '').trim();
    const vrn = normVrn_(d.vrn || d.VRN || '');
    const ss = String(d.sourceSheet || d.sourcesheet || d.SourceSheet || '').trim();

    let row = null;

    if (id && idx.idToRow.has(id)) row = idx.idToRow.get(id);
    else if (vrn && idx.vrnToRow && idx.vrnToRow.has(vrn)) row = idx.vrnToRow.get(vrn);
    else if (ss && idx.sourceSheetToRow && idx.sourceSheetToRow.has(ss)) row = idx.sourceSheetToRow.get(ss);

    // No inserts allowed
    if (!row) { skipped++; return; }

    const vals = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    const existing = rowsToObjects_(headers, [vals])[0];

    const merged = mergeInto_(existing, d);

    // Keep / populate id field deterministically
    if (String(existing.id || '').trim()) merged.id = String(existing.id).trim();
    else if (id) merged.id = id;
    else merged.id = vrn;

    const rowVals = objectToRow_(headers, merged);
    updates.push({ row, values: rowVals });
  });

  updates.sort((a, b) => a.row - b.row);
  updates.forEach(u => sheet.getRange(u.row, 1, 1, headers.length).setValues([u.values]));

  return { success: true, created: 0, updated: updates.length, skipped };
}

function getDealsDelta_(sheet, since) {
  const headers = ensureHeaders_(sheet, []);
  const idx = loadIndex_(sheet, headers);
  const sTime = new Date(since).getTime();
  if (isNaN(sTime)) return [];
  return idx.objects.filter(d => {
    if (!d.updatedAt) return true;
    return new Date(d.updatedAt).getTime() > sTime;
  });
}

function dailyArchive() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const src = ss.getSheetByName('Deals');
    let arc = ss.getSheetByName('Archive');
    if (!arc) arc = ss.insertSheet('Archive');
    const data = src.getDataRange().getValues();
    if (data.length < 2) return;
    const h = data[0].map(s => String(s).toLowerCase());
    const sIdx = h.indexOf('dealstage'), dIdx = h.indexOf('updatedat');
    if (sIdx === -1) return;
    const keep = [data[0]], move = [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    for (let i=1; i<data.length; i++) {
      const row = data[i];
      const stage = String(row[sIdx]);
      const date = row[dIdx] ? new Date(row[dIdx]) : new Date();
      if ((stage === 'Completed' || stage === 'Not Taken Up') && date < cutoff) move.push(row);
      else keep.push(row);
    }
    if (move.length) arc.getRange(arc.getLastRow()+1, 1, move.length, data[0].length).setValues(move);
    if (move.length) { src.clearContents(); src.getRange(1, 1, keep.length, data[0].length).setValues(keep); }
  } finally { lock.releaseLock(); }
}

/**
 * json_(obj)
 * Consistent JSON output wrapper.
 * Always use this for responses so the front-end can safely JSON.parse().
 */
function safeObj_(fn) {
  try {
    const out = fn();
    // If a handler accidentally returns a ContentService output, convert to a plain object if possible.
    if (out && typeof out.getContent === 'function') {
      try {
        return JSON.parse(out.getContent());
      } catch (e) {
        return { success: false, error: 'INVALID_OUTPUT', details: 'Handler returned a TextOutput that could not be parsed.' };
      }
    }
    return out;
  } catch (err) {
    return {
      success: false,
      error: 'SERVER_ERROR',
      details: (err && err.message) ? String(err.message) : String(err),
      stack: (err && err.stack) ? String(err.stack) : null
    };
  }
}


/**
 * Run fn under a ScriptLock to serialize writes.
 * Returns fn()'s return value (plain object).
 */
function withLock_(timeoutMs, fn) {
  const lock = LockService.getScriptLock();
  const wait = Math.max(0, Number(timeoutMs) || 30000);
  lock.waitLock(wait);
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function createJsonOutput_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

// Backwards compatibility (HTTP handlers should return createJsonOutput_ at the very end)
function json_(o) { return createJsonOutput_(o); }

/**
 * ======================================================================
 * SOFT DEAL LOCKING (CacheService heartbeat)
 * ======================================================================
 * Purpose:
 *  Prevent two users working the same client/deal at the same time.
 *
 * How it works:
 *  - acquireLock  : reserves LOCK_<dealId> for current user for TTL seconds
 *                  : owner identity uses payload.clientId (preferred) or falls back
 *  - heartbeatLock: renews the TTL (client pings while card is open/dragging)
 *  - releaseLock  : releases if owned by current user
 *
 * Notes:
 *  - CacheService is fast but not a strict mutex; we add a very short
 *    LockService guard to reduce "double-acquire" race windows.
 *  - If Session.getActiveUser().getEmail() is unavailable (common for
 *    consumer accounts / some web app deployments), we fall back to:
 *      payload.userEmail -> req.userEmail -> "unknown"
 * ======================================================================
 */
function getRequestUserEmail_(payload, req) {
  // Best effort: Session email (works for Google Workspace domains)
  try {
    const u = Session.getActiveUser && Session.getActiveUser();
    const email = u && u.getEmail && u.getEmail();
    if (email) return String(email).toLowerCase();
  } catch (_) {}

  // Fallbacks if the front-end can provide it
  const pEmail = payload && (payload.userEmail || payload.email);
  if (pEmail) return String(pEmail).toLowerCase();

  const rEmail = req && (req.userEmail || req.email);
  if (rEmail) return String(rEmail).toLowerCase();

  return 'unknown';
}

function handleDealLocking_(req) {
  const payload = (req && req.payload) ? req.payload : (req || {});
  const dealId = String(payload.dealId || payload.id || payload.dealID || '').trim();
  if (!dealId) return { success: false, error: 'Missing payload.dealId' };

  const cache = CacheService.getScriptCache();
  const lockKey = 'LOCK_' + dealId;
  const clientId = String(payload.clientId || payload.clientID || payload.cid || '').trim() || 'anon';

  // TTL seconds (default 60). Keep it short; UI should heartbeat.
  const ttl = Math.max(10, Math.min(600, Number(payload.ttlSeconds || 60)));

  // Short lock to reduce race window for acquire/heartbeat/release
  const guard = LockService.getScriptLock();
  if (!guard.tryLock(1000)) return { success: false, error: 'Server busy, please try again' };

  try {
    const action = String(req.action || '').trim();

    // ACQUIRE / HEARTBEAT (renew)
    if ((action === 'acquireLock' || action === 'heartbeatLock') && ENABLE_CACHE_LOCKS) {
      const currentOwner = cache.get(lockKey);

      // If locked by someone else
      if (currentOwner && currentOwner !== clientId) {
        return { success: false, error: 'LOCKED', status: 'LOCKED' };
      }

      // Acquire or renew lock
      cache.put(lockKey, clientId, ttl);
      return { success: true, status: (currentOwner ? 'RENEWED' : 'ACQUIRED'), dealId: dealId, ttlSeconds: ttl };
    }

    // RELEASE
    if (action === 'releaseLock' && ENABLE_CACHE_LOCKS) {
      const currentOwner = cache.get(lockKey);
      if (!currentOwner) return { success: true, status: 'NOT_LOCKED', dealId: dealId };

      // Allow release if this user owns it
      if (currentOwner === clientId) {
        cache.remove(lockKey);
        return { success: true, status: 'RELEASED', dealId: dealId };
      }

      // Otherwise, refuse to release someone else's lock
      return { success: false, error: 'LOCKED', status: 'LOCKED' };
    }

    return { success: false, error: 'Invalid locking action: ' + action };
  } finally {
    guard.releaseLock();
  }
}


// ------------------------- Properties helpers
function getProp_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function boolProp_(k, defVal) {
  const v = (getProp_(k) || '').toString().trim().toLowerCase();
  if (!v) return !!defVal;
  return (v === 'true' || v === '1' || v === 'yes');
}


// ------------------------- One-time setup helper (run manually from Apps Script editor)
function setupJigsawUatProperties_() {
  // WARNING: This overwrites existing Script Properties with the supplied values.
  // Set your webhook shared secret before enabling webhooks.
  PropertiesService.getScriptProperties().setProperties({
    JIGSAW_ENV: 'UAT',
    JIGSAW_USERNAME: 'CompareMyFinance',
    JIGSAW_PASSWORD: '349f5611-c408-4e4c-8141-b6705568fa80',
    // JIGSAW_SHARED_SECRET: '<<<SET_ME>>>'
  }, true);
}
function getJigsawBaseUrl_() {
  const env = (getProp_('JIGSAW_ENV') || 'uat').toString().trim().toLowerCase();
  return env === 'prod' || env === 'production'
    ? 'https://gateway.jigsawfinance.com'
    : 'https://gateway-uat.jigsawfinance.com';
}

// ------------------------- Logging sheet
function getLogSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(JIGSAW_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(JIGSAW_LOG_SHEET);
  const headers = ['timestampUtc','event','dealId','introducerReference','jigsawReference','httpStatus','ok','message','request','response'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  if (sh.getLastRow() === 1) {
    const row1 = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    const missing = headers.filter(h => row1.indexOf(h) === -1);
    if (missing.length) {
      sh.getRange(1, sh.getLastColumn()+1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}

function appendJigsawLog_(evt, ctx) {
  try {
    const sh = getLogSheet_();
    const now = new Date();
    const row = [
      now.toISOString(),
      evt || '',
      (ctx && ctx.dealId) || '',
      (ctx && ctx.introducerReference) || '',
      (ctx && ctx.jigsawReference) || '',
      (ctx && ctx.httpStatus) || '',
      (ctx && ctx.ok) ? 'true' : 'false',
      (ctx && ctx.message) || '',
      (ctx && ctx.request) ? safeStringify_(ctx.request) : '',
      (ctx && ctx.response) ? safeStringify_(ctx.response) : ''
    ];
    sh.appendRow(row);
  } catch (err) {
    // Never fail the primary request due to logging.
    Logger.log('appendJigsawLog_ error: ' + err);
  }
}

function safeStringify_(o) {
  try { return JSON.stringify(o); } catch (e) { return String(o); }
}

// ------------------------- VRN cache
function getVrnSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(VRN_CACHE_SHEET);
  if (!sh) sh = ss.insertSheet(VRN_CACHE_SHEET);
  const headers = ['vrn','data','updatedAt'];
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function getVrnData_(vrn) {
  const v = normVrn_(vrn || '');
  if (!v) return null;
  const sh = getVrnSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return null;
  const values = sh.getRange(2,1,lastRow-1,3).getValues();
  for (let i=0;i<values.length;i++) {
    if (normVrn_(values[i][0]) === v) {
      const dataCell = values[i][1];
      if (typeof dataCell === 'string' && dataCell.trim().startsWith('{')) {
        try { return JSON.parse(dataCell); } catch (_) {}
      }
      return dataCell || null;
    }
  }
  return null;
}

function saveVrnData_(vrn, data) {
  const v = normVrn_(vrn || '');
  if (!v) throw new Error('Missing vrn');
  const sh = getVrnSheet_();
  const lastRow = sh.getLastRow();
  const payload = (typeof data === 'object') ? JSON.stringify(data) : String(data || '');
  const now = new Date().toISOString();

  if (lastRow > 1) {
    const vrns = sh.getRange(2,1,lastRow-1,1).getValues().map(r => normVrn_(r[0]));
    const idx = vrns.indexOf(v);
    if (idx !== -1) {
      sh.getRange(2+idx, 2, 1, 2).setValues([[payload, now]]);
      return;
    }
  }
  sh.appendRow([v.toUpperCase(), payload, now]);
}

// ------------------------- Jigsaw auth/token
function getJigsawToken_() {
  const username = getProp_('JIGSAW_USERNAME');
  const password = getProp_('JIGSAW_PASSWORD');
  if (!username || !password) throw new Error('Missing JIGSAW_USERNAME / JIGSAW_PASSWORD in Script Properties');

  const cache = CacheService.getScriptCache();
  const cacheKey = 'jigsaw_token_' + (getProp_('JIGSAW_ENV') || 'uat');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const tokenUrl = getJigsawBaseUrl_() + '/Token';
  const formBody =
    'grant_type=password' +
    '&username=' + encodeURIComponent(username) +
    '&password=' + encodeURIComponent(password);

  const res = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: formBody,
    muteHttpExceptions: true,
  });

  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status < 200 || status >= 300) throw new Error('Jigsaw token request failed: HTTP ' + status + ' ' + text);

  const json = JSON.parse(text);
  if (!json.access_token) throw new Error('Jigsaw token response missing access_token');

  // Token expires quickly (~299s). Cache for a bit less.
  const ttlSeconds = Math.max(60, Math.min(240, Number(json.expires_in || 240)));
  cache.put(cacheKey, json.access_token, ttlSeconds);
  return json.access_token;
}

function jigsawPostJson_(path, payloadObj) {
  const url = getJigsawBaseUrl_() + path;

  // Get a token per request (cached), retry once if 401/403.
  let token = getJigsawToken_();
  let attempt = 0;

  while (attempt < 2) {
    attempt++;
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payloadObj),
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });

    const status = res.getResponseCode();
    const bodyText = res.getContentText();

    if ((status === 401 || status === 403) && attempt === 1) {
      // Clear cache and retry
      CacheService.getScriptCache().remove('jigsaw_token_' + (getProp_('JIGSAW_ENV') || 'uat'));
      token = getJigsawToken_();
      continue;
    }

    return { status, bodyText };
  }

  return { status: 500, bodyText: 'Unexpected auth retry failure' };
}

// ------------------------- Actions
function validateJigsawAction_(payload) {
  const deal = (payload && payload.deal) ? payload.deal : payload;
  const draft = payload && payload.draft ? payload.draft : null;
  if (!deal) return { success:false, error:'Missing payload.deal' };

  const referral = buildJigsawReferralFromDeal_(deal, draft);

  const res = jigsawPostJson_('/api/validateJigsawReferral', referral);
  const parsed = tryParseJson_(res.bodyText);

  // Write back validation status (best-effort)
  withLock_(15000, () => {
    const sheet = getSheet_();
    const dealId = String(deal.id || deal.ID || '').trim();
    if (dealId) {
      updateDealFields_(sheet, dealId, {
        jigsawLastValidatedAt: new Date().toISOString(),
        jigsawValidationStatus: res.status,
        jigsawValidationResult: parsed
      });
    }
  });

  appendJigsawLog_('validate', {
    dealId: String(deal.id || ''),
    introducerReference: String(referral.ReferrerRef || ''),
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: (res.status >= 200 && res.status < 300) ? 'Validated' : 'Validation failed',
    request: referral,
    response: parsed
  });

  return { success: res.status >= 200 && res.status < 300, status: res.status, data: parsed };
}

function submitJigsawAction_(payload) {
  const deal = (payload && payload.deal) ? payload.deal : payload;
  const draft = payload && payload.draft ? payload.draft : null;
  if (!deal) return { success:false, error:'Missing payload.deal' };

  const referral = buildJigsawReferralFromDeal_(deal, draft);
  const alwaysValidate = boolProp_('JIGSAW_ALWAYS_VALIDATE_BEFORE_SUBMIT', true);

  if (alwaysValidate) {
    const v = jigsawPostJson_('/api/validateJigsawReferral', referral);
    const vParsed = tryParseJson_(v.bodyText);
    if (!(v.status >= 200 && v.status < 300)) {
      appendJigsawLog_('submit_blocked_by_validation', {
        dealId: String(deal.id || ''),
        introducerReference: String(referral.ReferrerRef || ''),
        httpStatus: v.status,
        ok: false,
        message: 'Submit blocked by validation errors',
        request: referral,
        response: vParsed
      });
      return { success:false, stage:'validate', status: v.status, data: vParsed };
    }
  }

  const s = jigsawPostJson_('/api/submitJigsawReferral', referral);
  const sParsed = tryParseJson_(s.bodyText);

  // Write-back status
  withLock_(20000, () => {
    const sheet = getSheet_();
    const dealId = String(deal.id || deal.ID || '').trim();
    if (dealId) {
      // We store both IntroducerReference (our ReferrerRef) and any JigsawReference if returned (webhook will also send).
      const writeback = {
        jigsawStatus: (s.status >= 200 && s.status < 300) ? 'Sent' : 'Failed',
        jigsawLastSubmittedAt: new Date().toISOString(),
        jigsawSubmitStatus: s.status,
        jigsawIntroducerReference: String(referral.ReferrerRef || ''),
        jigsawLastSubmitResponse: sParsed
      };
      updateDealFields_(sheet, dealId, writeback);
    }
  });

  appendJigsawLog_('submit', {
    dealId: String(deal.id || ''),
    introducerReference: String(referral.ReferrerRef || ''),
    httpStatus: s.status,
    ok: s.status >= 200 && s.status < 300,
    message: (s.status >= 200 && s.status < 300) ? 'Submitted' : 'Submission failed',
    request: referral,
    response: sParsed
  });

  return { success: s.status >= 200 && s.status < 300, status: s.status, data: sParsed };
}


// ------------------------- Post-submit lifecycle (Further Info + Documents)
//
// IMPORTANT:
// - Exact gateway routes can vary by Jigsaw environment/version.
// - Defaults are provided above, but you can override them via Script Properties:
//
//   JIGSAW_OPEN_REQUESTS_PATH
//   JIGSAW_RESPOND_REQUEST_PATH
//   JIGSAW_AVAILABLE_DOCUMENTS_PATH
//   JIGSAW_GET_DOCUMENT_PATH
//   JIGSAW_UPLOAD_DOCUMENT_RESPONSE_PATH
//
// These actions are *pass-through* wrappers plus simple storage into dedicated sheets
// so the CRM (or admins) can fetch the latest open requests / docs without relying on
// "dynamic column creation" in the Deals sheet.

function getJigsawPath_(propName, defaultPath) {
  const v = (getProp_(propName) || '').toString().trim();
  return v ? v : defaultPath;
}

function ensureJigsawStoreSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  // Best-effort: if headers drift, append any missing at end
  const row1 = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h => String(h||'').trim());
  const missing = headers.filter(h => row1.indexOf(h) === -1);
  if (missing.length) sh.getRange(1, sh.getLastColumn()+1, 1, missing.length).setValues([missing]);
  return sh;
}

function upsertByIntroducerRef_(sheetName, introducerRef, rowObj) {
  if (!introducerRef) return;
  const headers = Object.keys(rowObj || {});
  const sh = ensureJigsawStoreSheet_(sheetName, headers);
  const lastRow = sh.getLastRow();
  const introCol = 1; // introducerReference should be first in our header sets
  if (lastRow <= 1) {
    sh.appendRow(headers.map(h => rowObj[h]));
    return;
  }
  const introVals = sh.getRange(2, introCol, lastRow-1, 1).getValues().map(r => String(r[0]||'').trim());
  const idx = introVals.indexOf(String(introducerRef).trim());
  const rowValues = headers.map(h => rowObj[h]);
  if (idx === -1) sh.appendRow(rowValues);
  else sh.getRange(2+idx, 1, 1, headers.length).setValues([rowValues]);
}

function jigsawFetch_(method, path, payloadObj, opts) {
  const url = getJigsawBaseUrl_() + path;
  let token = getJigsawToken_();
  let attempt = 0;

  const isGet = String(method||'GET').toUpperCase() === 'GET';
  const fetchOpts = {
    method: isGet ? 'get' : 'post',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }
  };

  if (!isGet) {
    fetchOpts.contentType = 'application/json';
    fetchOpts.payload = JSON.stringify(payloadObj || {});
  }

  while (attempt < 2) {
    attempt++;
    const res = UrlFetchApp.fetch(url, fetchOpts);
    const status = res.getResponseCode();

    if ((status === 401 || status === 403) && attempt === 1) {
      CacheService.getScriptCache().remove('jigsaw_token_' + (getProp_('JIGSAW_ENV') || 'uat'));
      token = getJigsawToken_();
      fetchOpts.headers = { Authorization: 'Bearer ' + token };
      continue;
    }

    if (opts && opts.returnBlob) {
      const blob = res.getBlob();
      return {
        status: status,
        contentType: blob.getContentType(),
        filename: blob.getName ? blob.getName() : '',
        base64: Utilities.base64Encode(blob.getBytes())
      };
    }

    const bodyText = res.getContentText();
    return { status: status, bodyText: bodyText };
  }

  return { status: 500, bodyText: 'Unexpected auth retry failure' };
}

function normalizeMsgType_(s) {
  return String(s||'').trim().toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ');
}


function routeJigsawMessageType_(msgType, introducerRef, jigsawRef, evtTimeUtc, webhookBody) {
  const t = normalizeMsgType_(msgType);
  if (!t) return;

  // Variants we handle (case-insensitive):
  // - "Further Information Required" / "FurtherInformationRequired"
  // - "Documents Available" / "DocumentsAvailable"
  // - "Proofs Required" / "ProofsRequired"
  //
  // Other message types are stored via jigsawLastWebhook in Deals and logged, but no follow-up fetch is triggered.
  const nospace = t.replace(/\s+/g, '');

  if (t === 'further information required' || t === 'further info required' || nospace === 'furtherinformationrequired') {
    try { fetchAndStoreOpenRequests_(introducerRef, jigsawRef, msgType, evtTimeUtc); } catch (e) {
      appendJigsawLog_('fetch_open_requests_failed', { introducerReference: introducerRef, httpStatus: 0, ok: false, message: String(e && e.message ? e.message : e), response: webhookBody });
    }
    return;
  }

  if (t === 'documents available' || nospace === 'documentsavailable') {
    try { fetchAndStoreAvailableDocuments_(introducerRef, jigsawRef, msgType, evtTimeUtc); } catch (e) {
      appendJigsawLog_('fetch_documents_failed', { introducerReference: introducerRef, httpStatus: 0, ok: false, message: String(e && e.message ? e.message : e), response: webhookBody });
    }
    return;
  }

  if (t === 'proofs required' || t === 'proof required' || nospace === 'proofsrequired' || nospace === 'proofrequired') {
    try { fetchAndStoreProofRequirements_(introducerRef, jigsawRef, msgType, evtTimeUtc); } catch (e) {
      appendJigsawLog_('fetch_proof_requirements_failed', { introducerReference: introducerRef, httpStatus: 0, ok: false, message: String(e && e.message ? e.message : e), response: webhookBody });
    }
    return;
  }
}


function resolveIntroducerReference_(payload) {
  const p = payload || {};
  const intro = String(p.introducerReference || p.IntroducerReference || p.referrerRef || p.ReferrerRef || '').trim();
  if (intro) return intro;

  // Optional: resolve via dealId by looking for jigsawIntroducerReference in Deals sheet (if column exists)
  const dealId = String(p.dealId || p.id || '').trim();
  if (!dealId) return '';
  try {
    const sheet = getSheet_();
    const headers = ensureHeaders_(sheet, []);
    const hmap = headerIndexMap_(headers);
    const idCol = hmap['id'] || 7;
    const introCol = hmap['jigsawIntroducerReference'] || null;
    if (!introCol) return dealId;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return dealId;
    const idVals = sheet.getRange(2, idCol, lastRow-1, 1).getValues().map(r => String(r[0]||'').trim());
    const idx = idVals.indexOf(dealId);
    if (idx === -1) return dealId;
    const introVal = sheet.getRange(2+idx, introCol, 1, 1).getValue();
    return String(introVal || '').trim() || dealId;
  } catch (e) {
    return dealId;
  }
}

// ----- Fetch + store: Open Further Information Requests
function fetchAndStoreOpenRequests_(introducerRef, jigsawRef, msgType, evtTimeUtc) {
  const path = getJigsawPath_('JIGSAW_OPEN_REQUESTS_PATH', DEFAULT_JIGSAW_OPEN_REQUESTS_PATH);
  const q = (path.indexOf('?') === -1 ? '?' : '&') + 'introducerReference=' + encodeURIComponent(introducerRef);
  const res = jigsawFetch_('GET', path + q, null);
  const parsed = tryParseJson_(res.bodyText);

  upsertByIntroducerRef_(JIGSAW_REQUESTS_SHEET, introducerRef, {
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef||''),
    lastMessageType: String(msgType||''),
    lastEventTimeUtc: String(evtTimeUtc||''),
    fetchedAtUtc: new Date().toISOString(),
    openRequestsJson: safeStringify_(parsed)
  });

  appendJigsawLog_('fetch_open_requests', {
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef||''),
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Fetched open requests',
    response: parsed
  });

  return { status: res.status, data: parsed };
}

function fetchAndStoreProofRequirements_(introducerRef, jigsawRef, msgType, evtTimeUtc) {
  const path = getJigsawPath_('JIGSAW_PROOF_REQUIREMENTS_PATH', DEFAULT_JIGSAW_PROOF_REQUIREMENTS_PATH);
  const q = (path.indexOf('?') === -1 ? '?' : '&') + 'introducerReference=' + encodeURIComponent(introducerRef);
  const res = jigsawFetch_('GET', path + q, null);
  const parsed = tryParseJson_(res.bodyText);

  upsertByIntroducerRef_(JIGSAW_PROOFS_SHEET, introducerRef, {
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef||''),
    lastMessageType: String(msgType||''),
    lastEventTimeUtc: String(evtTimeUtc||''),
    fetchedAtUtc: new Date().toISOString(),
    proofRequirementsJson: safeStringify_(parsed)
  });

  appendJigsawLog_('fetch_proof_requirements', {
    introducerReference: introducerRef,
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Fetched proof requirements',
    request: { introducerReference: introducerRef },
    response: parsed
  });

  return { status: res.status, data: parsed };
}

// ----- Respond to a Proof Requirement / request (payload shapes vary by MessageType + request kind in spec)
function respondProofRequirement_(payload) {
  const body = payload || {};
  const introducerRef = resolveIntroducerReference_(body);
  if (!introducerRef) throw new Error('Missing introducerReference');

  const path = getJigsawPath_('JIGSAW_RESPOND_PROOF_REQUIREMENT_PATH', DEFAULT_JIGSAW_RESPOND_PROOF_REQUIREMENT_PATH);

  // Pass through any structured Data payload (the spec includes request-type specific schemas)
  const postBody = Object.assign({}, body);
  postBody.introducerReference = introducerRef;

  const res = jigsawFetch_('POST', path, postBody);
  const parsed = tryParseJson_(res.bodyText);

  appendJigsawLog_('respond_proof_requirement', {
    introducerReference: introducerRef,
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Responded to proof requirement',
    request: postBody,
    response: parsed
  });

  return { status: res.status, data: parsed };
}

// ----- Respond to a Further Information Request (structured Data payload supported)
function respondToFurtherInfoRequest_(payload) {
  const introducerRef = resolveIntroducerReference_(payload);
  const requestId = payload && (payload.requestId || payload.RequestId || payload.furtherInformationRequestId);
  if (!introducerRef) throw new Error('Missing introducerReference');
  if (!requestId) throw new Error('Missing requestId');

  const path = getJigsawPath_('JIGSAW_RESPOND_REQUEST_PATH', DEFAULT_JIGSAW_RESPOND_REQUEST_PATH);

  // Pass through whatever structure the PDF requires (RequestType/Data/etc.)
  const body = Object.assign({}, payload || {});
  body.introducerReference = introducerRef;
  body.requestId = requestId;

  const res = jigsawFetch_('POST', path, body);
  const parsed = tryParseJson_(res.bodyText);

  appendJigsawLog_('respond_further_info', {
    introducerReference: introducerRef,
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Responded to further information request',
    request: body,
    response: parsed
  });

  return { status: res.status, data: parsed };
}

// ----- Fetch + store: Available documents list
function fetchAndStoreAvailableDocuments_(introducerRef, jigsawRef, msgType, evtTimeUtc) {
  const path = getJigsawPath_('JIGSAW_AVAILABLE_DOCUMENTS_PATH', DEFAULT_JIGSAW_AVAILABLE_DOCUMENTS_PATH);
  const q = (path.indexOf('?') === -1 ? '?' : '&') + 'introducerReference=' + encodeURIComponent(introducerRef);
  const res = jigsawFetch_('GET', path + q, null);
  const parsed = tryParseJson_(res.bodyText);

  upsertByIntroducerRef_(JIGSAW_DOCUMENTS_SHEET, introducerRef, {
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef||''),
    lastMessageType: String(msgType||''),
    lastEventTimeUtc: String(evtTimeUtc||''),
    fetchedAtUtc: new Date().toISOString(),
    documentsJson: safeStringify_(parsed)
  });

  appendJigsawLog_('fetch_documents', {
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef||''),
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Fetched documents list',
    response: parsed
  });

  return { status: res.status, data: parsed };
}

// ----- Download a document (returns base64 so JSON response is safe)
function fetchDocument_(payload) {
  const introducerRef = resolveIntroducerReference_(payload);
  const documentId = payload && (payload.documentId || payload.DocumentId || payload.id);
  if (!introducerRef) throw new Error('Missing introducerReference');
  if (!documentId) throw new Error('Missing documentId');

  const path = getJigsawPath_('JIGSAW_GET_DOCUMENT_PATH', DEFAULT_JIGSAW_GET_DOCUMENT_PATH);
  const q = (path.indexOf('?') === -1 ? '?' : '&') +
    'introducerReference=' + encodeURIComponent(introducerRef) +
    '&documentId=' + encodeURIComponent(String(documentId));

  const res = jigsawFetch_('GET', path + q, null, { returnBlob: true });

  appendJigsawLog_('get_document', {
    introducerReference: introducerRef,
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Fetched document',
    request: { introducerReference: introducerRef, documentId: documentId }
  });

  return res;
}

// ----- Upload a response document (pass-through; supports base64 file payload)
function uploadDocumentResponse_(payload) {
  const introducerRef = resolveIntroducerReference_(payload);
  if (!introducerRef) throw new Error('Missing introducerReference');

  const path = getJigsawPath_('JIGSAW_UPLOAD_DOCUMENT_RESPONSE_PATH', DEFAULT_JIGSAW_UPLOAD_DOCUMENT_RESPONSE_PATH);

  // Pass through (documentId, requestId, fileName, mimeType, base64, etc.)
  const body = Object.assign({}, payload || {});
  body.introducerReference = introducerRef;

  const res = jigsawFetch_('POST', path, body);
  const parsed = tryParseJson_(res.bodyText);

  appendJigsawLog_('upload_document_response', {
    introducerReference: introducerRef,
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    message: 'Uploaded document response',
    request: { introducerReference: introducerRef, documentId: body.documentId || body.DocumentId, fileName: body.fileName || body.FileName },
    response: parsed
  });

  return { status: res.status, data: parsed };
}

// ----- Public CRM actions
function getJigsawOpenRequestsAction_(payload) {
  try {
    const introducerRef = resolveIntroducerReference_(payload);
    if (!introducerRef) return { success:false, error:'Missing introducerReference/dealId' };

    const out = fetchAndStoreOpenRequests_(introducerRef, '', 'manual_fetch', '');
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function getJigsawProofRequirementsAction_(payload) {
  try {
    const introducerRef = resolveIntroducerReference_(payload);
    if (!introducerRef) return { success:false, error:'Missing introducerReference/dealId' };

    const out = fetchAndStoreProofRequirements_(introducerRef, '', 'manual_fetch', '');
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function respondJigsawProofRequirementAction_(payload) {
  try {
    const out = respondProofRequirement_(payload);
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function respondJigsawRequestAction_(payload) {
  try {
    const out = respondToFurtherInfoRequest_(payload);
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function getJigsawAvailableDocumentsAction_(payload) {
  try {
    const introducerRef = resolveIntroducerReference_(payload);
    if (!introducerRef) return { success:false, error:'Missing introducerReference/dealId' };

    const out = fetchAndStoreAvailableDocuments_(introducerRef, '', 'manual_fetch', '');
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function getJigsawDocumentAction_(payload) {
  try {
    const out = fetchDocument_(payload);
    return { success: out.status >= 200 && out.status < 300, status: out.status, contentType: out.contentType, filename: out.filename, base64: out.base64 };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}

function uploadJigsawDocumentResponseAction_(payload) {
  try {
    const out = uploadDocumentResponse_(payload);
    return { success: out.status >= 200 && out.status < 300, status: out.status, data: out.data };
  } catch (e) {
    return { success:false, error:String(e && e.message ? e.message : e) };
  }
}


// ------------------------- Webhook handling
function handleJigsawWebhook_(e, bodyObj, rawBody) {
  // Try to access signature from headers (if available), query params, or JSON body.
  const sig = getInboundSignature_(e, bodyObj);

  const secret = getProp_('JIGSAW_SHARED_SECRET');
  if (!secret) {
    appendJigsawLog_('webhook_rejected', { httpStatus: 500, ok:false, message:'Missing JIGSAW_SHARED_SECRET' });
    return { success:false, error:'Server missing JIGSAW_SHARED_SECRET' };
  }

  if (!sig) {
    // We cannot validate without a signature. If your deployment does not expose e.headers,
    // use a proxy to forward the JF-SIGNATURE header into query param `sig`.
    appendJigsawLog_('webhook_rejected', { httpStatus: 401, ok:false, message:'Missing signature (sig)' , response: bodyObj });
    return { success:false, error:'Missing signature. Provide as query param sig=... (or JSON JfSignature).' };
  }

  const expectedHex = hmacSha512Hex_(secret, rawBody);
  const expectedB64 = hmacSha512Base64_(secret, rawBody);

  const sigNorm = String(sig).trim();
  const ok = equalsSig_(sigNorm, expectedHex) || equalsSig_(sigNorm, expectedB64);

  if (!ok) {
    appendJigsawLog_('webhook_rejected', { httpStatus: 401, ok:false, message:'Signature mismatch', response: bodyObj });
    return { success:false, error:'Invalid signature' };
  }

  const introducerRef = String(bodyObj.IntroducerReference || bodyObj.introducerReference || '').trim();
  const jigsawRef = bodyObj.JigsawReference || bodyObj.jigsawReference || '';
  const msgType = String(bodyObj.MessageType || bodyObj.messageType || '').trim();
  const evtTime = String(bodyObj.EventTimeUtc || bodyObj.eventTimeUtc || '').trim();

  // MessageType-specific follow-up (best-effort): fetch open requests / documents lists and store to dedicated sheets.
  try { routeJigsawMessageType_(msgType, introducerRef, jigsawRef, evtTime, bodyObj); } catch (err) {
    appendJigsawLog_('webhook_followup_failed', { introducerReference: introducerRef, ok:false, message:String(err && err.message ? err.message : err), response: bodyObj });
  }

  // Writeback: locate the deal by jigsawIntroducerReference first, then by id.
  withLock_(20000, () => {
    const sheet = getSheet_();
    const dealId = findDealIdByIntroducerReference_(sheet, introducerRef) || introducerRef;

    if (dealId) {
      updateDealFields_(sheet, dealId, {
        jigsawStatus: 'Update: ' + msgType,
        jigsawReference: jigsawRef,
        jigsawIntroducerReference: introducerRef,
        jigsawLastEventTimeUtc: evtTime,
        jigsawLastMessageType: msgType,
        jigsawLastWebhook: bodyObj
      });
    }
  });

  appendJigsawLog_('webhook', {
    dealId: '',
    introducerReference: introducerRef,
    jigsawReference: String(jigsawRef),
    httpStatus: 200,
    ok: true,
    message: 'Webhook processed: ' + msgType,
    response: bodyObj
  });

  return { success:true };
}

function getInboundSignature_(e, bodyObj) {
  // 1) Headers (if ever supported by deployment)
  const headers = (e && e.headers) ? e.headers : null;
  if (headers) {
    const candidates = [
      headers['JF-SIGNATURE'], headers['JF-Signature'], headers['jf-signature'],
      headers['Jf-Signature'], headers['Jf-SIGNATURE']
    ].filter(Boolean);
    if (candidates.length) return candidates[0];
  }

  // 2) Query params (recommended for Apps Script web app deployments)
  const p = (e && e.parameter) ? e.parameter : {};
  if (p.sig) return p.sig;
  if (p.signature) return p.signature;
  if (p.jf_signature) return p.jf_signature;
  if (p.jfSignature) return p.jfSignature;

  // 3) JSON body fallback (if your proxy injects it)
  return bodyObj.JfSignature || bodyObj.jfSignature || bodyObj.signature || null;
}

function hmacSha512Hex_(secret, msg) {
  const sigBytes = Utilities.computeHmacSha512Signature(msg, secret);
  return sigBytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
function hmacSha512Base64_(secret, msg) {
  const sigBytes = Utilities.computeHmacSha512Signature(msg, secret);
  return Utilities.base64Encode(sigBytes);
}
function equalsSig_(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// ------------------------- Deal writeback helpers
function updateDealFields_(sheet, dealId, fields) {
  if (!dealId) return;
  const headers = ensureHeaders_(sheet, Object.keys(fields).concat(['id']));
  const idx = loadIndex_(sheet, headers);
  const rowNum = idx.idToRow.get(String(dealId).trim());
  if (!rowNum) return;

  const rowVals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const existing = rowsToObjects_(headers, [rowVals])[0] || {};
  const merged = mergeInto_(existing, fields);
  merged.updatedAt = new Date().toISOString();

  sheet.getRange(rowNum, 1, 1, headers.length).setValues([objectToRow_(headers, merged)]);
}

function findDealIdByIntroducerReference_(sheet, introducerRef) {
  const ref = String(introducerRef || '').trim();
  if (!ref) return null;
  const headers = ensureHeaders_(sheet, ['id', 'jigsawIntroducerReference']);
  const hmap = headerIndexMap_(headers);
  const col = hmap['jigsawIntroducerReference'];
  const idCol = hmap['id'] || 7;
  if (!col) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const refVals = sheet.getRange(2, col, lastRow-1, 1).getValues();
  for (let i=0;i<refVals.length;i++) {
    if (String(refVals[i][0] || '').trim() === ref) {
      const idVal = sheet.getRange(2+i, idCol, 1, 1).getValue();
      return String(idVal || '').trim() || null;
    }
  }
  return null;
}

// ------------------------- Build Jigsaw referral from CMF deal
function buildJigsawReferralFromDeal_(deal, draft) {
  const d = deal || {};
  const fd = (d.formData && typeof d.formData === 'object') ? d.formData : d;

  const referrerRefRaw =
    (draft && (draft.ReferrerRef || draft.referrerRef)) ||
    d.jigsawIntroducerReference ||
    d.referrerRef ||
    d.id || d.ID || '';

  let ReferrerRef = sanitizeIntroducerReference_(String(referrerRefRaw || ''));
  ReferrerRef = ensureCmfReferrerRef_(ReferrerRef, d);

  // Applicant basics
  const titleVal = mapTitle_(pick_(fd, ['title','Title','applicantTitle','salutation']));
  const genderVal = mapGender_(pick_(fd, ['gender','Gender']), titleVal);
  const firstName = str_(pick_(fd, ['firstName','FirstName','forename','forename1']));
  const middleNames = str_(pick_(fd, ['middleNames','MiddleNames']));
  const lastName = str_(pick_(fd, ['lastName','LastName','surname']));
  const dobIso = normalizeDateIso_(pick_(fd, ['dob','dateOfBirth','DateOfBirth','DOB']));
  const maritalStatus = mapMaritalStatus_(pick_(fd, ['maritalStatus','MaritalStatus']));
  const dependants = num_(pick_(fd, ['dependants','Dependants']), 0);
  const drivingLicenceType = (function(){
    const v = num_(pick_(fd, ['drivingLicenceType','drivingLicense','drivingLicence','DrivingLicenceType','DrivingLicence']), 1);
    // Jigsaw enum: 1..5
    if (!Number.isFinite(v)) return 1;
    if (v < 1) return 1;
    if (v > 5) return 5;
    return v;
  })();

// Income: accept CMF payload naming (monthlyTakeHomePay) and default frequency accordingly
let income = num_(pick_(fd, ['income','annualIncome','Income']), null);
let incomeFreq = mapIncomeFrequencyType_(pick_(fd, ['incomeFrequencyType','incomeFrequency','IncomeFrequencyType']), null);

// If no explicit income supplied, fall back to CMF monthly take-home pay
if (income === null || income === undefined) {
  const mth = num_(pick_(fd, ['monthlyTakeHomePay','monthlyIncome','netMonthlyIncome','takeHomePayMonthly']), null);
  if (mth !== null && mth !== undefined) {
    income = mth;
    // NetMonthlyIncome = 3 (per Jigsaw enum)
    if (incomeFreq === null || incomeFreq === undefined) incomeFreq = 3;
  }
}

// Final default if still unset: GrossAnnualIncome = 0
if (incomeFreq === null || incomeFreq === undefined) incomeFreq = 0;

const mobile = normalizeUkPhone_(pick_(fd, ['mobile','Mobile','phone','Phone']));
const email = str_(pick_(fd, ['email','Email']));

  const currentAddr = buildResidentialAddress_(fd, 'current');
  const totalMonthsAtCurrent = (num_(currentAddr.YearsAtAddress, 0) * 12) + num_(currentAddr.MonthsAtAddress, 0);
  const previousAddr = (totalMonthsAtCurrent < 36) ? buildResidentialAddress_(fd, 'previous') : null;

  // Employment
  const currentEmp = buildEmployment_(fd, 'current');
  const totalMonthsAtEmp = (num_(currentEmp.YearsInEmployment, 0) * 12) + num_(currentEmp.MonthsInEmployment, 0);
  const previousEmp = (totalMonthsAtEmp < 36) ? buildEmployment_(fd, 'previous') : null;

  // Server-side UAT safety: durations must not be 0, and history must cover >= 36 months where required.
  if (totalMonthsAtCurrent < 1) throw new Error('CurrentAddress: YearsAtAddress/MonthsAtAddress must total at least 1 month.');
  if (totalMonthsAtCurrent < 36) {
    if (!previousAddr) throw new Error('PreviousAddress is required when current address is less than 36 months.');
    const prevMonths = (num_(previousAddr.YearsAtAddress, 0) * 12) + num_(previousAddr.MonthsAtAddress, 0);
    if (prevMonths < 1) throw new Error('PreviousAddress: YearsAtAddress/MonthsAtAddress must total at least 1 month.');
    if ((totalMonthsAtCurrent + prevMonths) < 36) {
      throw new Error('Address history must cover at least 36 months (current + previous). Increase previous address duration or provide additional history.');
    }
  }

  if (totalMonthsAtEmp < 1) throw new Error('CurrentEmployment: YearsInEmployment/MonthsInEmployment must total at least 1 month.');
  if (totalMonthsAtEmp < 36) {
    if (!previousEmp) throw new Error('PreviousEmployment is required when current employment is less than 36 months.');
    const prevEmpMonths = (num_(previousEmp.YearsInEmployment, 0) * 12) + num_(previousEmp.MonthsInEmployment, 0);
    if (prevEmpMonths < 1) throw new Error('PreviousEmployment: YearsInEmployment/MonthsInEmployment must total at least 1 month.');
    if ((totalMonthsAtEmp + prevEmpMonths) < 36) {
      throw new Error('Employment history must cover at least 36 months (current + previous). Increase previous employment duration or provide additional history.');
    }
  }


  // Consent
  const fairProcessingConfirmed = computeFairProcessing_(fd);

  // Vehicle & Finance
  const vehFin = buildVehicleAndFinance_(fd, d);

  const referral = {
    ReferrerRef: ReferrerRef,
    ReferralType: 0,        // Proposal
    IsBusiness: false,      // CMF non-business via API
    MainApplicant: {
      Title: titleVal,
      Gender: genderVal,
      FirstName: firstName,
      MiddleNames: middleNames || null,
      LastName: lastName,
      DateOfBirth: dobIso,
      MaritalStatus: maritalStatus,
      Dependants: dependants,
      DrivingLicenceType: drivingLicenceType,
      DrivingLicence: drivingLicenceType,
      Income: income,
      IncomeFrequencyType: incomeFreq,
      Mobile: mobile || null,
      Email: email || null,
      CurrentAddress: currentAddr,
      PreviousAddress: previousAddr,
      CurrentEmployment: currentEmp,
      PreviousEmployment: previousEmp,
      FairProcessingNoticeConfirmed: fairProcessingConfirmed
    },
    VehicleAndFinance: vehFin
  };

  // Optional proposal-source fields if provided by UI
  const src = (draft && (draft.ProposalSource || draft.proposalSource)) || fd.proposalSource || null;
  if (src && typeof src === 'object') {
    // Only attach known keys to avoid random payload bloat
    ['Referrer','LandingPage','Campaign','Medium','Source','Gclid','Fbclid','IpAddress','UserAgent'].forEach(k => {
      if (src[k] !== undefined && src[k] !== null && src[k] !== '') referral[k] = src[k];
    });
  }

  // Optional TargetLender if present
  const targetLender = (draft && (draft.TargetLender || draft.targetLender)) || fd.targetLender;
  if (targetLender !== undefined && targetLender !== null && targetLender !== '') referral.TargetLender = targetLender;

  // Minimal required-field checks (hard fail early; Jigsaw validate will also catch others)
  const missing = [];
  if (!referral.ReferrerRef) missing.push('ReferrerRef');
  if (!referral.MainApplicant.FirstName) missing.push('MainApplicant.FirstName');
  if (!referral.MainApplicant.LastName) missing.push('MainApplicant.LastName');
  if (!referral.MainApplicant.DateOfBirth) missing.push('MainApplicant.DateOfBirth');
  if (!referral.MainApplicant.Title) missing.push('MainApplicant.Title');
  if (!referral.MainApplicant.Gender) missing.push('MainApplicant.Gender');
  if (!referral.MainApplicant.MaritalStatus) missing.push('MainApplicant.MaritalStatus');
  if (!referral.MainApplicant.CurrentAddress || !referral.MainApplicant.CurrentAddress.PostalCode) missing.push('MainApplicant.CurrentAddress.PostalCode');
  if (!referral.VehicleAndFinance || !referral.VehicleAndFinance.VehicleDescription || !referral.VehicleAndFinance.VehicleDescription.VRM) missing.push('VehicleAndFinance.VehicleDescription.VRM');

  if (missing.length) throw new Error('Missing required fields for Jigsaw: ' + missing.join(', '));

  return referral;
}

// ------------------------- Builders / Mappers
function buildResidentialAddress_(fd, which) {
  const prefix = (which === 'previous') ? 'previous' : 'current';
  // Try common keys
  let house = str_(pick_(fd, [prefix+'House', prefix+'HouseNameNumber', prefix+'HouseNumber', prefix+'HouseName']));
  let street = str_(pick_(fd, [prefix+'Street', prefix+'Address1', prefix+'AddressLine1', prefix+'Line1']));

  // If HouseNameNumber is missing but the CRM has put "house number + street" into AddressLine1,
  // split it so Jigsaw gets a HouseNameNumber (required by validator).
  if (!house && street) {
    const s = String(street).trim();
    const m = /^([0-9]+[A-Za-z]?)\s+(.+)$/.exec(s);
    if (m) {
      house = m[1];
      street = m[2];
    }
  }
  const city = str_(pick_(fd, [prefix+'City', prefix+'Town']));
  const county = str_(pick_(fd, [prefix+'County']));
  const postcode = str_(pick_(fd, [prefix+'Postcode', prefix+'PostalCode', prefix+'Zip']));
  const ym = normalizeYearsMonths_(
    pick_(fd, [prefix+'YearsAtAddress', prefix+'AddressYears', prefix+'Years']),
    pick_(fd, [prefix+'MonthsAtAddress', prefix+'AddressMonths', prefix+'Months'])
  );
  const years = ym.years;
  const months = ym.months;
  const resStatus = mapResidentialStatus_(pick_(fd, [prefix+'ResidentialStatus','residentialStatus','ResidentialStatus']), 1);

  return {
    ResidentialStatus: resStatus,
    HouseNameNumber: house || null,
    Street: street || null,
    City: city || null,
    County: county || null,
    PostalCode: postcode || null,
    YearsAtAddress: years,
    MonthsAtAddress: months
  };
}

function buildEmployment_(fd, which) {
  const prefix = (which === 'previous') ? 'previousEmployment' : 'employment';
  const status = mapEmploymentStatus_(pick_(fd, [prefix+'Status', 'employmentStatus', 'EmploymentStatus']), 1);
  const jobTitle = str_(pick_(fd, [prefix+'JobTitle', prefix+'Occupation', 'previousOccupation', 'occupation', 'jobTitle']));
  const company = str_(pick_(fd, [prefix+'Company','companyName','employerName']));
  const phone = normalizeUkPhone_(pick_(fd, [prefix+'Phone','workPhone','employerPhone']));
const ym = normalizeYearsMonths_(pick_(fd, [prefix+'Years','yearsAtEmployment','YearsInEmployment']), pick_(fd, [prefix+'Months','monthsAtEmployment','MonthsInEmployment']));
  const years = ym.years;
  const months = ym.months;

  // Address fields (fallback to applicant current city per CMF notes)
  const city = str_(pick_(fd, [prefix+'City'])) || str_(pick_(fd, ['currentCity','currentTown'])) || null;

  return {
    EmploymentStatus: status,
    JobTitle: jobTitle || null,
    CompanyName: company || null,
    ContactNumber: phone || null,
    City: city,
    YearsInEmployment: years,
    MonthsInEmployment: months
  };
}

function buildVehicleAndFinance_(fd, deal) {
  const financeType = pick_(fd, ['financeProductType','financeType','productType','FinanceProductType']);
  const FinanceProductType = mapFinanceProductType_(financeType, 0);

  const Deposit = 0; // Refinance-only: ignore payload deposit
const _termRaw = num_(pick_(fd, ['term','Term']), 0);
  const Term = (Number(_termRaw) || 0) + 1;
// CMF notes: refinance indicator presumed TRUE
  const IsRefinance = true;

  // Advance: for refinance flows this should be the settlement amount (payload field: settlementTotal)
  const advance = num_(pick_(fd, [
    'settlementTotal',
    'settlementAmount',
    'settlement',
    'settlementBalance',
    'settlementOutstanding',
    'outstandingSettlement',
    'advance','Advance',
    'amountToFinance',
    'financeAmount',
    'loanAmount'
  ]), null);

  const vrm = str_(pick_(fd, ['vrn','VRN','vrm','VRM'])) || str_(pick_(deal || {}, ['vrn','VRN'])) || '';
  const regDate = normalizeDateIso_(pick_(fd, ['registrationDate','RegistrationDate','regDate']));
  const capCode = str_(pick_(fd, ['capVehicleCode','CAPVehicleCode','capCode']));
  const mileage = num_(pick_(fd, ['vehicleCurrentMileage','currentMileage','mileage','CurrentMileage']), null);
  // AnnualMileage (Jigsaw int? min 1)
  const annualMileage = num_(pick_(fd, ['annualMileage','AnnualMileage','annualMiles','milesPerYear']), null);
  const vin = str_(pick_(fd, ['vin','VIN','ChassisNumberOrVin','chassisNumber']));

  // Vehicle make/model/derivative mapping (required by Jigsaw)
  const manufacturer = str_(pick_(fd, [
    'vehicleManufacturer',
    'manufacturer',
    'make',
    'vehicleMake',
    'VehicleMake',
    'VehicleManufacturer'
  ])) || '';

  const modelRaw = str_(pick_(fd, ['vehicleModel','model','VehicleModel','Model'])) || '';
  let derivative = str_(pick_(fd, ['vehicleDerivative','derivative','VehicleDerivative','Derivative'])) || '';

  // If derivative missing but model contains both model + derivative:
  // first 3 words -> Model, remainder -> Derivative
  let model = modelRaw;
  if (modelRaw) {
    const parts = modelRaw.trim().split(/\s+/).filter(Boolean);

    if (!derivative && parts.length > 3) {
      model = parts.slice(0, 3).join(' ');
      const remainder = parts.slice(3).join(' ');
      if (remainder) derivative = remainder;
    }

    // Failsafe: if derivative still empty, use last 2 words of MODEL (or the full model if only 1 word)
    if (!derivative) {
      if (parts.length >= 2) derivative = parts.slice(-2).join(' ');
      else if (parts.length === 1) derivative = parts[0];
    }
  }

  // CMF notes: always presume used + car
  const VehicleCondition = 0; // Used
  const VehicleType = 1;      // Car

  const VehicleDescription = {
    VehicleCondition: VehicleCondition,
    VehicleType: VehicleType,
    VRM: vrm,
  };

  if (manufacturer) VehicleDescription.Manufacturer = manufacturer;
  if (model) VehicleDescription.Model = model;
  if (derivative) VehicleDescription.Derivative = derivative;
  if (regDate) VehicleDescription.RegistrationDate = regDate;
  if (capCode) VehicleDescription.CAPVehicleCode = capCode;
  if (mileage !== null) VehicleDescription.CurrentMileage = mileage;
  if (vin) VehicleDescription.ChassisNumberOrVin = vin;

  const VehicleAndFinance = {
    FinanceProductType: FinanceProductType,
    Deposit: Deposit,
    Term: Term,
    IsRefinance: IsRefinance,
    BasicFinance: {},
    VehicleDescription: VehicleDescription
  };

  if (annualMileage !== null && annualMileage > 0) VehicleAndFinance.AnnualMileage = Math.round(annualMileage);

  // Do not send zero/negative values (Jigsaw rejects <= 0)
  if (advance !== null && advance > 0) VehicleAndFinance.BasicFinance.Advance = advance;

  // Annual mileage is required by Jigsaw (int, min 1) for most products
  if (annualMileage !== null && annualMileage > 0) VehicleAndFinance.AnnualMileage = annualMileage;

  return VehicleAndFinance;
}

function computeFairProcessing_(fd) {
  // CMF notes: consent terms already exist; if present and true -> confirm, otherwise default TRUE per CMF flow
  const v = pick_(fd, ['consentTerms','ConsentTerms','fairProcessingNoticeConfirmed','FairProcessingNoticeConfirmed','privacyConsent']);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return true;
}

// ------------------------- Primitive helpers
function pick_(obj, keys) {
  if (!obj) return null;
  for (let i=0;i<keys.length;i++) {
    const k = keys[i];
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return null;
}
function str_(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }

// Ensure UK-style contact numbers always start with 0.
// - Trims, removes non-digits (keeps leading + only for country-code handling)
// - Converts +44xxxxxxxxxx or 44xxxxxxxxxx to 0xxxxxxxxxx
// - Otherwise prefixes a leading 0 when missing
function normalizeUkPhone_(v) {
  const s = str_(v);
  if (!s) return '';
  let t = s.replace(/\s+/g, '');
  if (t[0] === '+') t = '+' + t.slice(1).replace(/\D/g, '');
  else t = t.replace(/\D/g, '');
  if (!t) return '';
  if (t.startsWith('0')) return t;
  if (t.startsWith('+44')) return '0' + t.slice(3);
  if (t.startsWith('44')) return '0' + t.slice(2);
  return '0' + t;
}

function num_(v, defVal) {
  if (v === undefined || v === null || v === '') return defVal;
  const n = Number(v);
  return isNaN(n) ? defVal : n;
}

function tryParseJson_(txt) {
  if (txt === undefined || txt === null) return null;
  if (typeof txt !== 'string') return txt;
  const t = txt.trim();
  if (!t) return null;
  try { return JSON.parse(t); } catch (_) { return t; }
}

function sanitizeIntroducerReference_(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  // Keep it <= 40 chars. Prefer a stable deterministic format.
  // If it's longer, hash it.
  if (raw.length <= 40) return raw;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  const hex = bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  return hex.slice(0, 40);
}

// Ensure ReferrerRef is always CMF + 20 (A–Z0–9). If invalid/missing, generate deterministically from deal id/vrn.
function ensureCmfReferrerRef_(referrerRef, deal) {
  const s = String(referrerRef || '').trim().toUpperCase();
  if (/^CMF[A-Z0-9]{37}$/.test(s)) return s;
  return makeCmfReferrerRef_(deal);
}

function makeCmfReferrerRef_(deal) {
  const d = deal || {};
  const id = String(d.id || d.ID || d.dealId || d.DealId || '').trim();
  const vrn = String(d.vrn || d.VRN || '').trim().toUpperCase().replace(/\s/g, '');
  const created = String(d.createdAt || d.CreatedAt || d.created || '').trim();
  // Deterministic where possible (id/vrn), but still generates a unique value if both are missing.
  let seed = [id, vrn, created].filter(Boolean).join('|');
  if (!seed) seed = Utilities.getUuid() + '|' + new Date().toISOString();

  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_512, seed, Utilities.Charset.UTF_8);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'CMF';
  // Total length must be 40, starting with 'CMF' => append 37 chars
  for (let i = 0; i < 37; i++) {
    const b = bytes[i] & 0xff;
    out += alphabet[b % alphabet.length];
  }
  return out;
}

// Normalize years/months so months is 0..11 and years absorbs overflow
function normalizeYearsMonths_(years, months) {
  let y = num_(years, 0);
  let m = num_(months, 0);
  y = (y < 0) ? 0 : y;
  m = (m < 0) ? 0 : m;
  if (m >= 12) {
    y += Math.floor(m / 12);
    m = m % 12;
  }
  return { years: y, months: m, totalMonths: (y * 12) + m };
}



function normalizeDateIso_(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Strip ISO time if present
  const datePart = s.split('T')[0];
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  // Accept DD/MM/YYYY or MM/DD/YYYY, resolve using heuristic:
  // If first part > 12 => DD/MM; else prefer DD/MM (UK default).
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    let day, month;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { day = a; month = b; } // UK default
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return y.toString().padStart(4,'0') + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    }
  }
  // Last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth()+1).padStart(2,'0');
    const da = String(d.getUTCDate()).padStart(2,'0');
    return y + '-' + mo + '-' + da;
  }
  return null;
}

// Enums mapping per Jigsaw API doc
function mapTitle_(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (s === 'mr') return 1;
  if (s === 'mrs') return 2;
  if (s === 'ms') return 3;
  if (s === 'miss') return 4;
  return null;
}
function mapGender_(v, titleEnum) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (s === 'male' || s === 'm') return 1;
  if (s === 'female' || s === 'f') return 2;
  // Derive from title as per CMF notes
  if (titleEnum === 1) return 1; // Mr
  if (titleEnum === 2 || titleEnum === 3 || titleEnum === 4) return 2; // Mrs/Ms/Miss
  return null;
}
function mapMaritalStatus_(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'single') return 1;
  if (s === 'married') return 2;
  if (s === 'commonlaw' || s === 'common law') return 3;
  if (s === 'civilpartnership' || s === 'civil partnership') return 4;
  if (s === 'separated') return 5;
  if (s === 'divorced' || s === 'divorce') return 6;
  if (s === 'widowed') return 7;
  return null;
}
function mapIncomeFrequencyType_(v, defVal) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return defVal;
  if (s.includes('gross') && s.includes('annual')) return 0;
  if (s.includes('net') && s.includes('annual')) return 1;
  if (s.includes('gross') && s.includes('month')) return 2;
  if (s.includes('net') && s.includes('month')) return 3;
  if (s.includes('gross') && s.includes('week')) return 4;
  if (s.includes('net') && s.includes('week')) return 5;
  return defVal;
}
function mapResidentialStatus_(v, defVal) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return defVal;
  if (s.includes('home') && s.includes('owner')) return 1;
  if (s.includes('co') && s.includes('owner')) return 2;
  if (s.includes('council')) return 3;
  if (s.includes('housing')) return 4;
  if (s.includes('parents')) return 5;
  if (s.includes('tenant') || s.includes('rent')) return 6;
  return defVal;
}
function mapEmploymentStatus_(v, defVal) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return defVal;
  if (s.includes('full') && s.includes('permanent')) return 1;
  if (s.includes('part') && s.includes('permanent')) return 2;
  if (s.includes('full') && (s.includes('temp') || s.includes('temporary'))) return 3;
  if (s.includes('part') && (s.includes('temp') || s.includes('temporary'))) return 4;
  if (s.includes('agency') && s.includes('full')) return 5;
  if (s.includes('agency') && s.includes('part')) return 6;
  if (s.includes('sub') && s.includes('contract')) return 7;
  if (s.includes('self')) return 8;
  if (s.includes('unemployed')) return 9;
  if (s.includes('retired')) return 10;
  if (s.includes('student')) return 11;
  if (s.includes('house')) return 12;
  return defVal;
}
function mapFinanceProductType_(v, defVal) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return defVal;
  if (s.includes('hire') || s === 'hp') return 0;
  if (s.includes('pcp')) return 1;
  if (s.includes('lease') && s.includes('purchase')) return 2;
  if (s.includes('contract') && s.includes('hire')) return 3;
  if (s.includes('credit') && s.includes('line')) return 4;
  return defVal;
}


// ==========================================
// DRIVE HELPER 1: SEARCH FOLDERS (Live)
// ==========================================
// ==========================================
// DRIVE HELPERS (CLIENT FILES TAB)
// ==========================================
// Security model:
//  - We ONLY search within ROOT_FOLDER_ID to avoid exposing the whole Drive.
//  - We return metadata needed for UI only (id/name/updated).
// Performance:
//  - Limit results to 10 for snappy live search.
// ==========================================
// ==========================================
// DRIVE HELPER 1: SEARCH FOLDERS (Browse First Mode)
// ==========================================
// ==========================================
// DRIVE HELPER 1: SEARCH FOLDERS (API v3 / Turbo Mode)
// ==========================================
function searchClientFolders_(query) {


// AI NOTE:
//  - This uses the Advanced Drive Service (Drive.Files.list).
//    Apps Script Editor -> Services -> + -> Drive API (enable).
//  - If not enabled, you'll see 'Drive is not defined'.
//  - Keep fields/pageSize small for performance (live search).
  const ROOT_FOLDER_ID = '1qgMSGfh01yODRumtdaQH44nVEAjft51-'; 

  try {
    const q = String(query || '').trim().replace(/'/g, "\\'");

    // 1. CONSTRUCT QUERY
    // Note: In API v3, we check 'name', not 'title'
    let searchParams = "trashed = false and '" + ROOT_FOLDER_ID + "' in parents and mimeType = 'application/vnd.google-apps.folder'";

    if (q.length > 0) {
      searchParams += " and name contains '" + q + "'";
    }

    // 2. THE FAST CALL (Drive API v3)
    const response = Drive.Files.list({
      q: searchParams,
      orderBy: "modifiedTime desc",  // v3 uses 'modifiedTime' (not Date)
      pageSize: 50,                  // v3 uses 'pageSize' (not maxResults)
      fields: "files(id, name, modifiedTime)" // v3 uses 'files' (not items)
    });

    const results = [];
    const files = response.files || []; // v3 returns .files

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      results.push({
        id: item.id,
        name: item.name,           // v3 uses .name
        updated: item.modifiedTime // v3 uses .modifiedTime
      });
    }

    // 3. HANDLE EMPTY
    if (results.length === 0) {
       return { success: true, folders: [], message: q ? "No matches found." : "Root folder is empty." };
    }

    return { success: true, folders: results };

  } catch (e) {
    // Helpful error if the service is missing entirely
    if (e.message.indexOf('Drive is not defined') !== -1) {
      return { success: false, error: "CRITICAL: Please add 'Drive API' in Apps Script Services." };
    }
    return { success: false, error: "Drive Error: " + e.toString() };
  }
}




// ==========================================
// DRIVE HELPER 2: GET FILES (On Click)
// ==========================================
// ==========================================
// DRIVE HELPER: LIST FILES IN A FOLDER (on click)
// ==========================================
// Inputs: folderId (Drive folder id selected from live search)
// Output: files[] including /preview URLs for iframe embedding.
// AI NOTE: This does NOT change sharing/permissions; it only lists files the
// web app executor has access to. Front-end users still need Drive access.
// ==========================================
function getFolderFiles_(folderId) {


// AI NOTE:
//  - Uses DriveApp to enumerate files (no Advanced Service needed here).
//  - Returned URLs are /preview for embedding in an iframe.
//  - This does NOT change sharing; users still need Drive permissions.
  try {
    if (!folderId) return { success: false, error: 'No folderId provided' };

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const fileList = [];

    while (files.hasNext()) {
      const file = files.next();
      const id = file.getId();
      fileList.push({
        id: id,
        name: file.getName(),
        mimeType: file.getMimeType ? file.getMimeType() : undefined,
        // PREVIEW LINK (embeddable in iframes)
        url: "https://drive.google.com/file/d/" + id + "/preview",
        icon: file.getIconUrl ? (file.getIconUrl() || "https://ssl.gstatic.com/docs/doclist/images/icon_10_generic_list.png") : "https://ssl.gstatic.com/docs/doclist/images/icon_10_generic_list.png",
        lastUpdated: file.getLastUpdated().toISOString(),
        size: file.getSize()
      });
    }

    // Sort newest first
    fileList.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

    return { success: true, folderName: folder.getName(), folderUrl: folder.getUrl(), files: fileList };
  } catch (e) {
    return { success: false, error: String(e && e.message ? e.message : e) };
  }
}

/** Quick sanity check (Run manually in Apps Script editor). */
function selfTestRouter_() {
  const res = handleWebClientRequest({action:'healthCheck', payload:{}});
  Logger.log(res);
  return res;
}