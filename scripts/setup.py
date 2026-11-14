#!/usr/bin/env python3
"""One-shot setup on Windows, macOS or Linux: .venv + packages, then data, then the env check.

  python scripts/setup.py            # everything (~0.75 GB download)
  python scripts/setup.py --no-data  # packages only

Windows (64-bit Python 3.11-3.14 from python.org): py scripts\\setup.py
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if sys.version_info < (3, 11):
    sys.exit(f"Python 3.11+ required, this is {sys.version.split()[0]}")

venv = ROOT / ".venv"
py = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if not py.exists():
    subprocess.check_call([sys.executable, "-m", "venv", str(venv)])


def run(*args):
    subprocess.check_call([str(py), *args], cwd=ROOT)


run("-m", "pip", "install", "-q", "--upgrade", "pip")
run("-m", "pip", "install", "-q", "-r", "requirements.txt")

node = shutil.which("node")
if not node:
    print("warn: Node.js not found (needed for the web app): install the LTS from nodejs.org")
else:
    v = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
    if int(v.lstrip("v").split(".")[0]) < 20:
        print(f"warn: Node 20+ recommended, found {v}")

if "--no-data" not in sys.argv:
    run("scripts/fetch_data.py", "all")
subprocess.call([str(py), "scripts/check_env.py"], cwd=ROOT)
print("\nRun Python with: " + (r".venv\Scripts\python" if os.name == "nt" else ".venv/bin/python")
      + "  (or activate: " + (r".venv\Scripts\activate" if os.name == "nt" else "source .venv/bin/activate") + ")")
