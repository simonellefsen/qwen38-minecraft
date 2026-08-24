#!/usr/bin/env python3
"""Draw 16x16 Minecraft-style block sprites with PIL -> public/textures/sprites/"""
import random
from pathlib import Path
from PIL import Image

S = 16
OUT = Path(__file__).parent.parent / "public" / "textures" / "sprites"
OUT.mkdir(parents=True, exist_ok=True)

GREENS = [(106, 170, 64, 255), (96, 154, 58, 255), (84, 138, 52, 255), (116, 180, 70, 255), (70, 120, 44, 255)]
DIRT = [(134, 96, 67, 255), (121, 85, 60, 255), (110, 76, 53, 255), (144, 104, 74, 255), (92, 63, 44, 255)]
STONE = [(125, 125, 126, 255), (113, 113, 114, 255), (100, 100, 102, 255), (138, 138, 139, 255), (88, 88, 90, 255)]
SAND = [(219, 206, 157, 255), (211, 197, 146, 255), (226, 214, 170, 255), (200, 186, 135, 255)]


def new():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def speckle(im, seed, colors):
    r = random.Random(seed)
    px = im.load()
    for j in range(S):
        for i in range(S):
            px[i, j] = r.choice(colors)


def save(name, im):
    im.save(OUT / f"{name}.png")
    print(f"  {name}.png")


def grass_top():
    im = new()
    speckle(im, 11, GREENS)
    save("grass_top", im)


def dirt():
    im = new()
    speckle(im, 22, DIRT)
    save("dirt", im)


def grass_side():
    im = new()
    speckle(im, 22, DIRT)
    r = random.Random(7)
    px = im.load()
    for i in range(S):
        d = 3 + r.randint(0, 2)
        for j in range(d):
            px[i, j] = r.choice(GREENS)
    save("grass_side", im)


def stone():
    im = new()
    speckle(im, 33, STONE)
    save("stone", im)


def sand():
    im = new()
    speckle(im, 44, SAND)
    save("sand", im)


def log_side():
    im = new()
    r = random.Random(55)
    px = im.load()
    for i in range(S):
        base = (105, 76, 47, 255) if i % 4 == 0 else (96, 69, 42, 255)
        for j in range(S):
            px[i, j] = r.choice([base, (78, 54, 32, 255), (110, 80, 50, 255)])
    save("log_side", im)


def log_top():
    im = new()
    r = random.Random(66)
    px = im.load()
    for j in range(S):
        for i in range(S):
            d = max(abs(i - 7.5), abs(j - 7.5))
            ring = int(d)
            if ring > 0 and ring % 2 == 0:
                px[i, j] = r.choice([(110, 80, 48, 255), (97, 70, 40, 255)])
            else:
                px[i, j] = r.choice([(156, 124, 80, 255), (147, 115, 74, 255)])
    save("log_top", im)


def leaves():
    im = new()
    r = random.Random(77)
    px = im.load()
    for j in range(S):
        for i in range(S):
            if r.random() < 0.12:
                px[i, j] = (0, 0, 0, 0)
            else:
                px[i, j] = r.choice([(52, 110, 40, 255), (62, 128, 46, 255), (44, 95, 34, 255), (70, 140, 52, 255)])
    save("leaves", im)


def glass():
    im = new()
    px = im.load()
    for j in range(S):
        for i in range(S):
            if i == 0 or j == 0 or i == S - 1 or j == S - 1:
                px[i, j] = (210, 230, 240, 255)
            else:
                px[i, j] = (190, 220, 235, 40)
    px[3, 3] = (255, 255, 255, 230)
    px[4, 2] = (255, 255, 255, 230)
    px[2, 4] = (255, 255, 255, 230)
    for k in range(6, 13):
        px[k, 12 - k] = (230, 245, 255, 110)
    save("glass", im)


def water():
    im = new()
    r = random.Random(88)
    px = im.load()
    for j in range(S):
        for i in range(S):
            px[i, j] = r.choice([(52, 112, 190, 205), (44, 100, 178, 205), (62, 124, 202, 205)])
    for _ in range(4):
        yy, xx = r.randint(1, 14), r.randint(0, 10)
        for k in range(4):
            px[min(S - 1, xx + k), yy] = (140, 190, 240, 210)
    save("water", im)


def cobble():
    im = new()
    r = random.Random(99)
    px = im.load()
    for j in range(S):
        for i in range(S):
            px[i, j] = (58, 58, 60, 255)
    for _ in range(14):
        cx, cy = r.randint(0, 15), r.randint(0, 15)
        rad = r.randint(1, 2)
        for j in range(S):
            for i in range(S):
                if ((i - cx) ** 2 + (j - cy) ** 2) ** 0.5 <= rad:
                    px[i, j] = r.choice([(128, 128, 130, 255), (114, 114, 116, 255), (140, 140, 142, 255)])
    save("cobble", im)


def bricks():
    im = new()
    r = random.Random(111)
    px = im.load()
    for j in range(S):
        for i in range(S):
            if j % 4 == 3 or (i - ((j // 4) % 2) * 4) % 8 == 7:
                px[i, j] = (188, 180, 172, 255)
            else:
                px[i, j] = r.choice([(150, 70, 52, 255), (138, 64, 48, 255), (160, 78, 58, 255)])
    save("bricks", im)


def planks():
    im = new()
    r = random.Random(122)
    px = im.load()
    for j in range(S):
        for i in range(S):
            if j % 4 == 3:
                px[i, j] = (94, 66, 38, 255)
            else:
                px[i, j] = r.choice([(172, 132, 78, 255), (160, 120, 70, 255), (150, 112, 64, 255)])
    for row in range(4):
        yy = row * 4 + 1
        xx = 12 if row % 2 == 0 else 3
        px[xx, yy] = (94, 66, 38, 255)
        px[xx, yy + 1] = (94, 66, 38, 255)
    save("planks", im)


def bedrock():
    im = new()
    speckle(im, 133, [(70, 70, 72, 255), (40, 40, 42, 255), (95, 95, 97, 255), (25, 25, 27, 255)])
    save("bedrock", im)


if __name__ == "__main__":
    print(f"writing sprites to {OUT}")
    for f in (grass_top, dirt, grass_side, stone, sand, log_side, log_top,
              leaves, glass, water, cobble, bricks, planks, bedrock):
        f()
    print(f"done: {len(list(OUT.glob('*.png')))} sprites")
