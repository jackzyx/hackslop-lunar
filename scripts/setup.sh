#!/usr/bin/env bash
# macOS/Linux wrapper. The real script is setup.py, which also runs on Windows: py scripts\setup.py
#   scripts/setup.sh            # everything (~0.75 GB download)
#   scripts/setup.sh --no-data  # packages only
exec "${PYTHON:-python3}" "$(dirname "$0")/setup.py" "$@"
