#!/usr/bin/env python3
"""Make <name>.png.webp / <name>.jpg.webp siblings for big images anywhere under dist/ (except og-* share images).
The server (staticzip.js) hands these to browsers that accept WebP; URLs stay the same.
Only keeps a sibling when it is at least 25% smaller. Safe to re-run."""
import os, sys
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'dist')
MAXDIM = 1600
saved = n = 0
for r, _, fs in os.walk(ROOT):
    for f in fs:
        e = f.rsplit('.', 1)[-1].lower()
        if e not in ('png', 'jpg', 'jpeg') or f.startswith('og-'): continue
        src = os.path.join(r, f); out = src + '.webp'
        sz = os.path.getsize(src)
        if sz < 30000 or os.path.exists(out): continue
        try:
            im = Image.open(src); im.load()
            if max(im.size) > MAXDIM: im.thumbnail((MAXDIM, MAXDIM), Image.LANCZOS)
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA' if 'transparency' in im.info or im.mode in ('LA', 'P') else 'RGB')
            im.save(out, 'WEBP', quality=84, method=6, alpha_quality=100)
        except Exception as ex:
            print('skip', src, ex); continue
        w = os.path.getsize(out)
        if w > sz * 0.75: os.remove(out); continue
        saved += sz - w; n += 1
print('made', n, 'webp siblings, saved', saved // 1024, 'KB per full download')
