#!/usr/bin/env python3
"""Generate favicon and PWA icons from LogoEmag.png"""
import os
from PIL import Image

os.chdir(os.path.join(os.path.dirname(__file__), '..', 'public'))

src = Image.open('Logos/LogoEmag.png').convert('RGBA')
print(f'Source: {src.size}')

def make_icon(source, size, bg='white'):
    w, h = source.size
    ratio = min(size/w, size/h) * 0.85
    new_w, new_h = int(w*ratio), int(h*ratio)
    resized = source.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

# PWA icons
make_icon(src, 512).save('icon-512x512.png')
print('icon-512x512.png OK')

make_icon(src, 192).save('icon-192x192.png')
print('icon-192x192.png OK')

# Notification icon
make_icon(src, 192).save('Logos/logo-emag-192.png')
print('Logos/logo-emag-192.png OK')

# Apple touch icon
make_icon(src, 180).save('apple-touch-icon.png')
print('apple-touch-icon.png OK')

# Favicons
make_icon(src, 32).save('favicon-32x32.png')
print('favicon-32x32.png OK')

make_icon(src, 16).save('favicon-16x16.png')
print('favicon-16x16.png OK')

# Favicon ICO
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_images = [make_icon(src, s[0]).convert('RGBA') for s in ico_sizes]
ico_images[0].save('favicon.ico', format='ICO', sizes=ico_sizes, append_images=ico_images[1:])
print('favicon.ico OK')

print('\nToutes les icones generees !')
