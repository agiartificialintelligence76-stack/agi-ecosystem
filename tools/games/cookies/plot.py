#!/usr/bin/env python3
"""ACCEPT ALL COOKIES: draw a traced level (./trace.mjs's JSON) as a picture for designing levels: the page with a
100-unit grid, its pins, ropes, hooks, pop-ups, banners and buttons, fans, bugs, tabs, pixels and the cat, and the
cookie's path (its color going from violet to pink over time, a dot every 1/8 s and the tick every half second), with
the moments that matter (cuts, pixels, hooks, pop-ups, puffs, tabs) marked where they happened.

    python3 tools/games/cookies/plot.py trace-1-4.json out.png
"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

S = 0.8                      # pixels per page unit
M = 40                       # margin (page units)


def main(src, out):
    d = json.load(open(src))
    L = d['level']
    W, H = int((600 + 2 * M) * S), int((900 + 2 * M) * S)
    im = Image.new('RGB', (W, H), (30, 18, 64))
    g = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
    except OSError:
        font = ImageFont.load_default()
    P = lambda x, y: ((x + M) * S, (y + M) * S)
    g.rectangle([*P(0, 0), *P(600, 900)], fill=(243, 236, 255))
    for v in range(0, 601, 100):
        g.line([*P(v, 0), *P(v, 900)], fill=(220, 210, 245))
        g.text(P(v + 2, 2), str(v), fill=(150, 140, 190), font=font)
    for v in range(0, 901, 100):
        g.line([*P(0, v), *P(600, v)], fill=(220, 210, 245))
        g.text(P(2, v + 2), str(v), fill=(150, 140, 190), font=font)

    def circ(x, y, r, **kw):
        g.ellipse([*P(x - r, y - r), *P(x + r, y + r)], **kw)

    for b in L.get('banners', []):
        g.line([*P(b[0], b[1]), *P(b[2], b[3])], fill=(90, 70, 150), width=int(24 * S))
    for b in L.get('pads', []):
        g.line([*P(b[0], b[1]), *P(b[2], b[3])], fill=(255, 77, 166), width=int(22 * S))
    for h in L.get('hooks', []):
        circ(h[0], h[1], h[2], outline=(107, 59, 255), width=1)
        circ(h[0], h[1], 8, fill=(107, 59, 255))
    for i, u in enumerate(L.get('popups', [])):
        g.rectangle([*P(u[0] - 40, u[1] - 34), *P(u[0] + 40, u[1] + 34)], outline=(89, 200, 255), width=2)
        g.text(P(u[0] - 36, u[1] - 32), f'pop{i}', fill=(40, 120, 200), font=font)
    for i, f in enumerate(L.get('fans', [])):
        x, y, dx, dy = f
        n = (dx * dx + dy * dy) ** 0.5
        circ(x, y, 20, fill=(63, 240, 195), outline=(23, 10, 54))
        g.line([*P(x, y), *P(x + dx / n * 380, y + dy / n * 380)], fill=(63, 200, 160), width=1)
        g.text(P(x + 22, y - 6), f'fan{i}', fill=(20, 120, 90), font=font)
    for i, b in enumerate(d.get('bugs', [])):
        g.line([*P(b[0], b[1]), *P(b[2], b[3])], fill=(255, 90, 95), width=1)
        circ(b[0], b[1], 21, outline=(255, 90, 95), width=2)
        if b[0] != b[2] or b[1] != b[3]:
            circ(b[2], b[3], 21, outline=(255, 160, 160), width=1)
    for i, pair in enumerate(L.get('tabs', [])):
        for j, t in enumerate(pair):
            x, y, dx, dy = t
            n = (dx * dx + dy * dy) ** 0.5
            circ(x, y, 38, outline=(255, 201, 51), width=3)
            g.line([*P(x, y), *P(x + dx / n * 50, y + dy / n * 50)], fill=(200, 150, 0), width=3)
            g.text(P(x - 10, y - 6), f'T{i}{"ab"[j]}', fill=(120, 90, 0), font=font)
    pins = L.get('pins', [])
    for i, p in enumerate(pins):
        if isinstance(p, dict):
            x0, y0, x1, y1 = p['track']
            g.line([*P(x0, y0), *P(x1, y1)], fill=(160, 140, 210), width=int(10 * S))
            t = p.get('t', 0)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        else:
            x, y = p
        circ(x, y, 9, fill=(23, 10, 54))
        g.text(P(x + 10, y - 14), f'p{i}', fill=(23, 10, 54), font=font)
    cx, cy = L['cookie']
    for k, r in enumerate(L.get('ropes', [])):
        p = pins[r[0]]
        x, y = (p['track'][0] + (p['track'][2] - p['track'][0]) * p.get('t', 0), p['track'][1] + (p['track'][3] - p['track'][1]) * p.get('t', 0)) if isinstance(p, dict) else p
        g.line([*P(x, y), *P(cx, cy)], fill=(255, 201, 51), width=3)
        g.text(P((x + cx) / 2 + 4, (y + cy) / 2), f'r{k}', fill=(150, 100, 0), font=font)
    for i, p in enumerate(L.get('pixels', [])):
        g.rectangle([*P(p[0] - 13, p[1] - 13), *P(p[0] + 13, p[1] + 13)], outline=(20, 160, 120), width=2)
    kx, ky = L['cat']
    circ(kx, ky, 46, outline=(120, 120, 120), width=3)
    g.text(P(kx - 10, ky - 6), 'CAT', fill=(90, 90, 90), font=font)
    circ(cx, cy, 26, outline=(200, 140, 60), width=2)

    path = d['path']
    n = max(1, len(path))
    for i in range(1, len(path)):
        a, b = path[i - 1], path[i]
        t = i / n
        col = (int(107 + 148 * t), int(59 + 18 * t), int(255 - 89 * t))
        if b[3]:
            col = (89, 200, 255)
        g.line([*P(a[1], a[2]), *P(b[1], b[2])], fill=col, width=2)
        if b[0] % 15 == 0:
            circ(b[1], b[2], 2.5, fill=col)
        if b[0] % 60 == 0:
            g.text(P(b[1] + 5, b[2] + 3), str(b[0]), fill=(60, 40, 110), font=font)
    for e in d['events']:
        t = e['t']
        pt = next((p for p in path if p[0] == t), None)
        if not pt:
            continue
        x, y = pt[1], pt[2]
        typ = e['type']
        if typ == 'cut':
            g.line([*P(e['x'] - 10, e['y'] - 10), *P(e['x'] + 10, e['y'] + 10)], fill=(220, 0, 60), width=3)
            g.line([*P(e['x'] - 10, e['y'] + 10), *P(e['x'] + 10, e['y'] - 10)], fill=(220, 0, 60), width=3)
            g.text(P(e['x'] + 12, e['y'] - 8), f'cut r{e["rope"]} @{t}', fill=(220, 0, 60), font=font)
        elif typ == 'pixel':
            g.rectangle([*P(e['x'] - 13, e['y'] - 13), *P(e['x'] + 13, e['y'] + 13)], fill=(63, 240, 195), outline=(20, 120, 90))
            g.text(P(e['x'] + 15, e['y'] - 6), f'px@{t}', fill=(20, 120, 90), font=font)
        elif typ in ('hook', 'wrap', 'pop', 'puff', 'tab', 'eat', 'lost'):
            circ(x, y, 6, fill=(255, 77, 166))
            g.text(P(x + 8, y + 6), f'{typ}@{t}', fill=(200, 30, 120), font=font)
        elif typ == 'bounce' and e.get('pad'):
            circ(x, y, 4, fill=(255, 77, 166))
    res = d['result']
    g.text((6, H - 16), f"{L['id']} {L['name']}  →  {res['status']} {res['why']} pixels {res['pixels']} t={res['ticks']}", fill=(255, 250, 240), font=font)
    im.save(out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
