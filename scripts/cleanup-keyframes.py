#!/usr/bin/env python3
"""Retire les @keyframes dupliquees des fichiers composants CSS.
Les keyframes centralisees dans theme.css sont: overlayFadeIn, modalSlideUp, fadeIn, spin, pulse, slideUp"""

import re, glob

CENTRALIZED = ['overlayFadeIn', 'modalSlideUp', 'fadeIn', 'spin', 'pulse', 'slideUp']

files = sorted(glob.glob('src/**/*.css', recursive=True))
files = [f for f in files if 'theme.css' not in f and 'theme-palettes.css' not in f]

total_removed = 0
modified_files = []

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    for name in CENTRALIZED:
        pattern = r'@keyframes\s+' + re.escape(name) + r'\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*'
        matches = list(re.finditer(pattern, content))
        if matches:
            for m in reversed(matches):
                content = content[:m.start()] + content[m.end():]
                total_removed += 1

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        modified_files.append(filepath)

print(f'Keyframes retirees: {total_removed}')
print(f'Fichiers modifies: {len(modified_files)}')
for f in modified_files:
    print(f'  {f}')
