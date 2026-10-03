// CloakMesh's page (inference.agi1.app, 2026-10-03): "See what leaves your device", a small version of CloakMesh's filter
// (local_filter.py in the CloakMesh project) for this page. It runs only in the visitor's browser: nothing here sends,
// stores or logs anything (no network calls at all: tests/cloakmesh.test.js checks this file).
// Like the real filter, each value becomes a keyed token, [CATEGORY_CODE], where CODE is the first 8 letters of
// base32(HMAC-SHA256(a key made for this page visit, category ‖ 0x1F ‖ the value)): the same value always gets the same
// token, and the map back stays here. The real filter catches more (and also runs on your own machine, not a web page).

// The categories, the real filter's names (most important first: when two finds overlap, the first one here wins)
export const ORDER = ['PRIVATE_KEY', 'SEED_PHRASE', 'API_KEY', 'CRYPTO_PRIVATE_KEY', 'SECRET', 'EMAIL', 'IBAN', 'CARD',
  'CRYPTO_ADDRESS', 'GOV_ID', 'PHONE', 'IP_ADDRESS', 'PERSON'];
const RANK = new Map(ORDER.map((c, i) => [c, i]));

// what each category is, in plain words (the page's legend)
export const KINDS = {
  PERSON: 'a name', EMAIL: 'an email address', PHONE: 'a phone number', CARD: 'a card number', IBAN: 'a bank account (IBAN)',
  GOV_ID: 'an ID number', IP_ADDRESS: 'an IP address', API_KEY: 'an API key', SECRET: 'a password or secret',
  PRIVATE_KEY: 'a private key', SEED_PHRASE: 'a seed phrase', CRYPTO_PRIVATE_KEY: 'a wallet private key',
  CRYPTO_ADDRESS: 'a wallet address',
};

// …and more than one of them
export const KINDS_MANY = {
  PERSON: 'names', EMAIL: 'email addresses', PHONE: 'phone numbers', CARD: 'card numbers', IBAN: 'bank accounts (IBANs)',
  GOV_ID: 'ID numbers', IP_ADDRESS: 'IP addresses', API_KEY: 'API keys', SECRET: 'passwords or secrets',
  PRIVATE_KEY: 'private keys', SEED_PHRASE: 'seed phrases', CRYPTO_PRIVATE_KEY: 'wallet private keys',
  CRYPTO_ADDRESS: 'wallet addresses',
};
// what was found, in words, in the order it first appears: ["a name", "2 email addresses", …]
export function foundInWords(found) {
  const counts = new Map();
  for (const f of found) counts.set(f.category, (counts.get(f.category) || 0) + 1);
  return [...counts].map(([c, n]) => (n === 1 ? KINDS[c] : `${n} ${KINDS_MANY[c]}`));
}

const digits = (s) => s.replace(/\D/g, '');

