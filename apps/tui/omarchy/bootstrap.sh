#!/usr/bin/env bash
# Set up the Newsworthy admin TUI on a fresh Omarchy machine.
#
# Copy this one file to the new machine and run it, or run it from a checkout:
#
#   scp apps/tui/omarchy/bootstrap.sh other-machine:
#   ssh other-machine ./bootstrap.sh
#
# It installs git and bun, clones or updates the repo, installs dependencies,
# sets up credentials, and installs the launcher and keybinding. Re-running it
# is safe: every step is skipped when it is already done.
#
# Options
#   --dir <path>     Where the repo lives. Default ~/Dev/nextjs/newsworthy
#   --repo <url>     Clone URL. Default git@github.com:giantcranberry/Newsworthy.git
#   --branch <name>  Branch to check out. Default main
#   --key "<bind>"   Force a keybinding instead of picking a free one
#   --no-keybind     Install the launcher entry only
#   --doppler        Install the Doppler CLI and use it for secrets
#   --skip-env       Do not ask about credentials
#   -y, --yes        Never prompt; fail instead of asking
set -euo pipefail

REPO_DIR="$HOME/Dev/nextjs/newsworthy"
REPO_URL="git@github.com:giantcranberry/Newsworthy.git"
BRANCH="main"
KEY_ARG=()
use_doppler=false
skip_env=false
assume_yes=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) REPO_DIR="${2:?--dir needs a path}"; shift ;;
    --dir=*) REPO_DIR="${1#--dir=}" ;;
    --repo) REPO_URL="${2:?--repo needs a url}"; shift ;;
    --repo=*) REPO_URL="${1#--repo=}" ;;
    --branch) BRANCH="${2:?--branch needs a name}"; shift ;;
    --branch=*) BRANCH="${1#--branch=}" ;;
    --key) KEY_ARG=(--key "${2:?--key needs a binding}"); shift ;;
    --key=*) KEY_ARG=(--key "${1#--key=}") ;;
    --no-keybind) KEY_ARG=(--no-keybind) ;;
    --doppler) use_doppler=true ;;
    --skip-env) skip_env=true ;;
    -y|--yes) assume_yes=true ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; RESET=$'\033[0m'
