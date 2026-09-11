#!/usr/bin/env bash
# Install the Newsworthy admin TUI as an Omarchy application launcher.
#
#   ./apps/tui/omarchy/install.sh                        # launcher + free keybinding
#   ./apps/tui/omarchy/install.sh --no-keybind           # launcher only
#   ./apps/tui/omarchy/install.sh --key "SUPER + ALT + M"
#   ./apps/tui/omarchy/install.sh --uninstall
#
# Only ~/.local/share/applications and ~/.config/hypr/bindings.lua are touched.
# bindings.lua is backed up before it is edited, and the block this script adds
# is fenced with markers so re-running replaces it rather than stacking copies.
set -euo pipefail

OMARCHY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$OMARCHY_DIR/.." && pwd)"
TUI_BIN="$APP_DIR/bin/newsworthy-tui"
APP_ID="org.omarchy.newsworthy-admin"

APPS_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$APPS_DIR/newsworthy-admin.desktop"
BINDINGS="$HOME/.config/hypr/bindings.lua"

BEGIN_MARKER="-- >>> newsworthy admin tui (managed by apps/tui/omarchy/install.sh)"
END_MARKER="-- <<< newsworthy admin tui"

# Tried in order. The first one nothing else claims wins.
CANDIDATE_KEYS=(
  "SUPER + ALT + N"
  "SUPER + ALT + I"
  "SUPER + ALT + A"
  "SUPER + ALT + D"
  "SUPER + ALT + M"
  "SUPER + ALT + P"
  "SUPER + CTRL + SHIFT + N"
)

want_keybind=true
requested_key=""
uninstall=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-keybind) want_keybind=false ;;
    --with-keybind) want_keybind=true ;;
    --key) requested_key="${2:-}"; shift ;;
    --key=*) requested_key="${1#--key=}" ;;
    --uninstall) uninstall=true ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

note() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

# Set by remove_managed_block so a later failure can put bindings.lua back.
RESTORE_FROM=""

restore_bindings() {
  [[ -n "$RESTORE_FROM" && -f "$RESTORE_FROM" ]] || return 0
  cp "$RESTORE_FROM" "$BINDINGS"
  hyprctl reload >/dev/null 2>&1 || true
}

# Returns 0 when a block was removed, 1 when there was nothing to remove.
remove_managed_block() {
  [[ -f "$BINDINGS" ]] || return 1
  grep -qF -e "$BEGIN_MARKER" "$BINDINGS" || return 1
  RESTORE_FROM="$BINDINGS.bak.$(date +%s)"
  cp "$BINDINGS" "$RESTORE_FROM"
  sed -i "/$(sed 's/[][\\.*^$\/]/\\&/g' <<<"$BEGIN_MARKER")/,/$(sed 's/[][\\.*^$\/]/\\&/g' <<<"$END_MARKER")/d" "$BINDINGS"
  # Collapse the blank line the block used to sit on.
  sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$BINDINGS"
  return 0
}

if [[ "$uninstall" == true ]]; then
  rm -f "$DESKTOP_FILE"
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
  remove_managed_block || true
  hyprctl reload >/dev/null 2>&1 || true
  note "Removed the launcher entry and any keybinding this script added."
  exit 0
fi

if [[ ! -x "$TUI_BIN" ]]; then
  warn "Expected an executable at $TUI_BIN"
  warn "Run apps/tui/omarchy/bootstrap.sh first, or chmod +x the launcher."
  exit 1
fi

# --- Desktop entry -----------------------------------------------------------

mkdir -p "$APPS_DIR"
sed "s|__TUI_BIN__|$TUI_BIN|" "$OMARCHY_DIR/newsworthy-admin.desktop" >"$DESKTOP_FILE"
update-desktop-database "$APPS_DIR" 2>/dev/null || true
note "Installed $DESKTOP_FILE"

if [[ "$want_keybind" != true ]]; then
  note ""
  note "Launch it from the app launcher, or run: $TUI_BIN"
  exit 0
fi

# --- Keybinding --------------------------------------------------------------

if [[ ! -f "$BINDINGS" ]]; then
  warn "$BINDINGS does not exist. Skipping the keybinding."
  note ""
  note "Launch it from the app launcher, or run: $TUI_BIN"
  exit 0
fi

# Retire any block a previous run added and let Hyprland forget it, so the
# candidate search below does not treat our own old binding as a conflict.
if remove_managed_block; then
  hyprctl reload >/dev/null 2>&1 || true
fi

# Hyprland reports modifiers as a bitmask: shift 1, ctrl 4, alt 8, super 64.
modmask_for() {
  local spec="${1^^}" mask=0
  [[ "$spec" == *SHIFT* ]] && mask=$((mask | 1))
  [[ "$spec" == *CTRL* ]] && mask=$((mask | 4))
  [[ "$spec" == *ALT* ]] && mask=$((mask | 8))
  [[ "$spec" == *SUPER* ]] && mask=$((mask | 64))
  printf '%s' "$mask"
}

key_for() {
  local spec="${1##*+}"
  printf '%s' "${spec// /}"
}

# True when something already owns the combination. Asks the running compositor
# when it can, and falls back to reading the config files over SSH.
binding_in_use() {
  local spec="$1"
  local mask key
  mask="$(modmask_for "$spec")"
  key="$(key_for "$spec")"

  if hyprctl binds >/dev/null 2>&1; then
    hyprctl binds | awk -v want_mask="$mask" -v want_key="${key^^}" '
      /modmask:/ { mask = $2 }
      /^\tkey:/  { if (mask == want_mask && toupper($2) == want_key) hit = 1 }
      END        { exit hit ? 0 : 1 }
    '
    return $?
  fi

  local normalized="${spec// /}"
  local file
  for file in "$BINDINGS" /usr/share/omarchy/default/hypr/bindings/*.lua; do
    [[ -f "$file" ]] || continue
    if grep -oE '"[^"]+"' "$file" | tr -d ' "' | grep -qix "$normalized"; then
      return 0
    fi
  done
  return 1
}

if [[ -n "$requested_key" ]]; then
  KEY="$requested_key"
  if binding_in_use "$KEY"; then
    restore_bindings
    warn "$KEY is already bound. Pick another with --key, or unbind it first."
    exit 1
  fi
else
  KEY=""
  for candidate in "${CANDIDATE_KEYS[@]}"; do
    if ! binding_in_use "$candidate"; then
      KEY="$candidate"
      break
    fi
  done
  if [[ -z "$KEY" ]]; then
    restore_bindings
    warn "Every candidate keybinding is taken. Choose one with --key."
    exit 1
  fi
fi

[[ -n "$RESTORE_FROM" ]] || cp "$BINDINGS" "$BINDINGS.bak.$(date +%s)"

cat >>"$BINDINGS" <<LUA

$BEGIN_MARKER
o.bind("$KEY", "Newsworthy admin", "omarchy-launch-or-focus-tui --app-id=$APP_ID $TUI_BIN")
$END_MARKER
LUA

if hyprctl reload >/dev/null 2>&1; then
  errors="$(hyprctl configerrors 2>/dev/null || true)"
  if [[ -n "$errors" && "$errors" != "no errors"* ]]; then
    warn "Hyprland reported config errors:"
    warn "$errors"
    exit 1
  fi
  note "Bound $KEY to the Newsworthy admin TUI."
else
  note "Bound $KEY. Hyprland is not running here, so it applies at next login."
fi

note ""
note "Launch it from the app launcher, press $KEY, or run: $TUI_BIN"
