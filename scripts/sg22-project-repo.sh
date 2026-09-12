#!/bin/sh
set -eu

default_repo="korzh260609-beep/garya-bot"
default_branch="dev/sg2.2-openclaw"
operation="${1:-prepare}"

case "$operation" in
  prepare|status|sync) ;;
  *)
    echo "Usage: sg22-project-repo.sh [prepare|status|sync] [OWNER/REPOSITORY] [BRANCH]" >&2
    exit 2
    ;;
esac

if [ "$#" -gt 0 ]; then
  shift
fi
[ "$#" -le 2 ] || {
  echo "Usage: sg22-project-repo.sh [prepare|status|sync] [OWNER/REPOSITORY] [BRANCH]" >&2
  exit 2
}

requested_repo="${1:-$default_repo}"
branch="${2:-$default_branch}"
workspace="${OPENCLAW_WORKSPACE_DIR:-/data/workspace}"

fail() {
  echo "SG GitHub repository error: $*" >&2
  exit 1
}

normalize_repo() {
  value=$1
  case "$value" in
    https://github.com/*) value=${value#https://github.com/} ;;
    ssh://git@github.com/*) value=${value#ssh://git@github.com/} ;;
    git@github.com:*) value=${value#git@github.com:} ;;
  esac
  value=${value%/}
  value=${value%.git}
  owner_part=${value%%/*}
  repository_part=${value#*/}
  [ -n "$owner_part" ] || return 1
  [ -n "$repository_part" ] || return 1
  [ "$repository_part" != "$value" ] || return 1
  case "$repository_part" in */*) return 1 ;; esac
  case "$owner_part" in *[!A-Za-z0-9.-]*|.|..) return 1 ;; esac
  case "$repository_part" in *[!A-Za-z0-9._-]*|.|..) return 1 ;; esac
  printf '%s/%s\n' "$owner_part" "$repository_part"
}

same_repo() {
  left=$(normalize_repo "$1") || return 1
  right=$(normalize_repo "$2") || return 1
  left_lower=$(printf '%s' "$left" | tr '[:upper:]' '[:lower:]')
  right_lower=$(printf '%s' "$right" | tr '[:upper:]' '[:lower:]')
  [ "$left_lower" = "$right_lower" ]
}

available_kb() {
  df -Pk "$workspace" | awk 'NR == 2 { print $4 }'
}

for required_command in git gh df awk tr; do
  command -v "$required_command" >/dev/null 2>&1 || fail "$required_command is unavailable"
done

gh auth status --hostname github.com >/dev/null 2>&1 || fail "GitHub authentication is unavailable"
gh auth setup-git --hostname github.com >/dev/null 2>&1 || fail "Git credential setup failed"

repo=$(normalize_repo "$requested_repo") || fail "invalid GitHub repository: $requested_repo"
resolved_repo=$(gh repo view "$repo" --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)
[ -n "$resolved_repo" ] || fail "repository is unavailable to the authenticated GitHub account: $repo"
repo=$(normalize_repo "$resolved_repo") || fail "GitHub returned an invalid repository identity"

validated_branch=$(git check-ref-format --branch "$branch" 2>/dev/null) \
  || fail "invalid branch name: $branch"
[ "$validated_branch" = "$branch" ] || fail "branch name must be explicit: $branch"

owner=${repo%%/*}
repository=${repo#*/}
repo_root="$workspace/github/$owner/$repository"
git_dir="$repo_root/repository.git"
branch_key=$(printf '%s' "$branch" | git hash-object --stdin)
checkout="$repo_root/worktrees/$branch_key"
canonical_origin="https://github.com/$repo.git"
disk_available_before_kb=$(available_kb)

umask 077
mkdir -p "$workspace/github/$owner" "$repo_root/worktrees"
chmod 700 "$workspace/github" "$workspace/github/$owner" "$repo_root" "$repo_root/worktrees"

