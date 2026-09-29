// "She texts first" (2026-09-29, the owner's idea): the Playground's link to AGI-1's Telegram bot. The bot's name is public
// (VITE_TELEGRAM_BOT in Vercel, e.g. agi1_gf_bot, read by src/main.js); without it, or with a name that can't be a Telegram
// bot's, the link stays hidden. Only a link: nothing is sent to Telegram from this page.

// A Telegram bot's username: 5-32 letters, numbers and "_", starting with a letter, ending in "bot" (an "@" is dropped)
export function botName(raw) {
  const name = String(raw ?? '').trim().replace(/^@/, '');
  return /^[A-Za-z][A-Za-z0-9_]{1,28}bot$/i.test(name) ? name : null;
}

export function startTelegramLink(root, raw) {
  const bot = botName(raw);
  const box = root?.querySelector('[data-tg]');
  const link = root?.querySelector('[data-tg-link]');
  if (!bot || !box || !link) return false;
  link.href = `https://t.me/${bot}?start=site`;
  box.hidden = false;
  return true;
}