// payment cards: a card network's first digits and length, and the Luhn check (as the real filter does)
function luhn(num) {
  let sum = 0, double = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = num.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
// each card network's first digits and lengths: Visa, Mastercard, American Express, Diners, Discover, JCB
const NETWORKS = [
  [/^4/, [13, 16, 19]], [/^(?:5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/, [16]], [/^3[47]/, [15]], [/^3(?:0[0-5]|[689])/, [14, 15, 16, 17, 18, 19]],
  [/^6(?:011|4[4-9]|5|22)/, [16, 17, 18, 19]], [/^35/, [16, 17, 18, 19]],
];
const isCard = (raw) => {
  const n = digits(raw);
  return NETWORKS.some(([re, lengths]) => re.test(n) && lengths.includes(n.length)) && luhn(n) && !/^(\d)\1+$/.test(n);
};

// cards in a run of digits (single spaces or dashes between groups): the longest group window that is a card, then the next
// one after it ("4111 1111 1111 1111 2 times" is a card and a 2; "ref 12 4111 1111 1111 1111" a 12 and a card)
function* cardsIn(src) {
  for (const m of src.matchAll(/\b\d(?:[ -]?\d){12,46}\b/g)) {
    const groups = [...m[0].matchAll(/\d+/g)].map((g) => ({ start: m.index + g.index, end: m.index + g.index + g[0].length, len: g[0].length }));
    let from = 0;
    while (from < groups.length) {
      let best = null;
      for (let i = from; i < groups.length; i += 1) {
        let len = 0;
        for (let j = i; j < groups.length; j += 1) {
          len += groups[j].len;
          if (len > 19) break;
          if (len < 13) continue;
          const value = src.slice(groups[i].start, groups[j].end);
          if (isCard(value) && (!best || len > best.len || (len === best.len && i < best.i))) best = { i, j, len, value };
        }
        if (best) break;                                  // the first place a card starts wins
      }
      if (!best) break;
      yield { start: groups[best.i].start, end: groups[best.j].end, value: best.value };
      from = best.j + 1;
    }
  }
}

// IBANs: the mod-97 check
function isIban(raw) {
  const s = raw.replace(/\s+/g, '').toUpperCase();
  if (s.length < 15 || s.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return rest === 1;
}

// words that follow "Hi", "I'm"… but aren't names
const NOT_NAMES = new Set(`a about after again all also always am an and any anyone anything are as at away back be been being
best better big bit both but by can cannot could customer dear did do does doing done down each else even every everyone
excited fine for from glad going gone good great guys had happy has have having he hello help her here hey hi him his hope
how however i if im in interested into is it its just last late let like looking lost me more most much must my need new
next no not now of off ok okay on one only or other our out over please pleased ready really right same see she should
since sir madam so some someone something sorry still such sure team thank thanks that the their them then there these
they thinking this those through to too trying under up us very was we well were what when where which while who why will
with working world writing yes yet you your yours folks friend friends everybody somebody nobody support sales admin
service services billing account manager mr mrs ms mx dr prof monday tuesday wednesday thursday friday saturday
sunday january february march april may june july august september october november december`.split(/\s+/));
// one word of a name: "Anna", "O'Neil", "McDonald", "Mary-Jane", "Łukasz"
const NAME_WORD = "(?:\\p{Lu}['’]\\p{Lu}[\\p{Ll}\\p{M}]+|\\p{Lu}[\\p{Ll}\\p{M}]+(?:\\p{Lu}[\\p{Ll}\\p{M}]+)?(?:['’-]\\p{Lu}?[\\p{Ll}\\p{M}]+)?)";
// a cue ("I'm", "my name is", "Dear", "Thanks,"…), maybe a title, then the name; or a title alone ("Dr. Lee")
const CUES = "I['’]m|I am|[Mm]y name is|[Mm]y name['’]s|[Nn]ame is|[Cc]all me|[Ss]igned|[Rr]egards|[Tt]hanks|[Cc]heers|[Dd]ear|[Hh]i|[Hh]ello|[Hh]ey";
const TITLES = 'Mr|Mrs|Ms|Mx|Dr|Prof';
const NAME_RE = new RegExp(`(?:\\b(?:${CUES})[,:]?\\s+(?:(?:${TITLES})\\.?\\s+)?|\\b(?:${TITLES})\\.?\\s+)`
  + `(${NAME_WORD}(?:[ \\t]+${NAME_WORD}){0,2})(?![\\p{L}\\p{M}])`, 'gu');

// (built from pieces, so this file never contains the start of a real key block)
const PEM = new RegExp(`-----BEGIN (?:[A-Z]+ )*${'PRIVATE'} KEY-----[\\s\\S]{1,8000}?-----END (?:[A-Z]+ )*${'PRIVATE'} KEY-----`, 'g');

// words that can follow "password" or "token" without being one ("the password is correct")
const COMMON = new Set(`the this that these those here there below above same same mine yours ours valid invalid expired wrong
correct changed reset required needed missing working broken incorrect empty blank fine ok okay good weak strong long short
new old again also still just only please thanks sent saved stored for and but with from into about over under`.split(/\s+/));

// Each finder: [category, a regular expression (global), the capture group that holds the value (0 = all), a check of
// (the value, the whole text, where the value starts)], or [category, a function that finds them itself]
const FINDERS = [
  ['PRIVATE_KEY', PEM, 0],
  ['SEED_PHRASE', /\b(?:seed(?: phrase| words)?|recovery (?:phrase|words)|mnemonic|secret (?:recovery )?phrase)(?:\s+(?:is|are|was))?\s*[:=]?\s*((?:[a-z]{3,8}[ ,]+){11,23}[a-z]{3,8})\b/gi, 1],
  ['API_KEY', /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|[sr]k_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|glpat-[A-Za-z0-9_-]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|hf_[A-Za-z0-9]{30,})\b/g, 0],
  ['CRYPTO_PRIVATE_KEY', /\b(?:private key|priv(?:ate)? ?key|secret key)\b[^\n]{0,24}?\b((?:0x)?[0-9a-fA-F]{64})\b/gi, 1],
  // a password or secret after its cue: "password: …", "my password is …", "pwd=…", "Bearer …"; "PIN", "secret" and "token"
  // only with "is", ":" or "=" ("pin this tab" isn't a PIN)
  ['SECRET', /\b(?:(?:password|passwd|passcode|pwd|api[ _-]?key|bearer)(?:\s+(?:is|was)\s+|\s*[:=]\s*|\s+)|(?:pin|secret|token)(?:\s+(?:is|was)\s+|\s*[:=]\s*))["'“]?([^\s"'”]{3,79}[^\s"'”.,;:)])/gi, 1, (v) => !COMMON.has(v.toLowerCase())],
  ['EMAIL', /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}\b/g, 0],
  ['IBAN', /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, 0, isIban],
  ['CARD', cardsIn],
  ['CRYPTO_ADDRESS', /\b0x[0-9a-fA-F]{40}\b/g, 0],
  ['GOV_ID', /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b|\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/g, 0],
  ['PHONE', /(?:\+\d{1,3}[ .-]?(?:\(\d{1,4}\)[ .-]?)?\d{1,4}(?:[ .-]?\d{2,4}){1,4}|\(\d{3}\) ?\d{3}[ .-]\d{4}|\b[2-9]\d{2}[.-]\d{3}[.-]\d{4}\b|\b0\d{2,4}[ -]\d{3,4}[ -]?\d{3,4}\b)/g, 0, (v, src, start) => {
    const n = digits(v).length;
    // 9 to 15 digits, and not a piece of a longer run of numbers (an account number, a bad IBAN)
    return n >= 9 && n <= 15 && !/\d[ -]$/.test(src.slice(Math.max(0, start - 2), start)) && !/^[ -]?\d/.test(src.slice(start + v.length, start + v.length + 2));
  }],
  // (not a version number: "version 1.2.3.4", "v1.2.3.4")
  ['IP_ADDRESS', /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g, 0,
    (v, src, start) => !/(?:version|ver\.?|build|release|v)\s*$/i.test(src.slice(Math.max(0, start - 12), start))],
];

