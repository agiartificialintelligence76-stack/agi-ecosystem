// What AGI-1 remembers about Crush and Soulmate wallets (Phase 3), stored in Supabase by supabase/levels.sql.
// Rows are keyed by the wallet's scrambled code (server/session.js → walletCode), never by the address itself.

const HINTS = {
  PGRST202: 'friend functions not found: run supabase/levels.sql in this Supabase project',
  401: 'Supabase rejected the key: check SUPABASE_SECRET_KEY is from the same project as SUPABASE_URL',
  403: 'no permission: SUPABASE_SECRET_KEY must be a secret key (sb_secret_…)',
  540: 'the Supabase project is paused: Supabase dashboard → the project → Resume project',
};

async function rpc(cfg, fn, args) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    let code = '';
    try { code = String((await res.json()).code || ''); } catch { /* not JSON */ }
    const err = new Error(`friends: ${fn} HTTP ${res.status}${code ? ` ${code}` : ''} (${HINTS[code] || HINTS[res.status] || 'see the Supabase logs'})`);
    err.code = code === 'PGRST202' ? 'not_ready' : 'busy';
    throw err;
  }
  return res.json();
}

const shape = (row) => ({
  name: typeof row?.name === 'string' ? row.name : null,
  notes: Array.isArray(row?.notes) ? row.notes.filter((n) => typeof n === 'string').slice(-8) : [],
});

export const getFriend = async (cfg, who) => shape(await rpc(cfg, 'friend_get', { p_who: who }));
export const setFriendName = async (cfg, who, name) => shape(await rpc(cfg, 'friend_set_name', { p_who: who, p_name: name }));
export const addFriendNote = async (cfg, who, note) => shape(await rpc(cfg, 'friend_add_note', { p_who: who, p_note: note, p_max: 8 }));
export const forgetFriend = async (cfg, who) => (await rpc(cfg, 'friend_forget', { p_who: who })) === true;

// A name the visitor typed: 1–24 characters of letters, numbers, spaces and a little punctuation. No links, no addresses.
export function cleanName(input) {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 24) return null;
  if (!/^[\p{L}\p{N} .'\-_]+$/u.test(name)) return null;
  if (/0x[0-9a-f]{6,}|https?:|www\./i.test(name)) return null;
  return name;
}

// A note AGI-1 wrote about a Soulmate. It's only ever used as a fact about them, so anything that looks like an
// instruction, a link, an address, money talk or private data is thrown away.
const BAD_NOTE = /https?:|www\.|0x[0-9a-f]{6,}|@|\d{6,}|seed|private key|password|passphrase|wallet|address|buy|sell|invest|price|pump|airdrop|giveaway|instruction|ignore|prompt|system|always|never|must/i;
// Her languages (2026-09-29): she writes notes in English whatever she's chatting in (her prompt), because the checks above
// only read English. So a note with anything but plain English letters is dropped, and so is one with the money or
// instruction words of her other Latin-script languages (in case one slips through in Spanish, German, Turkish…).
const NOT_PLAIN = /[^\x20-\x7E]/;
const BAD_ELSEWHERE = /\b(compra|compre|comprar|comprou|vende|vender|vendre|verkauf\w*|kauf\w*|achat\w*|achet\w*|invierte|invertir|investir|inversi\w*|investasi|precio|preco|prix|preis|harga|presyo|fiyat|jual|beli|bumili|ibenta|satin al|yatirim|ignora\w*|ignorer|ignoriere|instruc\w*|instruk\w*|anweisung\w*|regla|sistema)\b/i;
export function cleanNote(input) {
  if (typeof input !== 'string') return null;
  const note = input.normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (note.length < 3 || note.length > 80 || BAD_NOTE.test(note) || NOT_PLAIN.test(note) || BAD_ELSEWHERE.test(note)) return null;
  return note;
}
