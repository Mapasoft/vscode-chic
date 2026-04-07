#!/usr/bin/env python3
"""Convert chic.tmLanguage (plist XML) to chic.tmLanguage.json."""
import plistlib
import json
import sys
import pathlib

src = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])

with src.open("rb") as f:
    grammar = plistlib.load(f)

with dst.open("w") as f:
    json.dump(grammar, f, indent=2)
    f.write("\n")

print(f"Converted {src} → {dst}")
