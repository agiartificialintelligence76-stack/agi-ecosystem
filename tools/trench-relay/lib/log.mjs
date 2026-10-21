// The relay's log (2026-10-21, #404): one line a thing, its time first, through `docker logs` (sh tools/trench-relay/
// relay.sh logs). Every line is scrubbed before it's written: the Helius key (and any "api-key=…" in an address) never
// reaches a log, whatever an error message carried. Never a viewer's address or what they look at.

const KEYISH = /(api[-_]?key=)[^&\s"'<>]+/gi;

export function createLog({ secrets = [], write = (line) => process.stdout.write(`${line}\n`), level = 'info', now = () => new Date() } = {}) {
  const hidden = secrets.filter((s) => typeof s === 'string' && s.length >= 6).sort((a, b) => b.length - a.length);
  const order = { debug: 0, info: 1, warn: 2, error: 3 };
  const min = order[level] ?? 1;
  const scrub = (text) => {
    let s = String(text);
    for (const k of hidden) s = s.split(k).join('***');
    return s.replace(KEYISH, '$1***').replace(/[\r\n]+/g, ' ').slice(0, 600);
  };
  const line = (lvl, msg) => {
    if (order[lvl] < min) return;
    try {
      write(`${now().toISOString()} ${lvl === 'info' ? '' : `${lvl.toUpperCase()} `}${scrub(msg)}`);
    } catch {
      // a log that can't be written is never a crash
    }
  };
  return {
    debug: (m) => line('debug', m),
    info: (m) => line('info', m),
    warn: (m) => line('warn', m),
    error: (m) => line('error', m),
    scrub,
  };
}

// an error in a few words (its message, never a stack or an address with its query)
export function errText(err) {
  if (!err) return 'unknown error';
  const code = err.code && typeof err.code === 'string' ? `${err.code} ` : '';
  return `${code}${String(err.message || err)}`.replace(/\?[^\s]*/g, '?…').slice(0, 200);
}
