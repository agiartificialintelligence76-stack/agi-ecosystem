// Real live notification engine for agi1.app/ainews.
// Combines Browser Notifications API, custom keyword watchlists, category channels, unseen-item tracking,
// subtle optional Web Audio chime, and in-page AGI-1 live alert toasts. Persisted in localStorage.

export const ALERTS_STORAGE_KEY = 'agi_ainews_alerts_v1';
export const SEEN_STORAGE_KEY = 'agi_ainews_seen_v1';

export const DEFAULT_ALERT_PREFS = Object.freeze({
  enabled: false,
  channels: {
    breaking: true,
    models: true,
    aisearch: true,
    markets: true,
  },
  keywords: ['Qwen', 'Kimi', 'Anthropic', 'Muse', 'Sam Altman'],
  intervalMin: 5,
  sound: true,
});

export function loadAlertPrefs(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    return sanitizePrefs(parsed);
  } catch {
    return cloneDefaults();
  }
}

export function saveAlertPrefs(prefs, storage = globalThis.localStorage) {
  const clean = sanitizePrefs(prefs);
  try {
    storage?.setItem(ALERTS_STORAGE_KEY, JSON.stringify(clean));
  } catch { /* storage blocked */ }
  return clean;
}

export function sanitizePrefs(input = {}) {
  const ch = input.channels || {};
  const keywords = Array.isArray(input.keywords)
    ? [...new Set(input.keywords.map((k) => String(k || '').trim().slice(0, 32)).filter(Boolean))].slice(0, 16)
    : DEFAULT_ALERT_PREFS.keywords.slice();
  const interval = [5, 15, 30].includes(Number(input.intervalMin)) ? Number(input.intervalMin) : 5;
  return {
    enabled: Boolean(input.enabled),
    channels: {
      breaking: ch.breaking !== false,
      models: ch.models !== false,
      aisearch: ch.aisearch !== false,
      markets: ch.markets !== false,
    },
    keywords,
    intervalMin: interval,
    sound: input.sound !== false,
  };
}

function cloneDefaults() {
  return {
    enabled: DEFAULT_ALERT_PREFS.enabled,
    channels: { ...DEFAULT_ALERT_PREFS.channels },
    keywords: [...DEFAULT_ALERT_PREFS.keywords],
    intervalMin: DEFAULT_ALERT_PREFS.intervalMin,
    sound: DEFAULT_ALERT_PREFS.sound,
  };
}

export function loadSeenIds(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.slice(-300).map(String) : []);
  } catch {
    return new Set();
  }
}

export function saveSeenIds(seenSet, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seenSet].slice(-300)));
  } catch { /* storage blocked */ }
}

// Pure matcher: determines whether an incoming story/video/repo matches the user's alert settings.
export function matchesAlertPrefs(item, prefs) {
  if (!item || !prefs) return false;
  const hay = `${item.title || ''} ${item.summary || ''} ${item.lab || ''} ${item.source || ''} ${(item.tags || []).join(' ')}`.toLowerCase();

  // Keyword watchlist always triggers if matched
  if (Array.isArray(prefs.keywords) && prefs.keywords.some((kw) => kw && hay.includes(kw.toLowerCase()))) {
    return true;
  }
  const ch = prefs.channels || {};
  if (ch.aisearch && (item.sourceKind === 'video' || item.channel === '@theAIsearch' || item.lab === '@theAIsearch')) {
    return true;
  }
  if (ch.models && (item.openWeights || item.category === 'models' || item.category === 'opensource')) {
    return true;
  }
  if (ch.markets && item.category === 'markets') {
    return true;
  }
  if (ch.breaking && item.breaking) {
    return true;
  }
  return false;
}

export function findNewMatchingAlerts(items, seenSet, prefs) {
  if (!Array.isArray(items) || !items.length) return [];
  const matches = [];
  for (const item of items) {
    if (!item?.id || seenSet.has(item.id)) continue;
    if (matchesAlertPrefs(item, prefs)) matches.push(item);
  }
  return matches;
}

export function browserNotificationState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || 'denied';
  }
}

export function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [659.25, 880, 1174.66]; // E5 -> A5 -> D6 crystalline ping
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.065);
      gain.gain.setValueAtTime(0.0001, now + i * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.07, now + i * 0.065 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.065);
      osc.stop(now + i * 0.065 + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch { /* audio autoplay blocked */ }
}

export function fireDesktopNotification({ title, body, url, tag, onClick }) {
  if (browserNotificationState() !== 'granted') return false;
  try {
    const n = new Notification(title, {
      body: body || 'New update on AGI AI News World',
      icon: '/icons/agi1-180.png',
      badge: '/favicon.svg',
      tag: tag || `agi-ainews-${Date.now()}`,
    });
    n.onclick = () => {
      window.focus?.();
      if (onClick) onClick();
      else if (url) window.open(url, '_blank', 'noopener,noreferrer');
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