// All the values worth hiding in `text` → [{ start, end, category, value }], in order, never overlapping
export function findValues(text) {
  const src = String(text ?? '');
  const found = [];
  for (const [category, re, group, check] of FINDERS) {
    if (typeof re === 'function') {                       // a finder of its own (cards)
      for (const f of re(src)) found.push({ ...f, category });
      continue;
    }
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      const value = m[group];
      if (!value) continue;
      const start = m.index + (group ? m[0].lastIndexOf(value) : 0);
      if (check && !check(value, src, start)) continue;
      // an email address must start a word (not "name.surname@" glued to something else)
      if (category === 'EMAIL' && start > 0 && /[A-Za-z0-9._%+-]/.test(src[start - 1])) continue;
      found.push({ start, end: start + value.length, category, value });
    }
  }
  // names after a cue ("I'm Anna Kowalski", "Dear Dr. Lee"), then every other place the same name, or a part of it, appears
  const names = new Set();
  for (const m of src.matchAll(NAME_RE)) {
    let words = m[1].split(/\s+/);
    while (words.length && NOT_NAMES.has(words[0].toLowerCase())) words = words.slice(1);
    // stop at the first word that isn't a name ("Anna Thanks" → "Anna")
    const cut = words.findIndex((w) => NOT_NAMES.has(w.toLowerCase().replace(/['’].*$/, '')));
    if (cut >= 0) words = words.slice(0, cut);
    if (!words.length) continue;
    const name = words.join(' ');
    const start = m.index + m[0].lastIndexOf(m[1]) + m[1].indexOf(words[0]);
    found.push({ start, end: start + name.length, category: 'PERSON', value: name });
    names.add(name);
    if (words.length > 1) for (const w of words) if (w.length >= 3) names.add(w);
  }
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const m of src.matchAll(new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'gu'))) {
      found.push({ start: m.index, end: m.index + name.length, category: 'PERSON', value: name });
    }
  }
  // the most important finds first, then the longest; a find that overlaps one already taken is dropped
  found.sort((a, b) => (RANK.get(a.category) - RANK.get(b.category)) || ((b.end - b.start) - (a.end - a.start)) || (a.start - b.start));
  const taken = [];
  for (const f of found) {
    if (taken.some((t) => f.start < t.end && t.start < f.end)) continue;
    taken.push(f);
  }
  return taken.sort((a, b) => a.start - b.start);
}