step() { printf '%s==>%s %s%s\n' "$BOLD" "$RESET" "$*" ""; }
info() { printf '    %s%s%s\n' "$DIM" "$*" "$RESET"; }
ok()   { printf '    %s%s%s\n' "$GREEN" "$*" "$RESET"; }
die()  { printf '%sError:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

ask() {
  # ask <prompt> <varname> [--secret]
  local prompt="$1" varname="$2" secret="${3:-}"
  if [[ "$assume_yes" == true || ! -t 0 ]]; then
    die "$prompt is needed but there is no terminal to ask on. Set it in the environment first."
  fi
  local value
  if [[ "$secret" == "--secret" ]]; then
    read -r -s -p "    $prompt: " value
    echo
  else
    read -r -p "    $prompt: " value
  fi
  printf -v "$varname" '%s' "$value"
}

confirm() {
  [[ "$assume_yes" == true ]] && return 0
  [[ -t 0 ]] || return 1
  local reply
  read -r -p "    $1 [Y/n] " reply
  [[ -z "$reply" || "$reply" =~ ^[Yy] ]]
}

# --- 1. Packages -------------------------------------------------------------

step "Checking packages"

command -v pacman >/dev/null 2>&1 || die "This installer is for Arch-based Omarchy systems."

install_packages() {
  local missing=()
  for pkg in "$@"; do
    pacman -Q "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  [[ ${#missing[@]} -eq 0 ]] && return 0

  info "Installing: ${missing[*]}"
  if command -v omarchy-pkg-add >/dev/null 2>&1; then
    omarchy-pkg-add "${missing[@]}"
  else
    sudo pacman -S --needed --noconfirm "${missing[@]}"
  fi
}

install_packages git bun
ok "git and bun are present"

if [[ "$use_doppler" == true ]] && ! command -v doppler >/dev/null 2>&1; then
  info "Installing doppler-cli-bin from the AUR"
  if command -v omarchy-pkg-aur-add >/dev/null 2>&1; then
    omarchy-pkg-aur-add doppler-cli-bin
  elif command -v yay >/dev/null 2>&1; then
    yay -S --needed --noconfirm doppler-cli-bin
  else
    die "Neither omarchy-pkg-aur-add nor yay is available to install the Doppler CLI."
  fi
fi

# --- 2. Repository -----------------------------------------------------------

step "Setting up the repository"

if [[ -d "$REPO_DIR/.git" ]]; then
  info "Updating the checkout at $REPO_DIR"
  git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
  if [[ -z "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
    git -C "$REPO_DIR" checkout --quiet "$BRANCH"
    git -C "$REPO_DIR" merge --ff-only --quiet "origin/$BRANCH" || \
      info "Could not fast-forward; leaving the branch where it is."
  else
    info "Working tree has local changes; leaving them alone."
  fi
else
  mkdir -p "$(dirname "$REPO_DIR")"
  info "Cloning $REPO_URL"
  if ! git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"; then
    die "Clone failed. Add this machine's SSH key to GitHub, or pass --repo with an https URL."
  fi
fi
ok "Repository ready at $REPO_DIR"

TUI_DIR="$REPO_DIR/apps/tui"
[[ -d "$TUI_DIR" ]] || die "$TUI_DIR is missing. Is --branch $BRANCH the right branch?"

# --- 3. Dependencies ---------------------------------------------------------

step "Installing dependencies"
(cd "$REPO_DIR" && bun install)
ok "bun install finished"

# --- 4. Credentials ----------------------------------------------------------

ENV_FILE="$TUI_DIR/.env"

if [[ "$skip_env" == true ]]; then
  step "Skipping credentials as requested"
elif [[ -f "$ENV_FILE" ]]; then
  step "Credentials"
  ok "Using the existing $ENV_FILE"
elif [[ -f "$REPO_DIR/.env.local" ]] && grep -qE '^(DIRECT_)?DATABASE_URL=' "$REPO_DIR/.env.local"; then
  step "Credentials"
  ok "Using the repository's .env.local"
elif [[ "$use_doppler" == true ]]; then
  step "Credentials via Doppler"
  doppler configure get token >/dev/null 2>&1 || doppler login
  (cd "$REPO_DIR" && doppler setup --project newsworthy-dashboard --config dev --no-interactive)
  ok "Doppler is configured; the launcher will run the TUI under it"
else
  step "Credentials"
  info "The TUI needs read access to Postgres and Stripe."
  info "Leave a value blank to skip it."

  DB_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
  STRIPE="${STRIPE_SECRET:-}"
  ADMIN_EMAIL="${NEWSWORTHY_ADMIN_EMAIL:-}"

  [[ -n "$DB_URL" ]] || ask "DIRECT_DATABASE_URL" DB_URL --secret
  [[ -n "$DB_URL" ]] || die "A database URL is required."
  [[ -n "$STRIPE" ]] || ask "STRIPE_SECRET" STRIPE --secret
  [[ -n "$ADMIN_EMAIL" ]] || ask "Admin email for favorites (optional)" ADMIN_EMAIL

  umask 077
  {
    echo "# Written by apps/tui/omarchy/bootstrap.sh. Not tracked by git."
    echo "DIRECT_DATABASE_URL=$DB_URL"
    [[ -n "$STRIPE" ]] && echo "STRIPE_SECRET=$STRIPE"
    [[ -n "$ADMIN_EMAIL" ]] && echo "NEWSWORTHY_ADMIN_EMAIL=$ADMIN_EMAIL"
  } >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Wrote $ENV_FILE with owner-only permissions"
fi

# --- 5. Launcher -------------------------------------------------------------

step "Installing the Omarchy launcher"
chmod +x "$TUI_DIR/bin/newsworthy-tui" "$TUI_DIR/omarchy/install.sh"
"$TUI_DIR/omarchy/install.sh" "${KEY_ARG[@]}"

# --- 6. Smoke test -----------------------------------------------------------

step "Checking that it can reach the data"
if output="$("$TUI_DIR/bin/newsworthy-tui" --once 2>&1)"; then
  printf '%s\n' "$output" | sed -E 's/\x1b\[[0-9;]*m//g' | sed -n '2p' | sed 's/^/    /'
  ok "The TUI connected successfully."
else
  printf '%s\n' "$output" | tail -5 >&2
  die "The TUI could not fetch data. Check the credentials above."
fi

echo
printf '%sDone.%s Run %s or press the keybinding shown above.\n' \
  "$BOLD" "$RESET" "$TUI_DIR/bin/newsworthy-tui"
