#!/usr/bin/env python3
"""Generate PWA icons with proper padding for maskable icons."""
import os
from PIL import Image

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')
os.chdir(PUBLIC_DIR)

# Save original before modifying
src = Image.open("icon-512x512.png").convert("RGBA")

# --- Maskable icons (solid background + logo at 60%) ---
bg_color = (30, 58, 95, 255)  # theme_color #1e3a5f

for size in [192, 512]:
    canvas = Image.new("RGBA", (size, size), bg_color)
    logo_size = int(size * 0.60)
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    offset = (size - logo_size) // 2
    canvas.paste(logo, (offset, offset), logo)
    fname = f"icon-maskable-{size}x{size}.png"
    canvas.save(fname)
    print(f"Created {fname} (logo {logo_size}px, padding {offset}px = {offset/size*100:.0f}%)")

# --- Standard icons (transparent bg + logo with 8% padding) ---
for size in [192, 512]:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    padding = int(size * 0.08)
    logo_size = size - 2 * padding
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    canvas.paste(logo, (padding, padding), logo)
    fname = f"icon-{size}x{size}.png"
    canvas.save(fname)
    print(f"Updated {fname} (logo {logo_size}px, padding {padding}px = {padding/size*100:.0f}%)")

print("Done!")