if [ ! -e "$git_dir" ]; then
  [ "$operation" = "prepare" ] || fail "repository workspace is missing; run prepare first"
  gh repo clone "$repo" "$git_dir" -- --bare --filter=blob:none --no-tags || fail "clone failed"
elif [ ! -d "$git_dir" ]; then
  fail "repository store path is not a directory: $git_dir"
fi

actual_origin=$(git --git-dir="$git_dir" config --get remote.origin.url 2>/dev/null || true)
same_repo "$actual_origin" "$repo" || fail "unexpected origin: ${actual_origin:-missing}"

git --git-dir="$git_dir" fetch --quiet --prune "$canonical_origin" \
  "+refs/heads/*:refs/remotes/origin/*" || fail "fetch failed"
git --git-dir="$git_dir" show-ref --verify --quiet "refs/remotes/origin/$branch" \
  || fail "branch is unavailable: $branch"

if [ ! -e "$checkout" ]; then
  [ "$operation" = "prepare" ] || fail "branch workspace is missing; run prepare first"
  if git --git-dir="$git_dir" show-ref --verify --quiet "refs/heads/$branch"; then
    git --git-dir="$git_dir" worktree add --quiet "$checkout" "$branch" \
      || fail "worktree creation failed"
  else
    git --git-dir="$git_dir" worktree add --quiet -b "$branch" "$checkout" \
      "refs/remotes/origin/$branch" || fail "worktree creation failed"
  fi
  git -C "$checkout" config "branch.$branch.remote" origin
  git -C "$checkout" config "branch.$branch.merge" "refs/heads/$branch"

  github_login=$(gh api user --jq .login 2>/dev/null || true)
  github_id=$(gh api user --jq .id 2>/dev/null || true)
  [ -n "$github_login" ] || fail "authenticated GitHub login is unavailable"
  [ -n "$github_id" ] || fail "authenticated GitHub numeric ID is unavailable"
  git -C "$checkout" config user.name "$github_login"
  git -C "$checkout" config user.email "${github_id}+${github_login}@users.noreply.github.com"
elif [ ! -e "$checkout/.git" ]; then
  fail "branch workspace path is not a Git worktree: $checkout"
fi

actual_branch=$(git -C "$checkout" branch --show-current 2>/dev/null || true)
[ "$actual_branch" = "$branch" ] || fail "unexpected branch: ${actual_branch:-detached}"

collect_status() {
  local_sha=$(git -C "$checkout" rev-parse HEAD)
  remote_sha=$(git -C "$checkout" rev-parse "refs/remotes/origin/$branch")
  if [ -n "$(git -C "$checkout" status --porcelain)" ]; then
    working_tree=dirty
  else
    working_tree=clean
  fi

  if [ "$local_sha" = "$remote_sha" ]; then
    relation=equal
  elif git -C "$checkout" merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    relation=behind
  elif git -C "$checkout" merge-base --is-ancestor "$remote_sha" "$local_sha"; then
    relation=ahead
  else
    relation=diverged
  fi
}

collect_status

if [ "$operation" = "sync" ]; then
  [ "$working_tree" = "clean" ] || fail "working tree is not clean; preserving existing changes"
  case "$relation" in
    behind)
      git -C "$checkout" merge --ff-only "$remote_sha" >/dev/null 2>&1 \
        || fail "fast-forward failed"
      collect_status
      ;;
    diverged) fail "local and remote history diverged; preserving both histories" ;;
    equal|ahead) ;;
  esac
fi

disk_available_after_kb=$(available_kb)
printf '%s\n' \
  "status=ready" \
  "operation=$operation" \
  "path=$checkout" \
  "repository=$repo" \
  "branch=$branch" \
  "origin=$actual_origin" \
  "local_sha=$local_sha" \
  "remote_sha=$remote_sha" \
  "relation=$relation" \
  "working_tree=$working_tree" \
  "disk_available_kb_before=$disk_available_before_kb" \
  "disk_available_kb_after=$disk_available_after_kb"
