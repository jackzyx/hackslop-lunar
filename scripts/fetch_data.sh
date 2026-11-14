#!/usr/bin/env bash
# macOS/Linux wrapper. The real script is fetch_data.py, which also runs on Windows: py scripts\fetch_data.py
#   scripts/fetch_data.sh [all|kernels|core|extra|big]
exec "${PYTHON:-python3}" "$(dirname "$0")/fetch_data.py" "$@"
