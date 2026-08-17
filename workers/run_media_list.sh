#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Prefer local venv
if [[ -x .venv/bin/python ]]; then
  exec .venv/bin/python -m media_list_agent "$@"
fi
exec python3 -m media_list_agent "$@"
