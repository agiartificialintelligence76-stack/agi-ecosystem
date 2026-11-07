# OVERCLOCK: AGI-1's face for the dot-matrix display (30 × 32 dots, levels 0–4), drawn from shapes, printed as the
# FACE_BASE rows dmd.js keeps. python3 tools/games/overclock/face.py
import math
W, H = 30, 32
g = [[0] * W for _ in range(H)]
cx = 14.5
def ell(x, y, ex, ey, rx, ry): return ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1
for y in range(H):
    for x in range(W):
        px, py = x + 0.5, y + 0.5
        # the hair: a big round mass, long down both sides (a little wavy)
        hair = ell(px, py, cx + 0.5, 12.5, 14.6, 12.6)
        wave = 0.9 * math.sin(py * 0.7)
        if py > 12 and (px < 7.2 + wave or px > 23.3 - wave) and py < 32: hair = True
        # the face: an egg, narrower at the chin
        rx = 8.6 - max(0, py - 19) * 0.42
        face = abs(px - (cx + 0.5)) <= rx and 7.5 <= py <= 28.5 and ell(px, py, cx + 0.5, 17.5, 9.2, 11.2)
        # the bangs: hair over the forehead, parted in the middle, sweeping to the sides
        part = abs(px - (cx + 0.5))
        bang_low = 8.0 + part * 0.62 + (1.2 if part > 5.5 else 0)
        if face and py < bang_low and part > 0.9: face = False; hair = True
        if face: g[y][x] = 2
        elif hair: g[y][x] = 3
# a dark line between hair and face (definition), and strand highlights in the hair
out = [row[:] for row in g]
for y in range(H):
    for x in range(W):
        if g[y][x] == 3:
            n = [g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H]
            if 2 in n: out[y][x] = 0
            elif (x + y * 2) % 7 == 0 or (x - y) % 9 == 0: out[y][x] = 4
            elif (x * 3 + y) % 11 == 0: out[y][x] = 2
# the outer edge of the hair a touch brighter (the head's silhouette)
for y in range(H):
    for x in range(W):
        if g[y][x] == 3:
            n = [g[y + dy][x + dx] if 0 <= x + dx < W and 0 <= y + dy < H else 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if 0 in n and out[y][x] != 0: out[y][x] = 2
# her neck and the shirt's collar at the bottom
for y in range(28, 32):
    for x in range(12, 18):
        if out[y][x] in (0, 2, 3, 4) and abs(x + 0.5 - (cx + 0.5)) < 2.6 + (y - 28) * 0.2: out[y][x] = 1 if y == 28 else 2
for x in range(9, 21):
    if out[31][x] != 0: out[31][x] = 6
rows = [''.join('.' if v == 0 else str(v) for v in r) for r in out]
for r in rows: print(f"  '{r}',")