// How a value is written doesn't matter: "4111 1111 1111 1111" and "4111111111111111" are one card, "Anna" and "anna" one name
export function normalized(category, value) {
  if (['CARD', 'PHONE'].includes(category)) return digits(value);
  if (['IBAN', 'GOV_ID'].includes(category)) return value.replace(/[\s-]+/g, '').toUpperCase();
  if (['EMAIL', 'PERSON', 'CRYPTO_ADDRESS', 'CRYPTO_PRIVATE_KEY'].includes(category)) return value.normalize('NFKC').toLowerCase();
  if (category === 'SEED_PHRASE') return value.toLowerCase().split(/[\s,]+/).filter(Boolean).join(' ');
  return value;
}

// base32 (RFC 4648), as the real filter writes its codes
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes) {
  let out = '', bits = 0, acc = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

// A token maker for one page visit: a fresh random key, HMAC-SHA256 through the browser's own cryptography
export async function tokenMaker(keyBytes = crypto.getRandomValues(new Uint8Array(32))) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const enc = new TextEncoder();
  return async (category, value) => {
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${category}\u001f${normalized(category, value)}`)));
    return `[${category}_${base32(mac).slice(0, 8)}]`;
  };
}

// Where the browser's cryptography isn't available (a page that isn't https), a plain keyed hash (FNV-1a, 64 bits) does for
// the demo: the tokens look the same, and the same value still gets the same token
export function plainTokenMaker(salt = String(Math.random()).slice(2)) {
  return async (category, value) => {
    let h = 0xcbf29ce484222325n;
    for (const ch of `${salt}\u001f${category}\u001f${normalized(category, value)}`) {
      h ^= BigInt(ch.codePointAt(0));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    const bytes = [];
    for (let i = 0; i < 8; i += 1) bytes.push(Number((h >> BigInt(8 * i)) & 0xffn));
    return `[${category}_${base32(bytes).slice(0, 8)}]`;
  };
}

// `text` with every value found replaced by its token → { text, map (token → the value as it was written), found }
export async function scrub(text, makeToken) {
  const src = String(text ?? '');
  const found = findValues(src);
  const map = new Map();
  let out = '', at = 0;
  const parts = [];
  for (const f of found) {
    const token = await makeToken(f.category, f.value);
    if (!map.has(token)) map.set(token, f.value);
    parts.push({ text: src.slice(at, f.start) }, { text: token, token: true, category: f.category });
    out += src.slice(at, f.start) + token;
    at = f.end;
  }
  parts.push({ text: src.slice(at) });
  out += src.slice(at);
  return { text: out, map, found, parts: parts.filter((p) => p.text) };
}

// Tokens back to the values (on your device): what you read
export const TOKEN = /\[([A-Z_]{2,20})_([A-Z2-7]{8})\]/g;
export const restore = (text, map) => String(text ?? '').replace(TOKEN, (t) => (map.has(t) ? map.get(t) : t));

// The demo's made-up answer: what a model might write back, using only the tokens it was given (the first of each kind)
export function exampleAnswer(scrubbed) {
  const first = new Map();
  for (const p of scrubbed.parts) if (p.token && !first.has(p.category)) first.set(p.category, p.text);
  const t = (c) => first.get(c);
  const lines = [];
  lines.push(t('PERSON') ? `Here's a reply you can send, ${t('PERSON')}:` : "Here's a reply you can send:");
  const asks = [];
  if (t('CARD')) asks.push(`my card ${t('CARD')} was charged twice. Please refund the second payment`);
  if (t('IBAN')) asks.push(`please send the refund to ${t('IBAN')}`);
  if (!asks.length) asks.push('thanks for getting back to me so quickly');
  const reach = [t('EMAIL'), t('PHONE')].filter(Boolean);
  let body = `“Hello, ${asks.join(', and ')}.`;
  if (reach.length) body += ` You can reach me at ${reach.join(' or ')}.`;
  if (t('PERSON')) body += ` Best, ${t('PERSON')}”`;
  else body += '”';
  lines.push(body);
  const secret = ['SEED_PHRASE', 'PRIVATE_KEY', 'CRYPTO_PRIVATE_KEY', 'API_KEY', 'SECRET'].find((c) => t(c));
  if (secret) lines.push(`One more thing: ${t(secret)} looks like ${KINDS[secret]}. Never paste it into a chat; if it's real, change it now.`);
  return lines.join('\n\n');
}
