#!/usr/bin/env bash
# Build the app and publish the built site (dist/) to the gh-pages branch, which GitHub Pages serves.
# The source lives on main; this only replaces the gh-pages branch.
#
# Usage: npm run deploy
# Needs: gh logged in to the GitHub account below (`gh auth login`).
set -euo pipefail

GH_USER="V4run-Sharma"
REPO="guitartuner"
BRANCH="gh-pages"
BASE="/${REPO}/"

cd "$(dirname "$0")/.."
npx vite build --base="$BASE"
touch dist/.nojekyll # serve files as-is (no Jekyll processing)

TOKEN="$(gh auth token --user "$GH_USER")"
GIT_EMAIL="$(git config user.email || true)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R dist/. "$WORK"

cd "$WORK"
git init -q -b "$BRANCH"
git config user.name "$GH_USER"
[ -n "$GIT_EMAIL" ] && git config user.email "$GIT_EMAIL"
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Pass the token as a header via env-config so it never lands in a remote URL or .git/config.
AUTH="$(printf 'x-access-token:%s' "$TOKEN" | base64)"
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0="http.https://github.com/.extraheader" \
GIT_CONFIG_VALUE_0="Authorization: basic ${AUTH}" \
  git push -q --force "https://github.com/${GH_USER}/${REPO}.git" "$BRANCH"

echo "Deployed: https://$(echo "$GH_USER" | tr '[:upper:]' '[:lower:]').github.io/${REPO}/"
