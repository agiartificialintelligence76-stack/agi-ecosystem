# LAST MODEL STANDING: the art drawn with a few primitives (fills, ellipses, lines, an automatic ink outline) instead of
# by hand: the three bosses, the shots and pickups, and the icons on the cards and in the HUD. Each set is written into
# src/games/lastmodel/sprites.js between its markers ("<bosses>", "<items>", "<icons>"); the hand-drawn sprites around
# them are left alone. Run: python3 tools/games/lastmodel/draw.py   (then preview.py to look at them)
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
        # and the other side's
        g.line(37 - x0, y0 - 2, 37 - x1, y1 - 2, 'v')
        g.line(36 - x0, y0 - 2, 36 - x1, y1 - 2, 'j')
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



def ring_arrow(n=11, c='Y', hi='u', lo='y'):
    # BACKPROP: a circular arrow (a ring with a gap and a head)
    import math
    g = Grid(n, n)
    cx = cy = n / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            a = math.degrees(math.atan2(y + 0.5 - cy, x + 0.5 - cx))
            if 2.4 <= d <= 4.6 and not (-75 <= a <= -15):
                g.px(x, y, hi if (x + y) < n - 2 and d < 3.6 else lo if (x + y) > n + 1 else c)
    # the head, at the gap's start (pointing clockwise)
    for (x, y) in ((n - 4, 1), (n - 3, 1), (n - 2, 1), (n - 3, 2), (n - 2, 2), (n - 2, 3)):
        g.px(x, y, c)
    g.outline()
    return g.rows()


def chip(size, body, light, dark, pins):
    # an XP chip: a little microchip
    g = Grid(size, size)
    m = (size - pins) // 2
    b0, b1 = 1, size - 2
    g.rect(b0 + 1, b0 + 1, size - 4, size - 4, body)
    for k in range(pins):
        p = m + k
        if p % 2 == (m % 2):
            g.px(b0, p, dark); g.px(b1, p, dark); g.px(p, b0, dark); g.px(p, b1, dark)
    g.hline(b0 + 1, b1 - 2, b0 + 1, light); g.vline(b0 + 1, b0 + 1, b1 - 2, light)
    g.hline(b0 + 2, b1 - 1, b1 - 1, dark); g.vline(b1 - 1, b0 + 2, b1 - 1, dark)
    g.outline()
    return g.rows()


def heart(c='P', hi='K', lo='Q'):
    rows = ['.hh...hh.', 'hKPh.hPPh', 'hKPPhPPQh', 'hPPPPPPQh', '.hPPPPQh.', '..hPPQh..', '...hQh...', '....h....']
    return [r.replace('P', c).replace('K', hi).replace('Q', lo) for r in rows]


def magnet():
    return ['.hhh..hhh.', 'hwwh..hwwh', 'hqqh..hqqh', 'hRRh..hRkh', 'hlRh..hRkh', 'hlRhhhhRkh', 'hlRRRRRRkh', '.hRRRRRkh.', '..hhhhhh..']


def bomb():
    g = Grid(11, 12)
    g.ellipse(5, 7.5, 4.6, 4.3, 'j')
    g.ellipse(4.2, 6.4, 2.2, 1.8, 'v', only='j')
    g.px(3, 5, 'J'); g.px(4, 5, 'J')
    g.rect(4, 2, 3, 2, 'z')
    g.line(6, 2, 8, 0, 'o')
    g.px(9, 0, 'Y'); g.px(10, 0, 'u'); g.px(9, 1, 'u')
    g.outline()
    return g.rows()


