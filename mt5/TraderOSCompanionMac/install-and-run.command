#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "TraderOS MT5 Companion for Mac"
echo "This installs Python dependencies in a local virtual environment."
echo "The mt5-mac package is third-party software; review its project and test with a demo/read-only account first."
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it from https://www.python.org/downloads/macos/ and rerun this file."
  read -r -p "Press Return to close..."
  exit 1
fi
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python traderos_mt5_mac_app.py
