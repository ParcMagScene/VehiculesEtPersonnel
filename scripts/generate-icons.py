#!/usr/bin/env python3
"""Generate favicon and PWA icons from LogoMagSav.svg"""
from PIL import Image
import subprocess, os

os.chdir(os.path.join(os.path.dirname(__file__), '..', 'public'))

# 1. Rasteriser le SVG a grande taille
subprocess.run(['rsvg-convert', '-w', '1024', 'Logos/LogoMagSav.svg', '-o', '/tmp/logo_raw.png'], check=True)

# Ouvrir et recadrer au contenu
img = Image.open('/tmp/logo_raw.png').convert('RGBA')
bbox = img.getbbox()
print(f"Raw size: {img.size}, Content bbox: {bbox}")
cropped = img.crop(bbox)
print(f"Cropped size: {cropped.size}")

# 2. Creer version carree avec padding genereux (25%)
# pour que le logo soit bien visible et non rogne sur mobile
max_dim = max(cropped.size)
padding = int(max_dim * 0.25)
square_size = max_dim + 2 * padding
square = Image.new('RGBA', (square_size, square_size), (255, 255, 255, 0))
x = (square_size - cropped.size[0]) // 2
y = (square_size - cropped.size[1]) // 2
square.paste(cropped, (x, y), cropped)
print(f"Square size: {square.size}")

# 3. Favicon 32x32 et 16x16 (fond transparent)
fav32 = square.resize((32, 32), Image.LANCZOS)
fav32.save('favicon-32x32.png')
fav16 = square.resize((16, 16), Image.LANCZOS)
fav16.save('favicon-16x16.png')

# 4. Apple touch icon 180x180 (fond blanc, logo bien centre avec marge)
apple = Image.new('RGBA', (180, 180), (255, 255, 255, 255))
logo_apple = square.resize((140, 140), Image.LANCZOS)
apple.paste(logo_apple, (20, 20), logo_apple)
apple.save('apple-touch-icon.png')

# 5. PWA icons avec fond blanc et padding genereux
for size in [192, 512]:
    pwa = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    pad = int(size * 0.15)
    logo_pwa = square.resize((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    pwa.paste(logo_pwa, (pad, pad), logo_pwa)
    pwa.save(f'icon-{size}x{size}.png')

# 6. Creer .ico multi-resolution pour navigateurs
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_images = [square.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_images[0].save('favicon.ico', format='ICO', sizes=ico_sizes, append_images=ico_images[1:])

print("All icons generated:")
for f in ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'icon-192x192.png', 'icon-512x512.png']:
    print(f"  {f}: {os.path.getsize(f)} bytes")
