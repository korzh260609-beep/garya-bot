#!/bin/sh
set -eu

repo="korzh260609-beep/garya-bot"
branch="dev/sg2.2-openclaw"
origin="https://github.com/${repo}.git"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"
checkout="$workspace/project-sg/garya-bot"
parent="$(dirname "$checkout")"

fail() {
  echo "SG Project repository error: $*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is unavailable"
command -v gh >/dev/null 2>&1 || fail "GitHub CLI is unavailable"
gh auth status --hostname github.com >/dev/null 2>&1 || fail "GitHub authentication is unavailable"
gh auth setup-git --hostname github.com >/dev/null 2>&1 || fail "Git credential setup failed"

umask 077
mkdir -p "$parent"
chmod 700 "$parent"

if [ ! -e "$checkout" ]; then
  gh repo clone "$repo" "$checkout" -- --branch "$branch" --single-branch --no-tags \
    || fail "clone failed"
elif [ ! -d "$checkout/.git" ]; then
  fail "checkout path exists but is not a Git repository: $checkout"
fi

actual_origin="$(git -C "$checkout" config --get remote.origin.url 2>/dev/null || true)"
[ "$actual_origin" = "$origin" ] || fail "unexpected origin: ${actual_origin:-missing}"

actual_branch="$(git -C "$checkout" branch --show-current 2>/dev/null || true)"
[ "$actual_branch" = "$branch" ] || fail "unexpected branch: ${actual_branch:-detached}"

if [ -n "$(git -C "$checkout" status --porcelain)" ]; then
  fail "working tree is not clean; preserving existing changes"
fi

git -C "$checkout" fetch --prune origin \
  "+refs/heads/$branch:refs/remotes/origin/$branch" >/dev/null 2>&1 \
  || fail "fetch failed"

local_sha="$(git -C "$checkout" rev-parse HEAD)"
remote_sha="$(git -C "$checkout" rev-parse "refs/remotes/origin/$branch")"

if [ "$local_sha" != "$remote_sha" ]; then
  if git -C "$checkout" merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    git -C "$checkout" merge --ff-only "$remote_sha" >/dev/null 2>&1 \
      || fail "fast-forward failed"
    local_sha="$(git -C "$checkout" rev-parse HEAD)"
  else
    fail "local HEAD does not match remote; preserving unpublished or divergent work"
  fi
fi

[ "$local_sha" = "$remote_sha" ] || fail "local HEAD does not match remote"

github_login="$(gh api user --jq .login 2>/dev/null || true)"
github_id="$(gh api user --jq .id 2>/dev/null || true)"
[ -n "$github_login" ] || fail "authenticated GitHub login is unavailable"
[ -n "$github_id" ] || fail "authenticated GitHub numeric ID is unavailable"
git -C "$checkout" config user.name "$github_login"
git -C "$checkout" config user.email "${github_id}+${github_login}@users.noreply.github.com"

printf '%s\n' \
  "status=ready" \
  "path=$checkout" \
  "repository=$repo" \
  "branch=$branch" \
  "local_sha=$local_sha" \
  "remote_sha=$remote_sha" \
  "working_tree=clean"
