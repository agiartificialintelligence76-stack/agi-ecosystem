#!/usr/bin/env python3
# HEARTBEAT (2026-11-08): a chart drawn the way a player sees it (four lanes, time going up), to check its patterns by
# eye: python3 tools/games/heartbeat/strip.py <song-id> <start s> [seconds] [out.png]
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from catalog import chart_file  # noqa: E402

COLORS = [(255, 77, 166), (255, 201, 51), (63, 240, 195), (139, 102, 255)]


def main():
    sid, start = sys.argv[1], float(sys.argv[2])
    span = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
    out = sys.argv[4] if len(sys.argv) > 4 else f'{sid}-{start:.0f}.png'
    d = json.load(open(chart_file(sid), encoding='utf8'))
    H, LW, GAP = 1200, 44, 40
    W = 3 * (4 * LW) + 4 * GAP
    im = Image.new('RGB', (W, H + 40), (16, 8, 38))
    dr = ImageDraw.Draw(im)
    Y = lambda t: H - (t - start) / span * H + 20   # noqa: E731
    for col, diff in enumerate(('easy', 'normal', 'hard')):
        x0 = GAP + col * (4 * LW + GAP)
        dr.text((x0, 2), diff, fill=(230, 230, 230))
        for i in range(5):
            dr.line([(x0 + i * LW, 20), (x0 + i * LW, H + 20)], fill=(60, 45, 100))
        for k, b in enumerate(d['beats']):
            if start <= b <= start + span:
                down = (k - d['bar']) % 4 == 0
                dr.line([(x0, Y(b)), (x0 + 4 * LW, Y(b))], fill=(200, 190, 255) if down else (70, 55, 120), width=2 if down else 1)
        for n in d['charts'][diff]:
            t, l = n[0], n[1]
            h = n[2] if len(n) > 2 else 0
            if t + h < start or t > start + span:
                continue
            cx = x0 + l * LW + LW // 2
            if h:
                dr.rectangle([cx - 8, Y(t + h), cx + 8, Y(t)], fill=tuple(c // 2 for c in COLORS[l]))
            dr.ellipse([cx - 13, Y(t) - 9, cx + 13, Y(t) + 9], fill=COLORS[l], outline=(23, 10, 54), width=2)
    im.save(out)


if __name__ == '__main__':
    main()
