import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

test('Index.html: canonical auth bootstrap includes 15 minute idle logout manager', () => {
  const html = readFile('Index.html');

  assert.match(html, /const IDLE_TIMEOUT_MS = 15 \* 60 \* 1000;/);
  assert.match(
    html,
    /const IDLE_ACTIVITY_EVENTS = \['pointerdown', 'keydown', 'touchstart', 'scroll'\];/,
  );
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /Logged out after 15 minutes of inactivity\./);
});

test('Index.html: idle logout uses shared logout path with lock release and authLogout', () => {
  const html = readFile('Index.html');

  assert.match(html, /async function releaseActiveDealLockBestEffort\(\)/);
  assert.match(html, /App\.lock\.release\(currentDealId\)/);
  assert.match(html, /async function logoutToLogin\(message, options\)/);
  assert.match(html, /await callAction\('authLogout', \{ token \}\)/);
  assert.match(html, /showLogin\(message \|\| 'Signed out\.'\);/);
});

test('Index.html: idle watcher starts on authenticated UI and stops on login overlay', () => {
  const html = readFile('Index.html');

  assert.match(html, /function showLogin\(msg\)\{[\s\S]*stopIdleWatcher\(\);/);
  assert.match(html, /function hideLogin\(\)\{[\s\S]*startIdleWatcher\(\);/);
  assert.match(
    html,
    /window\.__cmfHandleAuthRequired = function\(resp\)\{[\s\S]*logoutToLogin\('Session expired\. Please sign in again\.'/,
  );
});
