# LAST MODEL STANDING: the three bosses (and the cache crate), drawn with a few primitives (fills, ellipses, lines, an
# automatic ink outline) into rows of palette characters, written into src/games/lastmodel/sprites.js between the
# "<bosses>" markers. Run: python3 tools/games/lastmodel/bosses.py   (then preview.py to look at them)
import re

SRC = 'src/games/lastmodel/sprites.js'


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c, only=None):
        for y in range(self.h):
            for x in range(self.w):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    if only is None or self.g[y][x] in only:
                        self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    # shade: the pixels of colour `c` whose neighbour in direction (dx, dy) is empty become `to` (light from top-left)
    def edge(self, c, to, dx, dy):
        hits = [(x, y) for y in range(self.h) for x in range(self.w)
                if self.g[y][x] == c and self.get(x + dx, y + dy) in '.h']
        for x, y in hits:
            self.px(x, y, to)

    def outline(self, c='h'):
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '.':
                    continue
                if any(self.get(x + dx, y + dy) not in '.' + c for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add:
            self.px(x, y, c)

    def mirror(self):
        # copy the left half onto the right (symmetric bodies)
        for y in range(self.h):
            for x in range(self.w // 2):
                self.g[y][self.w - 1 - x] = self.g[y][x]

    def rows(self):
        return [''.join(r) for r in self.g]


def botnet():
    g = Grid(38, 40)
    # cables behind (violet tubes curling out of the sides)
    for (x0, y0, x1, y1) in ((6, 19, 1, 25), (1, 25, 2, 31), (6, 24, 3, 28), (3, 28, 4, 34)):
        g.line(x0, y0, x1, y1, 'v')
        g.line(x0 + 1, y0, x1 + 1, y1, 'j')
    # the rack
    g.rect(6, 13, 26, 21, 'B')
    g.vline(6, 13, 33, 'C'); g.vline(7, 13, 33, 'C')
    g.vline(30, 13, 33, 'A'); g.vline(31, 13, 33, 'A')
    g.hline(6, 31, 33, 'A')
    for i, y in enumerate((15, 19, 23, 27)):
        g.rect(9, y, 20, 3, 'D')
        g.hline(9, 28, y + 2, 'A')
        g.px(10, y + 1, 'M' if i % 2 == 0 else 'R')
        g.px(12, y + 1, 'R' if i % 2 == 0 else 'M')
        for x in range(15, 27, 2):
            g.px(x, y + 1, 'C')
    # the head: a monitor with one angry red eye
    g.rect(8, 2, 22, 12, 'C')
    g.hline(8, 29, 2, 'I'); g.vline(8, 2, 13, 'I')
    g.vline(29, 3, 13, 'B'); g.hline(9, 29, 13, 'B')
    g.rect(10, 4, 18, 8, 'D')
    g.ellipse(19, 8, 4.2, 3.0, 'R')
    g.ellipse(19, 8.5, 2.2, 1.7, 'k')
    g.px(17, 6, 'l'); g.px(18, 6, 'l'); g.px(17, 7, 'w')
    g.line(12, 5, 16, 6, 'k'); g.line(26, 5, 22, 6, 'k')
    # its neck and antennas with lights
    g.rect(16, 12, 6, 2, 'A')
    g.vline(11, 0, 1, 'x'); g.px(11, 0, 'M')
    g.vline(26, 0, 1, 'x'); g.px(26, 0, 'R')
    # feet
    g.rect(10, 34, 6, 4, 'A'); g.rect(22, 34, 6, 4, 'A')
    g.hline(10, 15, 37, 'D'); g.hline(22, 27, 37, 'D')
    g.hline(10, 15, 34, 'C'); g.hline(22, 27, 34, 'C')
    g.outline()
    return g.rows()


def broker():
    g = Grid(36, 44)
    # legs and shoes
    g.rect(12, 33, 5, 8, 'j'); g.rect(19, 33, 5, 8, 'j')
    g.vline(12, 33, 40, 'v'); g.vline(19, 33, 40, 'v')
    g.rect(11, 40, 7, 3, 'D'); g.rect(18, 40, 7, 3, 'D')
    g.hline(12, 16, 40, 'A'); g.hline(19, 23, 40, 'A')
    # the suit
    g.rect(8, 16, 20, 18, 'j')
    g.vline(8, 16, 33, 'v'); g.vline(9, 16, 33, 'v')
    g.vline(27, 16, 33, 'D')
    # shirt and lapels (a white V) and a pink tie
    for i in range(7):
        g.hline(15 - (6 - i) // 2, 20 + (6 - i) // 2, 16 + i, 'w')
    for i in range(7):
        g.px(14 - (6 - i) // 2 - 0, 16 + i, 'v'); g.px(21 + (6 - i) // 2, 16 + i, 'D')
    g.rect(17, 16, 2, 10, 'P'); g.px(17, 16, 'K'); g.vline(18, 17, 25, 'Q')
    g.hline(16, 19, 26, 'P'); g.hline(17, 18, 27, 'Q')
    # arms: one hand at its side, the other holding a briefcase
    g.rect(5, 17, 4, 13, 'j'); g.vline(5, 17, 29, 'v'); g.rect(5, 29, 4, 2, '6')
    g.rect(27, 17, 4, 11, 'j'); g.vline(30, 17, 27, 'D'); g.rect(27, 27, 4, 2, '6')
    g.rect(25, 29, 10, 8, 'y'); g.hline(25, 34, 29, 'u'); g.hline(25, 34, 36, 'o'); g.vline(34, 30, 36, 'o')
    g.rect(28, 27, 4, 2, 'o'); g.rect(29, 28, 2, 1, '.')
    g.rect(29, 31, 2, 3, 'h'); g.px(29, 31, 'Y'); g.px(30, 31, 'Y')
    # the head: an old TV with one big watching eye, rabbit-ear antennas
    g.rect(7, 3, 22, 14, 'C')
    g.hline(7, 28, 3, 'I'); g.vline(7, 3, 16, 'I')
    g.vline(28, 4, 16, 'B'); g.hline(8, 28, 16, 'B')
    g.rect(9, 5, 15, 10, 'T')
    g.rect(24, 5, 3, 10, 'B'); g.px(25, 7, 'R'); g.px(25, 10, 'M'); g.px(25, 12, 'Y')
    g.ellipse(16.5, 10, 6, 3.6, 'w', only='T')
    g.ellipse(16.5, 10, 3.0, 3.0, 'S')
    g.ellipse(16.5, 10, 1.6, 1.6, 'h')
    g.px(15, 8, 'w'); g.px(15, 9, 'n')
    g.line(9, 5, 23, 5, 'S')
    g.line(13, 2, 10, 0, 'x'); g.line(21, 2, 24, 0, 'x')
    g.px(10, 0, 'R'); g.px(24, 0, 'R')
    g.outline()
    return g.rows()


def overfit():
    g = Grid(46, 42)
    # neuron legs below
    for (x0, x1) in ((12, 7), (18, 16), (27, 29), (33, 38)):
        g.line(x0, 30, x1, 40, 'v')
        g.line(x0 + 1, 30, x1 + 1, 40, 'j')
    # the brain
    g.ellipse(23, 18, 20, 15, 'P')
    g.ellipse(21, 14, 15, 9, 'K', only='P')
    g.edge('P', 'Q', 1, 0); g.edge('P', 'Q', 0, 1)
    # folds
    for (x0, y0, x1, y1) in ((10, 12, 15, 10), (15, 10, 19, 13), (26, 9, 31, 12), (31, 12, 35, 10), (8, 20, 13, 23),
                             (32, 22, 37, 19), (19, 27, 25, 25), (25, 25, 29, 28)):
        g.line(x0, y0, x1, y1, 'Q')
    # its eyes: one huge, many small (it memorized everything)
    g.ellipse(23, 18, 6.5, 5.2, 'w')
    g.ellipse(23, 18.5, 3.6, 3.6, 'M')
    g.ellipse(23, 18.5, 1.8, 1.9, 'h')
    g.px(21, 16, 'w'); g.px(22, 16, 'w')
    for (x, y) in ((11, 15), (35, 15), (16, 25), (30, 26), (14, 7), (32, 7), (23, 6), (8, 19), (38, 20)):
        g.rect(x - 1, y - 1, 3, 3, 'w')
        g.px(x, y, 'h')
        g.px(x, y + 1, 'h')
    # glitch: a few rows slid sideways with colour fringes
    for y, s in ((11, 2), (21, -2), (28, 3)):
        row = g.g[y][:]
        for x in range(g.w):
            src = x - s
            g.g[y][x] = row[src] if 0 <= src < g.w else '.'
        xs = [x for x in range(g.w) if g.g[y][x] != '.']
        if xs:
            g.px(xs[0] - 1, y, 'M'); g.px(xs[-1] + 1, y, 'S')
    g.outline()
    return g.rows()


def fmt(name, rows, note):
    out = f'  // {note}\n  {name}: [\n'
    out += ''.join(f"    '{r}',\n" for r in rows)
    return out + '  ],\n'


block = '  // <bosses> (written by tools/games/lastmodel/bosses.py: edit it there)\n'
block += fmt('botnet', botnet(), 'BOTNET (38 × 40): a server rack with one angry eye, cables trailing')
block += fmt('broker', broker(), 'DATA BROKER (36 × 44): a suited TV-head that watches you, holding a briefcase')
block += fmt('overfit', overfit(), 'THE OVERFIT (46 × 42): a glitching brain that memorized everything')
block += '  // </bosses>\n'
src = open(SRC).read()
if '// <bosses>' in src:
    src = re.sub(r'  // <bosses>.*?// </bosses>\n', lambda m: block, src, flags=re.S)
else:
    i = src.rindex('};')          # the end of SPRITES (the file's last object)
    src = src[:i] + block + src[i:]
open(SRC, 'w').write(src)
print('bosses written')
