// Build guard. Runs right after `vite build` (see "build" in package.json).
// Everything in dist/ gets sent to visitors' browsers, so it must never contain
// a secret. If this finds one, the build fails and Vercel won't publish it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = 'dist';

// 1) The real secret values, when they're set where the build runs (they are on Vercel).
// (2026-10-01, "Launch with AGI-1": the Pinata key that puts coin pictures on IPFS, and the private key of the owner's gas
// wallet that pays launch fees back; 2026-10-02: her live show's secret, shared with her stream runner)
const SECRET_ENV_VARS = ['GEMINI_API_KEY', 'SUPABASE_SECRET_KEY', 'TURNSTILE_SECRET_KEY', 'PASS_SECRET', 'CRON_SECRET', 'TELEGRAM_BOT_TOKEN',
  'PINATA_JWT', 'LAUNCH_GAS_KEY', 'LIVE_SECRET'];

// 2) Shapes of keys that must never be public, even when no env var is set.
const PATTERNS = [
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Supabase secret key', re: /sb_secret_[0-9A-Za-z_-]{10,}/ },
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Telegram bot token', re: /\b\d{6,12}:AA[0-9A-Za-z_-]{33}\b/ },
  { name: 'JWT (a Pinata key?)', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/ },
];

const TEXT_TYPES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.map', '.xml', '.webmanifest']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

if (!existsSync(DIST)) {
  console.error(`✖ secret check: no ${DIST}/ folder. Run "vite build" first.`);
  process.exit(1);
}

const HEX_KEY = /^(?:0x)?([0-9a-fA-F]{64})$/;
const secrets = SECRET_ENV_VARS
  .map((name) => ({ name, value: process.env[name] }))
  .filter((s) => s.value && s.value.length >= 8)
  // a wallet's private key: found with or without its "0x", in any case
  .map((s) => {
    const key = HEX_KEY.exec(s.value.trim());
    return key ? { name: s.name, value: key[1].toLowerCase(), caseless: true } : s;
  });

const problems = [];
let scanned = 0;
for (const file of walk(DIST)) {
  if (!TEXT_TYPES.has(extname(file).toLowerCase())) continue;
  const text = readFileSync(file, 'utf8');
  scanned++;
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) problems.push(`${file}: looks like a ${name}`);
  }
  const lower = text.toLowerCase();
  for (const { name, value, caseless } of secrets) {
    if ((caseless ? lower : text).includes(value)) problems.push(`${file}: contains the value of ${name}`);
  }
}

if (problems.length) {
  // Only file names and variable names are printed, never the secret itself.
  console.error('\n✖ SECRET CHECK FAILED. These files would be public:\n  ' + problems.join('\n  '));
  console.error('\nMove the secret into a Vercel environment variable and use it only inside /api.\n');
  process.exit(1);
}
console.log(`✓ secret check passed (${scanned} files scanned, ${secrets.length} secret values compared)`);
