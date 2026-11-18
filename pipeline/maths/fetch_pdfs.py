"""Download every PDF in registry/maths/sources.json into pipeline/cache/pdf/ (pipeline/fetch.py, pointed at
the Maths manifest; ids like WMA11_2024_01 never clash with Physics ones).

Usage:  pipeline/.venv/bin/python pipeline/maths/fetch_pdfs.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch  # noqa: E402
import units  # noqa: E402

fetch.SOURCES = units.SOURCES

if __name__ == "__main__":
    fetch.main()
