// ============================================================
// SHARED RESPONSE HELPERS (Wave 1 logical extraction)
// ============================================================

function makeError_(code, message, extras) {
  const errObj = {
    success: false,
    ok: false,
    error: {
      code: String(code || 'INTERNAL_ERROR'),
      message: String(message || 'Unexpected server error'),
    },
  };
  const extra = extras && typeof extras === 'object' ? extras : null;
  if (extra) {
    Object.keys(extra).forEach((k) => {
      if (k === 'stack' || k === 'details') return;
      errObj[k] = extra[k];
    });
  }
  return errObj;
}

function safeClientJson_(obj) {
  return JSON.stringify(obj, (k, v) => {
    if (v instanceof Date) return v.toISOString();
    return v;
  });
}

function safeObj_(fn) {
  try {
    const out = fn();
    if (out && typeof out.getContent === 'function') {
      try {
        return JSON.parse(out.getContent());
      } catch (e) {
        return makeError_('INVALID_OUTPUT', 'Handler returned a non-JSON payload.');
      }
    }
    return out;
  } catch (err) {
    console.error('safeObj_ error', err);
    const rawMessage = err && err.message ? String(err.message) : '';
    const message = rawMessage || 'Server error';
    const code = /^Missing required config:/i.test(message)
      ? 'CONFIG_ERROR'
      : 'INTERNAL_ERROR';
    return makeError_(code, message);
  }
}

function createJsonOutput_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function json_(o) {
  return createJsonOutput_(o);
}
