/** Auth.gs (PLAINTEXT USERS + TOKEN SESSIONS)
 * Tradeoff: passwords are stored in clear text in this file.
 * Suitable only for small internal tools where project access is trusted.
 */

// Username -> Password map loaded from Script Properties (AUTH_USERS_JSON).
function getAuthUsers_() {
  const raw = (typeof getProp_ === 'function') ? getProp_('AUTH_USERS_JSON') : '';
  if (!raw) return {};
  try {
    const obj = JSON.parse(String(raw));
    if (!obj || typeof obj !== 'object') return {};
    const normalized = {};
    Object.keys(obj).forEach((k) => {
      normalized[String(k).trim().toLowerCase()] = String(obj[k]);
    });
    return normalized;
  } catch (_e) {
    return {};
  }
}

// Token settings
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const AUTH_TOKEN_PREFIX = "authToken:";

/** Returns {success:true, token, user} OR {success:false, error} */
function auth_login_plain_(username, password) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");
  if (!u || !p) return makeError_("VALIDATION_ERROR", "Missing username or password.");
  const users = getAuthUsers_();
  if (!Object.keys(users).length) return makeError_("CONFIG_ERROR", "AUTH_USERS_JSON is not configured");
  if (!(u in users)) return makeError_("AUTH_REQUIRED", "Invalid username or password.");
  if (users[u] !== p) return makeError_("AUTH_REQUIRED", "Invalid username or password.");

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(AUTH_TOKEN_PREFIX + token, u, AUTH_TOKEN_TTL_SECONDS);
  return { success: true, token: token, user: u };
}

function auth_check_token_(token) {
  const t = String(token || "").trim();
  if (!t) return makeError_("AUTH_REQUIRED", "AUTH_REQUIRED", { authRequired: true });
  const u = CacheService.getScriptCache().get(AUTH_TOKEN_PREFIX + t);
  if (!u) return makeError_("AUTH_REQUIRED", "AUTH_REQUIRED", { authRequired: true });
  return { success: true, user: u };
}

function auth_logout_token_(token) {
  const t = String(token || "").trim();
  if (t) CacheService.getScriptCache().remove(AUTH_TOKEN_PREFIX + t);
  return { success: true };
}

/** Utility so it shows in dropdown; keep if you like. */
function makeUser() {
  // Edit these two lines then set Script Property AUTH_USERS_JSON (e.g. {"kyle":"MyPassword123!"}).
  const username = "kyle";
  const password = "MyPassword123!";
  Logger.log({ username: username.toLowerCase(), password });
}
