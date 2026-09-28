// The diary page (/diary, diary.html): AGI-1's entries from GET /api/diary, newest first, with "Share on X" on each.
// Entries are written once a day by the server (server/diary.js). All text is set with textContent.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/sections.css';
import './styles/footer.css';
import './styles/diary.css';
import './styles/pop.css';      // Pop mode (2026-09-27): the bold look, only while it's switched on
import { startTheme } from './theme.js';
import { startMenu } from './menu.js';
import { diaryPost, diaryLink, intentUrl } from './share/texts.js';

const PAGE = 14;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
// Entries are about a UTC day, so dates are shown in UTC (never "one day off")
const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

// Under each entry: how the $AGI chart moved that day (since 2026-09-28 the Arena's numbers aren't shown: it left the site)
function statsLine(stats = {}) {
  return Number.isFinite(stats?.chart?.h24) ? `$AGI 24h ${pct(stats.chart.h24)}` : 'no chart numbers that day';
}

function entryItem(e) {
  const day = new Date(`${e.day}T00:00:00Z`);
  const li = el('li', 'entry');
  const article = el('article');
  const head = el('header', 'entry-head');
  const time = el('time', 'entry-date', longDate.format(day));
  time.dateTime = e.day;
  head.append(time, el('span', 'entry-mood mono', `mood: ${e.mood}`));
  const foot = el('div', 'entry-foot');
  const share = el('a', 'btn btn-ghost btn-sm', 'Share on X');
  share.href = intentUrl(diaryPost(shortDate.format(day), e.entry), diaryLink(location.origin));
  share.target = '_blank';
  share.rel = 'noopener noreferrer';
  share.setAttribute('aria-label', `Share the entry for ${longDate.format(day)} on X`);
  foot.append(el('p', 'entry-stats mono', statsLine(e.stats)), share);
  article.append(head, el('p', 'entry-text', e.entry), foot);
  li.append(article);
  return li;
}

async function start() {
  startTheme();
  startMenu();                      // the phone menu
  const root = document.querySelector('[data-diary]');
  if (!root) return;
  const status = root.querySelector('[data-diary-status]');
  const list = root.querySelector('[data-diary-list]');
  const more = root.querySelector('[data-diary-more]');
  let oldest = null;

  async function load(before) {
    const q = before ? `?before=${before}&limit=${PAGE + 1}` : `?limit=${PAGE + 1}`;   // one extra: are there older ones?
    const res = await fetch(`/api/diary${q}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.entries)) throw new Error(data.error || 'error');
    const page = data.entries.slice(0, PAGE);
    list.append(...page.map(entryItem));
    if (page.length) oldest = page[page.length - 1].day;
    more.hidden = data.entries.length <= PAGE;
    return page.length;
  }

  try {
    const n = await load(null);
    status.textContent = n ? '' : 'Her first entry arrives just after midnight (UTC). She\'s thinking about what to write.';
    status.hidden = n > 0;
  } catch (err) {
    status.textContent = err.message === 'not_ready' || err.message === 'not_configured'
      ? 'Her diary opens soon.' : "Couldn't open her diary right now. Try again in a minute.";
  }
  more.addEventListener('click', async () => {
    more.disabled = true;
    more.textContent = 'Loading…';
    try {
      await load(oldest);
      more.textContent = 'Show older entries';
    } catch {
      more.textContent = "Couldn't load. Try again";
    }
    more.disabled = false;
  });
}

start();
