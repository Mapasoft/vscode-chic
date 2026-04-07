#!/usr/bin/env python3
"""Generate a solid-colour 128x128 PNG using Python stdlib only."""
import struct, zlib, pathlib

def make_png(path: str, width: int, height: int, r: int, g: int, b: int) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        header = struct.pack(">I", len(data)) + tag
        return header + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_rows = b"".join(b"\x00" + bytes([r, g, b] * width) for _ in range(height))

    png = (
        signature
        + chunk(b"IHDR", ihdr_data)
        + chunk(b"IDAT", zlib.compress(raw_rows, 9))
        + chunk(b"IEND", b"")
    )
    pathlib.Path(path).write_bytes(png)
    print(f"Generated {path} ({width}x{height} #{r:02x}{g:02x}{b:02x})")

make_png("icons/chic-file-icon.png", 128, 128, 137, 180, 250)  # #89b4fa (Catppuccin blue)
