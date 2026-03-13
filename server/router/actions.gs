// ============================================================
// ROUTER ACTION REGISTRY (Wave 1 logical extraction)
// ============================================================

function normalizeAction_(action) {
  const raw = String(action || '').trim();
  if (!raw) return 'unknown';
  const aliases = {
    validateJigsawReferral: 'validateJigsaw',
    submitJigsawReferral: 'submitJigsaw',
    load: 'getDelta',
    getAll: 'getDelta',
  };
  return aliases[raw] || raw;
}

function makeRouteContext_(action, payload, fullRequest) {
  const legacy = fullRequest || {};
  return {
    rawAction: String(action || '').trim() || 'unknown',
    action: normalizeAction_(action),
    payload: payload != null ? payload : {},
    legacy: legacy,
  };
}

function resolveFolderId_(payload, legacy) {
  let folderId = '';
  if (typeof payload === 'string') folderId = payload;
  if (!folderId && payload && typeof payload === 'object') {
    folderId =
      payload.folderId ||
      payload.folder_id ||
      payload.id ||
      payload.driveFolderId ||
      (typeof payload.folder === 'string'
        ? payload.folder
        : payload.folder &&
          (payload.folder.id ||
            payload.folder.folderId ||
            payload.folder.driveFolderId)) ||
      (payload.selectedFolder &&
        (payload.selectedFolder.id ||
          payload.selectedFolder.folderId ||
          payload.selectedFolder.driveFolderId)) ||
      (payload.node &&
        (payload.node.id || payload.node.folderId || payload.node.driveFolderId)) ||
      '';
  }
  if (!folderId && legacy) {
    folderId =
      legacy.folderId ||
      legacy.folder_id ||
      legacy.id ||
      legacy.driveFolderId ||
      (typeof legacy.folder === 'string'
        ? legacy.folder
        : legacy.folder &&
          (legacy.folder.id ||
            legacy.folder.folderId ||
            legacy.folder.driveFolderId)) ||
      '';
  }
  return String(folderId || '').trim();
}

function handleHealthCheck_(_ctx) {
  return { success: true, status: 'healthy' };
}

// ------------------------ Auth handlers
function handleAuthLogin_(ctx) {
  const u = ctx.payload && ctx.payload.username;
  const p = ctx.payload && ctx.payload.password;
  return auth_login_plain_(u, p);
}

function handleAuthStatus_(ctx) {
  const chk = auth_check_token_(ctx.payload && ctx.payload.token);
  return chk.success
    ? { success: true, loggedIn: true, user: chk.user }
    : { success: true, loggedIn: false };
}

function handleAuthLogout_(ctx) {
  return auth_logout_token_(ctx.payload && ctx.payload.token);
}

// ------------------------ Lender handlers
function handleListLenders_(_ctx) {
  return { success: true, lenders: listLenders_() };
}
function handleGetLenderQuote_(ctx) {
  return getLenderQuote(ctx.payload || {});
}
function handleGetLenderQuotesBatch_(ctx) {
  return getLenderQuotesBatch(ctx.payload || {});
}
function handleGetFinanceNavigatorSoftScore_(ctx) {
  return getFinanceNavigatorSoftScore(ctx.payload || {});
}

// ------------------------ Deals handlers
function handleGetPartnerActivitySummary_(_ctx) {
  return safeObj_(() => getPartnerActivitySummary_());
}

function handleLockAction_(ctx) {
  if (!ENABLE_CACHE_LOCKS) return { success: true, disabled: true };
  return safeObj_(() => handleDealLocking_(ctx.legacy));
}

function handleGetDelta_(_ctx) {
  const sheet = getSheet_();
  const data = getRowsData_(sheet);
  return { success: true, data: data };
}

function handleSave_(ctx) {
  return withLock_(30000, () => {
    const sheet = getSheet_();
    return safeObj_(() => saveDeal_(sheet, ctx.payload));
  });
}

function handleDelete_(ctx) {
  return withLock_(30000, () => {
    const sheet = getSheet_();
    return safeObj_(() => deleteDeal_(sheet, ctx.payload && ctx.payload.id));
  });
}

function handleBatchUpdate_(ctx) {
  return withLock_(30000, () => {
    const sheet = getSheet_();
    return safeObj_(() => batchUpdate_(sheet, ctx.payload && ctx.payload.updates));
  });
}

// ------------------------ Drive handlers
function handleSearchFolders_(ctx) {
  const q =
    ctx.payload && ctx.payload.query != null
      ? ctx.payload.query
      : ctx.legacy.query != null
        ? ctx.legacy.query
        : '';
  return safeObj_(() => searchClientFolders_(q));
}

function handleGetFolderFiles_(ctx) {
  const folderId = resolveFolderId_(ctx.payload, ctx.legacy);
  if (!folderId) {
    return makeError_('VALIDATION_ERROR', 'Missing folderId', {
      hint: 'Send payload.folderId (or payload.id / payload.folder.id)',
    });
  }
  return safeObj_(() => getFolderFiles_(folderId));
}

// ------------------------ Jigsaw handlers
function handleValidateJigsaw_(ctx) {
  return safeObj_(() => validateJigsawAction_(ctx.payload));
}
function handleSubmitJigsaw_(ctx) {
  return safeObj_(() => submitJigsawAction_(ctx.payload));
}

// ------------------------ Visible dispatch registry
const PUBLIC_ACTION_HANDLERS_ = {
  healthCheck: handleHealthCheck_,
  authLogin: handleAuthLogin_,
  authStatus: handleAuthStatus_,
  authLogout: handleAuthLogout_,
};

const PROTECTED_ACTION_HANDLERS_ = {
  listLenders: handleListLenders_,
  getLenderQuote: handleGetLenderQuote_,
  getLenderQuotesBatch: handleGetLenderQuotesBatch_,
  getFinanceNavigatorSoftScore: handleGetFinanceNavigatorSoftScore_,
  getPartnerActivitySummary: handleGetPartnerActivitySummary_,
  acquireLock: handleLockAction_,
  releaseLock: handleLockAction_,
  heartbeatLock: handleLockAction_,
  searchFolders: handleSearchFolders_,
  getFolderFiles: handleGetFolderFiles_,
  getDelta: handleGetDelta_,
  validateJigsaw: handleValidateJigsaw_,
  submitJigsaw: handleSubmitJigsaw_,
  save: handleSave_,
  delete: handleDelete_,
  batchUpdate: handleBatchUpdate_,
};

function routeAction_(action, payload, fullRequest) {
  const ctx = makeRouteContext_(action, payload, fullRequest);

  try {
    const publicHandler = PUBLIC_ACTION_HANDLERS_[ctx.action];
    if (publicHandler) return publicHandler(ctx);

    const auth = auth_check_token_(ctx.payload && ctx.payload.token);
    if (!auth.success) return auth;

    const protectedHandler = PROTECTED_ACTION_HANDLERS_[ctx.action];
    if (protectedHandler) return protectedHandler(ctx);

    return makeError_('UNKNOWN_ACTION', 'Unknown action: ' + ctx.rawAction);
  } catch (err) {
    console.error('routeAction_ error', ctx.rawAction, err);
    return makeError_(
      'INTERNAL_ERROR',
      err && err.message ? String(err.message) : 'Server error',
      { action: ctx.rawAction },
    );
  }
}
