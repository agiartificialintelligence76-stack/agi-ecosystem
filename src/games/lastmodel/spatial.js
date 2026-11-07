// LAST MODEL STANDING: a spatial hash for an endless floor. Items (anything with x, y and r) go in square cells; a cell's
// bucket is found by hashing its coordinates into a fixed table, so the floor never ends and nothing grows. Rebuilt every
// step (clear, insert each bot); a query returns the items whose circles touch a circle, each once. No allocation after
// it's made: buckets are linked lists in typed arrays, and a query writes into the caller's array.
export class SpatialHash {
  constructor({ cell = 24, max = 512, bits = 11 } = {}) {
    this.cell = cell;
    this.inv = 1 / cell;
    this.size = 1 << bits;
    this.mask = this.size - 1;
    this.head = new Int32Array(this.size).fill(-1);
    this.next = new Int32Array(max).fill(-1);
    this.stamp = new Uint32Array(max);
    this.mark = 0;
    this.items = null;
    this.n = 0;
  }
  key(cx, cy) { return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask; }
  // start again with this list of items (an array of objects with x, y, r)
  clear(items) {
    this.head.fill(-1);
    this.items = items;
    this.n = 0;
  }
  // put item i (its index in the list) in its cell
  insert(i) {
    const it = this.items[i];
    const h = this.key(Math.floor(it.x * this.inv), Math.floor(it.y * this.inv));
    this.next[i] = this.head[h];
    this.head[h] = i;
    this.n++;
  }
  // every item whose circle touches (x, y, r), at most out.length of them, into `out`; → how many
  query(x, y, r, out, pad = 24) {
    const items = this.items;
    if (!items) return 0;
    if (++this.mark === 0xffffffff) { this.stamp.fill(0); this.mark = 1; }
    const mark = this.mark, inv = this.inv;
    // the cells the circle (and the biggest body, `pad`) can reach
    const reach = r + pad;
    const cx0 = Math.floor((x - reach) * inv), cx1 = Math.floor((x + reach) * inv);
    const cy0 = Math.floor((y - reach) * inv), cy1 = Math.floor((y + reach) * inv);
    let n = 0;
    const cap = out.length;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let i = this.head[this.key(cx, cy)]; i !== -1; i = this.next[i]) {
          if (this.stamp[i] === mark) continue;
          this.stamp[i] = mark;
          const it = items[i];
          const dx = it.x - x, dy = it.y - y, rr = r + it.r;
          if (dx * dx + dy * dy <= rr * rr) {
            out[n++] = i;
            if (n >= cap) return n;
          }
        }
      }
    }
    return n;
  }
}
