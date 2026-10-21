// The relay's requests (2026-10-21, #404). Two kinds:
//   • trusted: to the addresses in its settings (DexScreener, clank.trade, Helius, the IPFS gateways), as they are
//   • safe: to an address a coin gave (its metadata, its picture): https only, port 443, a public address only (the name
//     is looked up first, every address it has must be public, and the connection goes to that same address, so a name
//     can't be pointed at the server itself or Hetzner's own network halfway), never a redirect
// Both: a deadline for the whole answer and a size limit (an answer over it is cut off and refused).
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

export class NetError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const UA = 'Mozilla/5.0 (compatible; AGI1TrenchRelay/1.0; +https://agi1.app/games/trenchingsimulator)';

// ---------- public addresses ----------

const v4 = (ip) => ip.split('.').map(Number);
function publicV4(ip) {
  const p = v4(ip);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return false;
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this network, private, loopback, multicast, reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // shared (carrier) space
  if (a === 169 && b === 254) return false; // link-local (Hetzner's own metadata service lives here)
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
function expandV6(ip) {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  // an IPv4 address at its end (::ffff:1.2.3.4): as its two groups
  if (s.includes('.')) {
    const i = s.lastIndexOf(':');
    const p = v4(s.slice(i + 1));
    if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return null;
    s = `${s.slice(0, i + 1)}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  let parts;
  const dbl = s.indexOf('::');
  if (dbl >= 0) {
    const h = s.slice(0, dbl).split(':').filter(Boolean);
    const r = s.slice(dbl + 2).split(':').filter(Boolean);
    const fill = 8 - h.length - r.length;
    if (fill < 0) return null;
    parts = [...h, ...Array(fill).fill('0'), ...r];
  } else parts = s.split(':');
  if (parts.length !== 8 || parts.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return parts.map((x) => parseInt(x, 16));
}
function publicV6(ip) {
  const w = expandV6(ip);
  if (!w || w.some((x) => !(x >= 0 && x <= 0xffff))) return false;
  if (w.every((x) => x === 0)) return false; // ::
  if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return false; // ::1
  // an IPv4 address inside (::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d): judged as IPv4
  const embedded = `${w[6] >> 8}.${w[6] & 255}.${w[7] >> 8}.${w[7] & 255}`;
  if (w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0)) return publicV4(embedded);
  if (w[0] === 0x64 && w[1] === 0xff9b) return publicV4(embedded);
  if ((w[0] & 0xfe00) === 0xfc00) return false; // unique local
  if ((w[0] & 0xffc0) === 0xfe80) return false; // link-local
  if ((w[0] & 0xff00) === 0xff00) return false; // multicast
  if (w[0] === 0x2001 && w[1] === 0x0db8) return false; // documentation
  if (w[0] === 0x0100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return false; // discard
  return true;
}
export function isPublicIp(ip) {
  const kind = net.isIP(String(ip || ''));
  if (kind === 4) return publicV4(ip);
  if (kind === 6) return publicV6(ip);
  return false;
}

// ---------- one request ----------

function request(u, { method = 'GET', body = null, headers = {}, timeoutMs = 8000, maxBytes = 1_000_000, lookup = null,
  servername = undefined } = {}) {
  const mod = u.protocol === 'https:' ? https : u.protocol === 'http:' ? http : null;
  if (!mod) return Promise.reject(new NetError('not_allowed'));
  return new Promise((resolve, reject) => {
    let done = false;
    let timer = null;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(val);
    };
    const opts = { method, headers: { 'User-Agent': UA, ...headers }, agent: false };
    if (lookup) opts.lookup = lookup;
    if (servername) opts.servername = servername;
    let req;
    try {
      req = mod.request(u, opts, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          req.destroy();
          return finish(new NetError('redirect', status));
        }
        const len = Number(res.headers['content-length']);
        if (Number.isFinite(len) && len > maxBytes) {
          req.destroy();
          return finish(new NetError('too_big', status));
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            finish(new NetError('too_big', status));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => finish(null, { status, type: String(res.headers['content-type'] || '').toLowerCase(),
          bytes: Buffer.concat(chunks) }));
        res.on('error', (e) => finish(e));
        res.on('aborted', () => finish(new NetError('cut_off', status)));
      });
    } catch (e) {
      finish(e);
      return;
    }
    timer = setTimeout(() => {
      req.destroy();
      finish(new NetError('timeout'));
    }, timeoutMs);
    req.on('error', (e) => finish(e));
    if (body != null) req.write(body);
    req.end();
  });
}

// ---------- trusted: the addresses in its settings ----------

export function trustedGet(raw, opts = {}) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return Promise.reject(new NetError('bad_url'));
  }
  return request(u, opts);
}

export async function trustedJson(raw, { timeoutMs = 8000, maxBytes = 2_000_000, method = 'GET', body = null } = {}) {
  const headers = { Accept: 'application/json' };
  let payload = null;
  if (body != null) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const r = await trustedGet(raw, { timeoutMs, maxBytes, method, body: payload, headers });
  if (r.status !== 200 && r.status !== 207) throw new NetError(`http_${r.status}`, r.status);
  try {
    return JSON.parse(r.bytes.toString('utf8'));
  } catch {
    throw new NetError('not_json', r.status);
  }
}

// ---------- safe: an address a coin gave ----------

export async function safeGet(raw, { timeoutMs = 8000, maxBytes = 1_000_000, accept = '*/*',
  resolve = (h) => dns.promises.lookup(h, { all: true, verbatim: true }) } = {}) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new NetError('bad_url');
  }
  if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password) throw new NetError('not_allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host.length > 253) throw new NetError('bad_url');
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host, family: net.isIP(host) }];
  else {
    const started = Date.now();
    addrs = await Promise.race([resolve(host), new Promise((_, no) => setTimeout(() => no(new NetError('timeout')), Math.min(3000, timeoutMs)))]);
    timeoutMs = Math.max(500, timeoutMs - (Date.now() - started));
  }
  if (!Array.isArray(addrs) || !addrs.length || addrs.some((a) => !a || !isPublicIp(a.address))) throw new NetError('private_address');
  const pick = addrs[0];
  const lookup = (_h, o, cb) => {
    if (o && o.all) cb(null, [{ address: pick.address, family: pick.family }]);
    else cb(null, pick.address, pick.family);
  };
  return request(u, { timeoutMs, maxBytes, lookup, servername: net.isIP(host) ? undefined : host, headers: { Accept: accept } });
}
