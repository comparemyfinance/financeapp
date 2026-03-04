/** Auth.gs (PLAINTEXT USERS + TOKEN SESSIONS)
 * Tradeoff: passwords are stored in clear text in this file.
 * Suitable only for small internal tools where project access is trusted.
 */

// Legacy fallback only. Prefer Script Property AUTH_USERS_JSON.
const AUTH_USERS = {};

// Token settings
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const AUTH_TOKEN_PREFIX = "authToken:";
const AUTH_MAX_LOGIN_ATTEMPTS = 10;
const AUTH_LOGIN_WINDOW_SECONDS = 5 * 60;

function getAuthUsers_() {
  const raw =
    PropertiesService.getScriptProperties().getProperty("AUTH_USERS_JSON") ||
    "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_) {}
  }
  return AUTH_USERS;
}

function loginRateKey_(username) {
  return "authLoginAttempts:" + String(username || "").toLowerCase();
}

function tooManyLoginAttempts_(username) {
  const cache = CacheService.getScriptCache();
  const key = loginRateKey_(username);
  const attempts = Number(cache.get(key) || 0);
  return attempts >= AUTH_MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin_(username) {
  const cache = CacheService.getScriptCache();
  const key = loginRateKey_(username);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), AUTH_LOGIN_WINDOW_SECONDS);
}

function clearFailedLogins_(username) {
  CacheService.getScriptCache().remove(loginRateKey_(username));
}

/** Returns {success:true, token, user} OR {success:false, error} */
function auth_login_plain_(username, password) {
  const u = String(username || "")
    .trim()
    .toLowerCase();
  const p = String(password || "");
  if (u.length > 100 || p.length > 200)
    return { success: false, error: "Invalid username or password." };
  if (!/^[a-z0-9._-]+$/.test(u))
    return { success: false, error: "Invalid username or password." };
  if (!u || !p)
    return { success: false, error: "Missing username or password." };
  if (tooManyLoginAttempts_(u))
    return {
      success: false,
      error: "Too many login attempts. Please try again shortly.",
    };

  const users = getAuthUsers_();
  if (!(u in users)) {
    recordFailedLogin_(u);
    return { success: false, error: "Invalid username or password." };
  }
  if (users[u] !== p) {
    recordFailedLogin_(u);
    return { success: false, error: "Invalid username or password." };
  }

  clearFailedLogins_(u);

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(
    AUTH_TOKEN_PREFIX + token,
    u,
    AUTH_TOKEN_TTL_SECONDS,
  );
  return { success: true, token: token, user: u };
}

function auth_check_token_(token) {
  const t = String(token || "").trim();
  if (!t) return { success: false, error: "AUTH_REQUIRED", authRequired: true };
  const u = CacheService.getScriptCache().get(AUTH_TOKEN_PREFIX + t);
  if (!u) return { success: false, error: "AUTH_REQUIRED", authRequired: true };
  return { success: true, user: u };
}

function auth_logout_token_(token) {
  const t = String(token || "").trim();
  if (t) CacheService.getScriptCache().remove(AUTH_TOKEN_PREFIX + t);
  return { success: true };
}

/** Utility so it shows in dropdown; keep if you like. */
function makeUser() {
  // Edit these two lines then Run -> view Logs, then paste into AUTH_USERS.
  const username = "kyle";
  const password = "MyPassword123!";
  Logger.log({ username: username.toLowerCase(), password });
}
