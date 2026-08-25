#!/usr/bin/env python3
"""Deterministic 16px grid atlas packer (Pillow).

Layout: 4x4 grid of 16x16 cells, alphabetical sprite names.
Writes public/textures/atlas.png + atlas.json in the same JSON shape the
engine reads (TexturePacker 'json' hash format), and verifies that every
atlas cell is byte-identical to its source sprite.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
SPRITES = ROOT / "public" / "textures" / "sprites"
OUT_DIR = ROOT / "public" / "textures"
CELL = 16
COLS = 4
ROWS = 4


def main():
    names = sorted(p.stem for p in SPRITES.glob("*.png"))
    assert len(names) <= COLS * ROWS, "too many sprites"
    sheet = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    frames = {}
    for i, name in enumerate(names):
        spr = Image.open(SPRITES / f"{name}.png").convert("RGBA")
        assert spr.size == (CELL, CELL), f"{name} is {spr.size}"
        x, y = (i % COLS) * CELL, (i // COLS) * CELL
        sheet.paste(spr, (x, y))
        frames[name] = {
            "frame": {"x": x, "y": y, "w": CELL, "h": CELL},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
            "sourceSize": {"w": CELL, "h": CELL},
        }
    sheet.save(OUT_DIR / "atlas.png")
    data = {
        "frames": frames,
        "meta": {
            "app": "voxelcraft make_atlas.py (TexturePacker-compatible)",
            "version": "1.0",
            "image": "atlas.png",
            "format": "RGBA8888",
            "size": {"w": COLS * CELL, "h": ROWS * CELL},
            "scale": "1",
        },
    }
    (OUT_DIR / "atlas.json").write_text(__import__("json").dumps(data, indent=1))

    # verify: every cell must equal its source pixel for pixel
    for i, name in enumerate(names):
        x, y = (i % COLS) * CELL, (i // COLS) * CELL
        cell = sheet.crop((x, y, x + CELL, y + CELL))
        spr = Image.open(SPRITES / f"{name}.png").convert("RGBA")
        if cell.tobytes() != spr.tobytes():
            raise SystemExit(f"verification FAILED for {name}")
    print(f"atlas {COLS * CELL}x{ROWS * CELL} written, {len(names)} sprites verified identical to sources")


if __name__ == "__main__":
    main()