def cache(open_=False):
    # a loot cache: violet with honey trim and a lock
    g = Grid(15, 14)
    if open_:
        g.rect(1, 6, 13, 7, 'v')
        g.rect(2, 7, 11, 2, 'u'); g.rect(3, 7, 9, 1, 'w')
        g.rect(1, 1, 13, 4, 'j'); g.hline(1, 13, 4, 'Y'); g.hline(2, 12, 1, 'V')
    else:
        g.rect(1, 2, 13, 4, 'v'); g.hline(2, 12, 1, 'v'); g.hline(2, 12, 2, 'V')
        g.rect(1, 6, 13, 7, 'v')
        g.hline(1, 13, 6, 'Y'); g.hline(1, 13, 7, 'y')
    g.vline(1, 6, 12, 'V'); g.vline(13, 6, 12, 'j'); g.hline(1, 13, 12, 'j')
    g.vline(4, 6, 12, 'Y'); g.vline(10, 6, 12, 'Y')
    if not open_:
        g.rect(6, 5, 3, 4, 'Y'); g.px(7, 6, 'h'); g.px(7, 7, 'h'); g.px(6, 5, 'u')
    g.outline()
    return g.rows()


def crate():
    # a breakable server crate with a blinking light
    g = Grid(13, 13)
    g.rect(1, 1, 11, 11, 'B')
    g.hline(1, 11, 1, 'I'); g.vline(1, 1, 11, 'C')
    g.hline(1, 11, 11, 'A'); g.vline(11, 2, 11, 'A')
    for y in (4, 6, 8):
        g.hline(3, 8, y, 'D')
    g.px(9, 4, 'M'); g.px(9, 6, 'Y'); g.px(9, 8, 'D')
    g.outline()
    return g.rows()


def bubble():
    # a TROLL's "??" bubble
    return ['.hhhhhhhhhhh.', 'hwwwwwwwwwwqh', 'hwwhhwwhhwwqh', 'hwwwwhwwwhwqh', 'hwwwhwwwhwwqh', 'hwwwwwwwwwwqh',
            'hwwwhwwwhwwqh', '.hqqqqqqqqqh.', '.hqhhhhhhhh..', '.hh..........']


