/** Auth.gs (PLAINTEXT USERS + TOKEN SESSIONS)
 * Tradeoff: passwords are stored in clear text in this file.
 * Suitable only for small internal tools where project access is trusted.
 */

// Username -> Password (plaintext)
const AUTH_USERS = {
  "kyle": "CMF2025",
  "admin": "admin123"
    // "kyle": "MyPassword123!",
};

// Token settings
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const AUTH_TOKEN_PREFIX = "authToken:";

/** Returns {success:true, token, user} OR {success:false, error} */
function auth_login_plain_(username, password) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");
  if (!u || !p) return { success: false, error: "Missing username or password." };
  if (!(u in AUTH_USERS)) return { success: false, error: "Invalid username or password." };
  if (AUTH_USERS[u] !== p) return { success: false, error: "Invalid username or password." };

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(AUTH_TOKEN_PREFIX + token, u, AUTH_TOKEN_TTL_SECONDS);
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
