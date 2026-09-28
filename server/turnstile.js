// Cloudflare Turnstile: asks Cloudflare whether the browser's "are you human?" token is real.
// Tokens are single-use and expire after 5 minutes.
// `action` must match the widget that made the token: 'chat' (Playground) or 'vote' (Arena).
export async function verifyHuman(cfg, token, ip, action = 'chat') {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cfg.turnstileSecret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    // A token made for another action (or another site's widget) doesn't count.
    return data.success === true && (!data.action || data.action === action);
  } catch {
    return false;                                         // Cloudflare unreachable: treat as "not verified"
  }
}
