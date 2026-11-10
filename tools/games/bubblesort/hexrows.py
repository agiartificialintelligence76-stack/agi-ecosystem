# BUBBLE SORT's level shapes (2026-11-09): the levels were drawn in a compact notation (11 characters for a wide row,
# 10 for a narrow one) and turned into the board-shaped rows src/games/bubblesort/levels.js keeps ("a b c …", narrow rows
# indented by one). This checks a design: every row the right length, nothing floating, its colours, its memories.
#   python3 tools/games/bubblesort/hexrows.py design.txt     (blocks separated by blank lines, a "# name" line first)
import sys

def spaced(rows):
    out = []
    for r, row in enumerate(rows):
        want = 11 if r % 2 == 0 else 10
        if len(row) != want:
            raise SystemExit(f'row {r} "{row}": {len(row)} cells, wants {want}')
        out.append((' ' if r % 2 else '') + ' '.join(row))
    return out

def neighbours(r, c):
    wide = r % 2 == 0
    off = -1 if wide else 0
    res = [(r, c - 1), (r, c + 1)]
    for rr in (r - 1, r + 1):
        res += [(rr, c + off), (rr, c + off + 1)]
    return res

def check(name, rows):
    cells = {(r, c): ch for r, row in enumerate(rows) for c, ch in enumerate(row) if ch != '.'}
    seen, stack = set(), [(0, c) for c in range(11) if (0, c) in cells]
    seen.update(stack)
    while stack:
        r, c = stack.pop()
        for n in neighbours(r, c):
            if n in cells and n not in seen:
                seen.add(n); stack.append(n)
    loose = sorted(set(cells) - seen)
    colours = sorted({ch for ch in cells.values() if ch in 'abcdef'})
    mem = sum(1 for ch in cells.values() if ch == 'M')
    print(f'{name}: {len(cells)} cells, colours {"".join(colours)}, memories {mem}, rows {len(rows)}' + (f'  FLOATING {loose}' if loose else ''))
    return loose

if __name__ == '__main__' and '--write' not in sys.argv:
    text = open(sys.argv[1]).read().strip().split('\n\n')
    for block in text:
        lines = [l for l in block.strip().split('\n')]
        name = lines[0].lstrip('# ').strip()
        rows = [l.strip() for l in lines[1:]]
        check(name, rows)
        for s in spaced(rows):
            print(f"      '{s}',")

# python3 tools/games/bubblesort/hexrows.py tools/games/bubblesort/levels.txt --write
#   puts every design's rows into src/games/bubblesort/levels.js (each level's `rows: [ … ]`, found by its `n:`)
def write(path_txt, path_js='src/games/bubblesort/levels.js'):
    import re
    js = open(path_js).read()
    for block in open(path_txt).read().strip().split('\n\n'):
        lines = block.strip().split('\n')
        n = int(re.match(r'#\s*(\d+)', lines[0]).group(1))
        rows = [l.strip() for l in lines[1:]]
        if check(lines[0].lstrip('# '), rows):
            raise SystemExit('floating cells: not written')
        body = '\n'.join(f"      '{s}'," for s in spaced(rows))
        pat = re.compile(r"(\n    n: %d, [^\n]*\n(?:[^\n]*\n)*?    rows: \[\n)(?:      '[^']*',\n)+(    \],)" % n)
        js, k = pat.subn(lambda m: m.group(1) + body + '\n' + m.group(2), js, count=1)
        if k != 1:
            raise SystemExit(f'level {n}: not found in {path_js}')
    open(path_js, 'w').write(js)
    print('written', path_js)

if __name__ == '__main__' and '--write' in sys.argv:
    write(sys.argv[1])
