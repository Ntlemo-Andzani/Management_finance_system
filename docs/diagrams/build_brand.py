#!/usr/bin/env python3
"""
Builds the KhupFin brand assets used by the web application, from the single
supplied master logo.

The master is a dark-background render: its wordmark and the body of the K are
deep green, which disappears against the application's dark green navigation
rail. So two families are produced:

  * dark-ink  — the logo as supplied, for light surfaces (page bodies, print)
  * light-ink — a knockout where the green is lifted to cream, for dark surfaces

Run:  python3 docs/diagrams/build_brand.py
"""
import os
import numpy as np
from PIL import Image

SRC = '/mnt/user-data/uploads/Khupfin_Luxury_Financial_Logo.png'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'img')
os.makedirs(OUT, exist_ok=True)

master = Image.open(SRC).convert('RGBA')
arr = np.array(master)

# Rows with almost no ink separate the three elements of the lockup.
MARK = (102, 575)        # the K monogram
WORD = (600, 890)        # KHUPFIN + the FINANCIAL INFRASTRUCTURE rule


def trim(img, threshold=60):
    """Crop to the strongly-opaque ink, discarding the faint outer glow."""
    a = np.array(img)
    ys, xs = np.where(a[:, :, 3] > threshold)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def knockout(img):
    """
    Lift the green ink to cream so the logo survives on a dark background,
    leaving the gold untouched. Shading is preserved by driving the cream with
    the inverse of each pixel's own luminance, so the bevels still read.
    """
    a = np.array(img).astype(np.float32)
    r, g, b, alpha = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]

    # Identify the gold by its strong red-over-blue spread, then lift everything
    # else. Testing for green directly leaves the near-black shading under the
    # swoosh untouched, which shows up as dark speckles on the lifted artwork.
    is_gold = ((r - b) > 40) & (r > 85)
    is_green = ~is_gold
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

    # Dark green -> bright cream; lighter green -> slightly softer cream.
    lift = 1.0 - np.clip(lum * 1.35, 0, 0.55)
    cream = np.stack([
        226 + 24 * lift,   # R
        238 + 14 * lift,   # G
        231 + 18 * lift,   # B
    ], axis=-1)

    out = a.copy()
    out[:, :, :3] = np.where(is_green[..., None], cream, a[:, :, :3])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def save(img, name, width=None):
    if width:
        h = max(1, round(img.height * width / img.width))
        img = img.resize((width, h), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path)
    print(f'  {name:28} {img.width}x{img.height}')


print('Building KhupFin brand assets')

# ---- full lockup --------------------------------------------------------
full = trim(master.crop((0, MARK[0], master.width, WORD[1])))
save(full, 'khupfin-logo.png', width=900)
save(knockout(full), 'khupfin-logo-light.png', width=900)

# ---- the K monogram alone ----------------------------------------------
mark = trim(master.crop((0, MARK[0], master.width, MARK[1])))
save(mark, 'khupfin-mark.png', width=512)
save(knockout(mark), 'khupfin-mark-light.png', width=512)

# ---- the wordmark alone, for the narrow navigation rail -----------------
word = trim(master.crop((0, WORD[0], master.width, WORD[1])))
save(knockout(word), 'khupfin-wordmark-light.png', width=640)

# ---- favicons -----------------------------------------------------------
# The monogram is squared off on a transparent canvas so browsers that letterbox
# a favicon do not crop the swoosh.
side = max(mark.width, mark.height)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.alpha_composite(mark, ((side - mark.width) // 2, (side - mark.height) // 2))

save(square, 'favicon-32.png', width=32)
save(square, 'favicon-180.png', width=180)   # apple-touch-icon
square.resize((64, 64), Image.LANCZOS).save(
    os.path.join(OUT, 'favicon.ico'),
    sizes=[(16, 16), (32, 32), (48, 48)],
)
print('  favicon.ico                  16/32/48')
print('\nWritten to public/img/')
