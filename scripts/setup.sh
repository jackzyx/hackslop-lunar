#!/usr/bin/env bash
# One-shot setup: Python venv + packages, then data (kernels + core DEMs).
#   scripts/setup.sh            # everything (~0.75 GB download)
#   scripts/setup.sh --no-data  # packages only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=${PYTHON:-python3}
"$PY" -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ required"'
[[ -d .venv ]] || "$PY" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt
command -v node >/dev/null && node -e 'const v=+process.versions.node.split(".")[0]; if(v<20){console.error("Node 20+ recommended, found "+process.version)}' || echo "warn: Node.js not found (needed for the web app)"
if [[ "${1:-}" != "--no-data" ]]; then
  scripts/fetch_data.sh all
fi
python scripts/check_env.py || true
echo "Activate with: source .venv/bin/activate"
