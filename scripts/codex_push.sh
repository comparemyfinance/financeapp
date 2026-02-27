#!/usr/bin/env bash
set -euo pipefail

# ====== Required secret ======
: "${GITHUB_TOKEN:?Missing GITHUB_TOKEN secret in this environment}"

# ====== Repo constants (safe defaults) ======
GITHUB_OWNER="${GITHUB_OWNER:-comparemyfinance}"
GITHUB_REPO="${GITHUB_REPO:-financeapp}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

REMOTE_URL="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git"

echo "== 0) Verify we're in a git repo =="
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Not inside a git repo folder (no .git)."
  echo "Fix: Codex must run inside a cloned checkout of ${REMOTE_URL}"
  exit 1
fi

echo "== 1) Ensure origin exists and is correct =="
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi
git remote -v

echo "== 2) Configure git identity (required for commits) =="
git config user.email "codex-bot@users.noreply.github.com"
git config user.name "codex-bot"

echo "== 3) Configure non-interactive GitHub auth (.netrc) =="
cat > ~/.netrc <<EOF
machine github.com
login x-access-token
password ${GITHUB_TOKEN}
EOF
chmod 600 ~/.netrc

echo "== 4) Fetch main =="
git fetch origin "${GITHUB_BRANCH}" --prune

echo "== 5) Ensure we're on main (fix detached HEAD) =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo '')"
if [ "${CURRENT_BRANCH}" = "HEAD" ]; then
  # Detached head: create/switch to main from origin/main
  if git show-ref --verify --quiet "refs/heads/${GITHUB_BRANCH}"; then
    git checkout "${GITHUB_BRANCH}"
  else
    git checkout -B "${GITHUB_BRANCH}" "origin/${GITHUB_BRANCH}"
  fi
else
  git checkout "${GITHUB_BRANCH}"
fi

echo "== 6) Rebase on latest origin/main =="
git pull --rebase origin "${GITHUB_BRANCH}"

echo "== 7) Stage changes =="
git add -A

echo "== 8) If nothing changed, exit cleanly =="
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

echo "== 9) Commit =="
git commit -m "Codex: automated update"

echo "== 10) Push to GitHub =="
git push -u origin "${GITHUB_BRANCH}"

echo "== DONE =="