def orb(n, c, hi, lo, core='w'):
    import math
    g = Grid(n, n)
    g.ellipse(n / 2, n / 2, n / 2 - 1, n / 2 - 1, c)
    g.edge(c, lo, 1, 0); g.edge(c, lo, 0, 1)
    g.ellipse(n / 2 - 0.6, n / 2 - 0.6, max(1, n / 2 - 2.6), max(1, n / 2 - 2.6), hi, only=c + lo)
    g.px(n // 2 - 1, n // 2 - 1, core)
    g.outline()
    return g.rows()


def cookie():
    g = Grid(9, 9)
    g.ellipse(4.5, 4.5, 3.6, 3.6, 'y')
    g.edge('y', 'o', 1, 0); g.edge('y', 'o', 0, 1)
    for (x, y) in ((3, 3), (5, 4), (3, 5), (5, 6)):
        g.px(x, y, '4')
    g.px(3, 2, 'u')
    g.outline()
    return g.rows()


def glitch():
    return ['.hhhhh.', 'hMMnMMh', 'hMnnMSh', 'hnnMMSh', 'hMMMSSh', 'hMSSSSh', '.hhhhh.']


def firewall(f=0):
    g = Grid(11, 12)
    # bricks
    g.rect(1, 4, 9, 7, 'R')
    for y in (6, 8):
        g.hline(1, 9, y, 'k')
    for (x, y) in ((4, 5), (7, 7), (3, 7), (5, 9), (8, 9), (2, 9)):
        g.px(x, y, 'k')
    g.hline(1, 9, 4, 'l'); g.vline(9, 5, 10, 'k')
    # flames on top (two flickers)
    tips = ((2, 3), (5, 2), (8, 3)) if f == 0 else ((3, 2), (6, 3), (8, 2))
    for (x, y) in tips:
        g.vline(x, y, 3, 'Y'); g.px(x, y - 1, 'u')
        g.px(x - 1, 3, 'y'); g.px(x + 1, 3, 'Y')
    g.outline()
    return g.rows()


def eye():
    return ['..hhhhh..', '.hwwwwwh.', 'hwwVVVwqh', 'hwVJhhVqh', 'hwVhhhVqh', 'hwwVVVwqh', '.hqqqqqh.', '..hhhhh..']


# ---------- icons (13 × 13) for the cards and the HUD ----------
def icon(draw, post=None):
    g = Grid(13, 13)
    draw(g)
    g.outline()
    if post:
        post(g)
    return g.rows()


def i_bolt(g):
    g.line(2, 2, 6, 6, 'M'); g.line(6, 6, 2, 10, 'M')
    g.line(3, 2, 7, 6, 'n'); g.line(7, 6, 3, 10, 'm')
    g.rect(7, 9, 5, 2, 'M'); g.hline(7, 11, 9, 'n')


def i_firewall(g):
    for r in firewall(1):
        pass
    rows = firewall(1)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != '.' and c != 'h':
                g.px(x + 1, y, c)


def i_stream(g):
    for k, y in enumerate((3, 6, 9)):
        for x in range(1 + k % 2, 12, 2):
            g.px(x, y, 'n' if x > 8 else 'M' if x > 4 else 'm')
        g.px(11, y, 'w')


def i_rain(g):
    cols = ((2, 1, 7), (6, 3, 10), (10, 0, 6))
    for (x, y0, y1) in cols:
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            g.px(x, y, 'v' if t < 0.34 else 'P' if t < 0.67 else 'Y')
            g.px(x + 1, y, 'j' if t < 0.34 else 'Q' if t < 0.67 else 'y')
        g.px(x, y1 + 1, 'u'); g.px(x + 1, y1 + 1, 'u')


def i_heads(g):
    rows = eye()
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c not in '.h':
                g.px(x + 3, y + 2, c)
    g.hline(0, 2, 5, 'K'); g.hline(1, 2, 7, 'P')


def i_backprop(g):
    rows = ring_arrow(13)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c not in '.h':
                g.px(x, y, c)


def i_field(g):
    import math
    for k in range(24):
        a = k / 24 * math.tau
        x, y = round(6 + math.cos(a) * 5), round(6 + math.sin(a) * 5)
        g.px(x, y, 'P' if k % 3 == 0 else 'M' if k % 3 == 1 else 'J')
    g.ellipse(6.5, 6.5, 2.4, 2.4, 'K')
    g.px(6, 6, 'w')


def i_nova(g):
    import math
    g.ellipse(6.5, 6.5, 5.6, 5.6, 'Y')
    g.ellipse(6.5, 6.5, 3.8, 3.8, '.')
    g.ellipse(6.5, 6.5, 1.6, 1.6, 'u')
    for k in range(8):
        a = k / 8 * math.tau
        g.px(round(6 + math.cos(a) * 6.4), round(6 + math.sin(a) * 6.4), 'w')


def i_compute(g):
    g.rect(3, 3, 7, 7, 'v')
    g.hline(3, 9, 3, 'V'); g.vline(3, 3, 9, 'V')
    g.rect(5, 5, 3, 3, 'J'); g.px(5, 5, 'w')
    for p in (4, 6, 8):
        g.px(p, 1, 'r'); g.px(p, 11, 'r'); g.px(1, p, 'r'); g.px(11, p, 'r')
        g.px(p, 2, 'r'); g.px(p, 10, 'r'); g.px(2, p, 'r'); g.px(10, p, 'r')


def i_context(g):
    import math
    for k in range(16):
        if k % 2:
            continue
        a = k / 16 * math.tau
        g.px(round(6 + math.cos(a) * 5.5), round(6 + math.sin(a) * 5.5), 'S')
    for (x, y) in ((6, 3), (6, 9), (3, 6), (9, 6)):
        g.px(x, y, 'M')
    g.px(6, 4, 'M'); g.px(6, 8, 'M'); g.px(4, 6, 'M'); g.px(8, 6, 'M')
    g.rect(5, 5, 3, 3, 'Y'); g.px(5, 5, 'u')


def i_memory(g):
    g.rect(1, 4, 11, 5, 'F')
    g.hline(1, 11, 4, 'G')
    for x in (2, 5, 8):
        g.rect(x, 5, 2, 2, 'h')
    for x in range(2, 11, 2):
        g.px(x, 9, 'Y')


def i_bandwidth(g):
    for ox, c, d in ((0, 'S', 's'), (5, 'T', 'S')):
        g.line(1 + ox, 2, 5 + ox, 6, c); g.line(5 + ox, 6, 1 + ox, 10, c)
        g.line(2 + ox, 2, 6 + ox, 6, d); g.line(6 + ox, 6, 2 + ox, 10, d)


def i_alignment(g):
    for y in range(1, 12):
        w = 5 if y < 7 else 5 - (y - 6)
        if w < 0:
            continue
        g.hline(6 - w, 6 + w, y, '9')
    g.hline(1, 11, 1, '8'); g.vline(1, 1, 6, '8')
    g.line(4, 6, 5, 7, 'h'); g.line(5, 7, 8, 4, 'h')


def i_finetune(g):
    for x, k in ((2, 7), (6, 3), (10, 5)):
        g.vline(x, 1, 11, 'x')
        g.rect(x - 1, k, 3, 2, 'Y'); g.px(x - 1, k, 'u')


def i_uptime(g):
    g.rect(2, 3, 8, 7, 'G'); g.vline(10, 5, 7, 'r')
    g.hline(2, 9, 3, 'E'); g.vline(2, 3, 9, 'E')
    g.hline(4, 7, 6, 'w'); g.vline(6, 5, 7, 'w')


def i_heal(g):
    # COFFEE BREAK: a mug with a heart on it
    g.rect(2, 4, 7, 7, 'w'); g.vline(8, 4, 10, 'q'); g.hline(2, 8, 10, 'q'); g.hline(2, 8, 4, 'y')
    g.vline(9, 5, 9, 'w'); g.vline(10, 5, 9, 'w'); g.px(9, 6, '.'); g.px(9, 7, '.'); g.px(9, 8, '.')
    g.px(4, 6, 'P'); g.px(6, 6, 'P'); g.hline(4, 6, 7, 'P'); g.px(5, 8, 'P')


def heal_steam(g):
    for (x, y) in ((4, 0), (3, 1), (4, 2), (6, 0), (7, 1), (6, 2)):
        g.px(x, y, 'z')


def i_bonus(g):
    for (x, y, r) in ((4, 4, 3), (9, 8, 2)):
        g.vline(x, y - r, y + r, 'Y'); g.hline(x - r, x + r, y, 'Y'); g.px(x, y, 'u')
    g.px(10, 2, 'u'); g.px(2, 10, 'u')


def i_hp(g):
    rows = heart()
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c not in '.h':
                g.px(x + 2, y + 2, c)


def i_dmg(g):
    g.line(2, 10, 9, 3, 'w'); g.line(3, 10, 10, 3, 'q')
    g.line(9, 2, 10, 3, 'w')
    g.line(3, 7, 5, 9, 'Y'); g.px(2, 10, 'y'); g.px(3, 11, 'y')


def i_speed(g):
    g.rect(2, 6, 8, 3, '9'); g.rect(2, 4, 4, 2, '9'); g.hline(2, 9, 9, 'c'); g.hline(2, 10, 10, 'a')
    g.px(10, 8, '9'); g.px(3, 4, '8'); g.px(4, 6, 'c'); g.px(6, 6, 'c')


def i_magnet(g):
    for y, row in enumerate(magnet()):
        for x, c in enumerate(row):
            if c not in '.h':
                g.px(x + 1, y + 2, c)


def i_xp(g):
    for y, row in enumerate(chip(11, 'M', 'n', 'm', 5)):
        for x, c in enumerate(row):
            if c not in '.h':
                g.px(x + 1, y + 1, c)


def i_reroll(g):
    g.rect(2, 2, 9, 9, 'w'); g.hline(2, 10, 10, 'q'); g.vline(10, 2, 10, 'q')
    for (x, y) in ((4, 4), (6, 6), (8, 8), (8, 4), (4, 8)):
        g.px(x, y, 'h')


def i_patch(g):
    # a PATCH: a little plaster/bandage with a plus
    g.rect(1, 4, 11, 5, 'K'); g.hline(1, 11, 4, 'w'); g.hline(1, 11, 8, 'P')
    g.rect(4, 3, 5, 7, 'w')
    g.vline(6, 4, 8, 'P'); g.hline(4, 8, 6, 'P')


def fmt(name, rows, note=None):
    out = f'  // {note}\n' if note else ''
    out += f'  {name}: [\n'
    out += ''.join(f"    '{r}',\n" for r in rows)
    return out + '  ],\n'


def write(tag, body):
    src = open(SRC).read()
    block = f'  // <{tag}> (written by tools/games/lastmodel/draw.py: edit it there)\n' + body + f'  // </{tag}>\n'
    if f'// <{tag}>' in src:
        src = re.sub(rf'  // <{tag}>.*?// </{tag}>\n', lambda m: block, src, flags=re.S)
    else:
        i = src.rindex('};')          # the end of SPRITES (the file's last object)
        src = src[:i] + block + src[i:]
    open(SRC, 'w').write(src)


write('bosses',
      fmt('botnet', botnet(), 'BOTNET (38 × 40): a server rack with one angry eye, cables trailing') +
      fmt('broker', broker(), 'DATA BROKER (36 × 44): a suited TV-head that watches you, holding a briefcase') +
      fmt('overfit', overfit(), 'THE OVERFIT (46 × 42): a glitching brain that memorized everything'))
write('items',
      fmt('chip0', chip(7, 'M', 'n', 'm', 3), 'XP chips: mint, honey, pink') +
      fmt('chip1', chip(9, 'Y', 'u', 'y', 5)) +
      fmt('chip2', chip(11, 'P', 'K', 'Q', 7)) +
      fmt('heart', heart(), 'pickups: a heart (heal), a magnet (every chip), a purge (every bot on the screen), a cache') +
      fmt('magnet', magnet()) + fmt('purge', bomb()) + fmt('cache', cache()) + fmt('cacheOpen', cache(True)) +
      fmt('crate', crate(), 'a server crate to break') +
      fmt('fire', firewall(0), 'shots: a FIREWALL block (two flickers), an ATTENTION eye, a BACKPROP boomerang') +
      fmt('fireB', firewall(1)) + fmt('eye', eye()) + fmt('boomer', ring_arrow()) +
      fmt('bubble', bubble(), 'the bots’ bullets: a TROLL’s “??”, BOTNET’s packets, DATA BROKER’s cookies, THE OVERFIT’s glitches') +
      fmt('packet', orb(8, 'R', 'l', 'k')) + fmt('cookie', cookie()) + fmt('glitch', glitch()))
icons = {'bolt': i_bolt, 'firewall': i_firewall, 'stream': i_stream, 'rain': i_rain, 'heads': i_heads,
         'backprop': i_backprop, 'field': i_field, 'nova': i_nova, 'compute': i_compute, 'context': i_context,
         'memory': i_memory, 'bandwidth': i_bandwidth, 'alignment': i_alignment, 'finetune': i_finetune,
         'uptime': i_uptime, 'heal': i_heal, 'bonus': i_bonus, 'hp': i_hp, 'dmg': i_dmg, 'speed': i_speed,
         'magnet': i_magnet, 'xp': i_xp, 'reroll': i_reroll, 'patch': i_patch}
POST = {'heal': heal_steam}
write('icons', ''.join(fmt(f'i_{k}', icon(f, POST.get(k)), 'icons (13 × 13): the weapons, the passives, the fallbacks, the Patch shop' if k == 'bolt' else None) for k, f in icons.items()))
print('written: bosses, items, icons')
