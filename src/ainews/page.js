// AI News World (agi1.app/ainews): living global AI news atlas, interactive 3D world globe,
// open-weight GitHub & Hugging Face tracker, @theAIsearch video + extracted tool vault,
// embedded Cinema Player with timestamp jumping, and real live Browser + RSS notifications.
// Zero inline scripts or styles (strict CSP compliant); every untrusted string rendered via textContent.

import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';
import '../styles/pop.css';
import '../styles/ainews.css';

import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { createWorldGlobe } from './globe.js';
import {
  loadAlertPrefs,
  saveAlertPrefs,
  loadSeenIds,
  saveSeenIds,
  findNewMatchingAlerts,
  browserNotificationState,
  requestBrowserNotificationPermission,
  playAlertChime,
  fireDesktopNotification,
} from './alerts.js';

const SAVED_STORAGE_KEY = 'agi_ainews_saved_v1';

const TABS = [
  { key: 'world', label: 'World Feed' },
  { key: 'models', label: 'Models & Weights' },
  { key: 'tools', label: '@theAIsearch Tools' },
  { key: 'videos', label: 'Video Briefings' },
  { key: 'markets', label: 'Labs & Markets' },
  { key: 'saved', label: 'Saved Vault' },
];

const REGIONS = [
  { key: 'all', label: 'All World' },
  { key: 'americas', label: 'Americas' },
  { key: 'china', label: 'China & Asia' },
  { key: 'europe', label: 'Europe' },
  { key: 'asia', label: 'East Asia' },
  { key: 'global', label: 'Global Orbit' },
];

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.8v14.4c0 .8.9 1.3 1.6.8l11-7.2c.6-.4.6-1.2 0-1.6l-11-7.2C7.9 3.5 7 4 7 4.8Z"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.56 9.56 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 5h5v5M10 14 19 5M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4V4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.2" stroke="currentColor" stroke-width="1.8"/></svg>',
  yt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
};

const el = (tag, cls = '', attrs = {}) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : String(v));
  }
  return node;
};

const safeLink = (raw) => {
  try {
    const u = new URL(String(raw || ''));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
};

function relativeTime(iso) {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts)) return 'Live';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function compactNumber(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

// ---------- State ----------

let worldData = null;
let pendingData = null;
let activeTab = 'world';
let activeRegion = 'all';
let activeHub = null;
let searchQuery = '';
let toolFilter = 'all';
let modelFilter = 'all';
let wireLimit = 12;
let globe = null;
let pollTimer = 0;

let alertPrefs = loadAlertPrefs();
let seenIds = loadSeenIds();
let alertInbox = [];
let savedItems = loadSaved();

let readerDlg, cinemaDlg, alertsDlg;
let cinemaVideo = null;

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSaved() {
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItems.slice(0, 120)));
  } catch { /* storage blocked */ }
}

function isSaved(id) {
  return savedItems.some((s) => s.id === id);
}

function toggleSave(item) {
  if (!item?.id) return false;
  const idx = savedItems.findIndex((s) => s.id === item.id);
  if (idx >= 0) {
    savedItems.splice(idx, 1);
    persistSaved();
    toast('Removed from Saved Vault');
    updateTabCounts();
    if (activeTab === 'saved') renderStage();
    return false;
  }
  savedItems.unshift({
    id: item.id,
    title: item.title || item.name,
    summary: item.summary || item.videoTitle || '',
    url: item.url || item.githubUrl || item.huggingfaceUrl || '',
    githubUrl: item.githubUrl || null,
    huggingfaceUrl: item.huggingfaceUrl || null,
    videoId: item.videoId || null,
    sec: item.sec || 0,
    clock: item.clock || '',
    image: item.image || item.thumbnail || null,
    regionLabel: item.regionLabel || 'Global',
    lab: item.lab || item.source || '@theAIsearch',
    category: item.category || item.kind || 'saved',
    publishedAt: item.publishedAt || new Date().toISOString(),
  });
  persistSaved();
  toast('Saved to your Vault');
  updateTabCounts();
  return true;
}

// ---------- Boot ----------

startTheme();
startMenu();
init();

function init() {
  buildTabs();
  buildRegions();
  buildModals();
  wireControls();
  syncAlertBadges();

  const hash = location.hash.slice(1).toLowerCase();
  if (TABS.some((t) => t.key === hash)) activeTab = hash;
  const params = new URLSearchParams(location.search);
  if (params.get('hub')) activeHub = params.get('hub');

  updateTabsUi();
  updateRegionsUi();

  const canvas = document.querySelector('[data-an-globe]');
  if (canvas) {
    globe = createWorldGlobe(canvas, {
      hubs: [],
      onSelectHub: (hubId) => selectHub(hubId, { scroll: false }),
      onHoverHub: (hub) => {
        if (hub) updateHubCard(hub);
        else updateHubCard(getHub(activeHub));
      },
    });
  }

  fetchWorld({ initial: true });
  schedulePoll();
}

function getHub(id) {
  return worldData?.hubs?.find((h) => h.id === id) || null;
}

async function fetchWorld({ initial = false, manual = false } = {}) {
  const refreshBtn = document.querySelector('[data-an-refresh]');
  const updatedEl = document.querySelector('[data-an-updated]');
  refreshBtn?.classList.add('is-syncing');
  if (manual && updatedEl) updatedEl.textContent = 'Syncing…';

  try {
    const url = manual ? '/api/health?ainews=1&fresh=1' : '/api/health?ainews=1';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = await res.json();
    if (!next?.ok) throw new Error('Invalid payload');

    if (initial || manual || !worldData) {
      applyWorldData(next, { initial });
      if (manual) toast('World feeds synced live');
    } else {
      // Background poll: check for unseen matching alerts!
      const freshItems = findNewMatchingAlerts(
        [...(next.stories || []), ...(next.openWeights || [])],
        seenIds,
        alertPrefs,
      );
      if (freshItems.length) {
        pendingData = next;
        handleIncomingAlerts(freshItems);
      } else {
        applyWorldData(next, { initial: false, quiet: true });
      }
    }
  } catch {
    if (initial && !worldData) {
      const stage = document.querySelector('[data-an-stage]');
      if (stage) {
        stage.replaceChildren();
        const box = el('div', 'an-empty');
        box.textContent = 'Could not reach the live global news feed right now. Tap Sync to retry.';
        stage.append(box);
      }
    } else if (manual) {
      toast('Could not sync right now — retrying shortly');
    }
  } finally {
    refreshBtn?.classList.remove('is-syncing');
  }
}

function applyWorldData(data, { initial = false, quiet = false } = {}) {
  worldData = data;
  pendingData = null;

  const allIds = [
    ...(data.stories || []).map((s) => s.id),
    ...(data.openWeights || []).map((m) => m.id),
    ...(data.videos || []).map((v) => v.id),
  ];

  // If the visitor had alerts enabled from an earlier visit, flag anything new since their last visit!
  if (initial && alertPrefs.enabled && seenIds.size > 0) {
    const newSinceLast = findNewMatchingAlerts(data.stories || [], seenIds, alertPrefs);
    if (newSinceLast.length) {
      alertInbox = [...newSinceLast.slice(0, 12), ...alertInbox].slice(0, 25);
      syncAlertBadges();
      toast(`${newSinceLast.length} new matching AI update${newSinceLast.length > 1 ? 's' : ''} since your last visit`);
    }
  }
  for (const id of allIds) seenIds.add(id);
  saveSeenIds(seenIds);

  // Update Hero telemetry
  const s = data.stats || {};
  const liveLabel = document.querySelector('[data-an-live-label]');
  if (liveLabel) {
    liveLabel.textContent = `Live Global AI World · ${s.sourcesLive || 0}/${s.sourcesTotal || 15} Live Feeds Connected`;
  }
  const updatedEl = document.querySelector('[data-an-updated]');
  if (updatedEl) updatedEl.textContent = `Synced ${relativeTime(data.updatedAt)}`;

  const statMap = {
    stories: s.totalStories ?? 0,
    weights: s.openWeightsCount ?? 0,
    tools: s.aiSearchToolsCount ?? 0,
    hubs: s.activeHubs ?? 7,
  };
  for (const node of document.querySelectorAll('[data-an-stat]')) {
    node.textContent = String(statMap[node.dataset.anStat] ?? '—');
  }

  // Update Globe + Hub Chips + Ticker
  globe?.setHubs(data.hubs || []);
  if (activeHub) globe?.focusHub(activeHub);
  renderHubChips();
  updateHubCard(getHub(activeHub));
  renderTicker();
  updateTabCounts();

  if (!quiet) renderStage();

  // Deep-link handling on initial load
  if (initial) {
    const params = new URLSearchParams(location.search);
    const storyId = params.get('story');
    const videoId = params.get('video');
    const sec = Number(params.get('t') || 0);
    if (storyId) {
      const found = (data.stories || []).find((x) => x.id === storyId);
      if (found) openReader(found);
    } else if (videoId) {
      const vid = (data.videos || []).find((v) => v.videoId === videoId);
      if (vid) openCinema(vid, sec);
    }
  }
}

function handleIncomingAlerts(items) {
  alertInbox = [...items.slice(0, 10), ...alertInbox].slice(0, 25);
  syncAlertBadges();

  const banner = document.querySelector('[data-an-fresh-banner]');
  const text = document.querySelector('[data-an-fresh-text]');
  if (banner && text) {
    text.textContent = items.length === 1
      ? `Breaking: ${items[0].title}`
      : `${items.length} new AI dispatches matching your alerts just dropped.`;
    banner.hidden = false;
  }

  if (alertPrefs.enabled) {
    if (alertPrefs.sound) playAlertChime();
    const lead = items[0];
    fireDesktopNotification({
      title: `AGI AI News · ${lead.regionLabel || 'Global'}`,
      body: lead.title,
      url: lead.url,
      tag: lead.id,
      onClick: () => {
        if (pendingData) applyWorldData(pendingData);
        openReader(lead);
      },
    });
  }
}

function schedulePoll() {
  clearInterval(pollTimer);
  const mins = Math.max(5, Number(alertPrefs.intervalMin) || 5);
  pollTimer = setInterval(() => {
    if (!document.hidden) fetchWorld({ initial: false, manual: false });
  }, mins * 60 * 1000);
}

// ---------- Ticker & Hub Controls ----------

function renderTicker() {
  const track = document.querySelector('[data-an-ticker]');
  if (!track || !worldData?.ticker?.length) return;
  const list = worldData.ticker;
  const makeChunk = () => list.map((item) => {
    const btn = el('button', 'an-ticker-item', { type: 'button' });
    const loc = el('span', 'an-ticker-loc');
    loc.textContent = item.regionLabel || 'Global';
    const txt = el('span');
    txt.textContent = item.title;
    btn.append(loc, txt);
    btn.addEventListener('click', () => {
      const full = (worldData.stories || []).find((s) => s.id === item.id);
      if (full) openReader(full);
    });
    return btn;
  });
  track.replaceChildren(...makeChunk(), ...makeChunk());
}

function renderHubChips() {
  const wrap = document.querySelector('[data-an-hub-chips]');
  if (!wrap || !worldData?.hubs) return;
  const chips = [];

  const allBtn = el('button', 'an-hub-chip', { type: 'button', 'aria-pressed': activeHub ? 'false' : 'true' });
  allBtn.textContent = 'All World';
  allBtn.addEventListener('click', () => selectHub(null));
  chips.push(allBtn);

  for (const hub of worldData.hubs) {
    const btn = el('button', 'an-hub-chip', { type: 'button', 'aria-pressed': activeHub === hub.id ? 'true' : 'false' });
    const dot = el('span', 'an-hub-dot', { 'data-hub': hub.id, 'aria-hidden': 'true' });
    const name = el('span');
    name.textContent = hub.name;
    const count = el('span', 'an-hub-chip-n');
    count.textContent = String(hub.totalSignals || 0);
    btn.append(dot, name, count);
    btn.addEventListener('click', () => selectHub(activeHub === hub.id ? null : hub.id));
    chips.push(btn);
  }
  wrap.replaceChildren(...chips);
}

function selectHub(hubId, { scroll = false } = {}) {
  activeHub = hubId || null;
  if (activeHub) activeRegion = 'all';
  globe?.focusHub(activeHub, { ping: Boolean(activeHub) });
  renderHubChips();
  updateHubCard(getHub(activeHub));
  updateRegionsUi();
  updateFilterBanner();
  renderStage();
  if (scroll) {
    document.querySelector('.an-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateHubCard(hub) {
  const dot = document.querySelector('[data-an-hub-dot]');
  const name = document.querySelector('[data-an-hub-name]');
  const count = document.querySelector('[data-an-hub-count]');
  const lead = document.querySelector('[data-an-hub-lead]');
  const labs = document.querySelector('[data-an-hub-labs]');
  const openBtn = document.querySelector('[data-an-hub-open]');
  if (!name || !lead) return;

  if (!hub) {
    dot?.removeAttribute('data-hub');
    name.textContent = 'Global AI Orbit';
    if (count) count.textContent = `${worldData?.stats?.activeHubs || 7} active hubs`;
    lead.textContent = 'Click any glowing city beacon on the globe to filter its labs, open-weight repos, and live dispatches.';
    if (labs) labs.textContent = 'Qwen · Kimi · OpenAI · Anthropic · Meta Muse · DeepMind';
    if (openBtn) openBtn.hidden = true;
    return;
  }

  dot?.setAttribute('data-hub', hub.id);
  name.textContent = `${hub.name}, ${hub.country}`;
  if (count) count.textContent = `${hub.totalSignals || 0} live signals`;
  lead.textContent = hub.leadTitle || hub.tagline;
  if (labs) labs.textContent = (hub.labs || []).join(' · ');
  if (openBtn) {
    openBtn.hidden = !hub.leadId;
    openBtn.onclick = () => {
      const story = (worldData?.stories || []).find((s) => s.id === hub.leadId);
      if (story) openReader(story);
    };
  }
}

// ---------- Tabs, Regions, Controls ----------

function buildTabs() {
  const bar = document.querySelector('[data-an-tabs]');
  if (!bar) return;
  for (const t of TABS) {
    const btn = el('button', 'an-tab', {
      type: 'button',
      role: 'tab',
      id: `an-tab-${t.key}`,
      'data-tab': t.key,
      'aria-selected': 'false',
      tabindex: '-1',
    });
    const lbl = el('span');
    lbl.textContent = t.label;
    const n = el('span', 'an-tab-n', { 'data-tab-count': t.key });
    n.textContent = '—';
    btn.append(lbl, n);
    btn.addEventListener('click', () => switchTab(t.key, true));
    bar.append(btn);
  }
  bar.addEventListener('keydown', (e) => {
    const keys = TABS.map((t) => t.key);
    const i = keys.indexOf(activeTab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const k = keys[(to + keys.length) % keys.length];
    switchTab(k, true);
    document.getElementById(`an-tab-${k}`)?.focus();
  });
}

function updateTabsUi() {
  for (const btn of document.querySelectorAll('.an-tab')) {
    const on = btn.dataset.tab === activeTab;
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
  }
  document.querySelector('[data-an-stage]')?.setAttribute('aria-labelledby', `an-tab-${activeTab}`);
}

function updateTabCounts() {
  const counts = {
    world: worldData?.stories?.length ?? 0,
    models: worldData?.openWeights?.length ?? 0,
    tools: worldData?.aiSearchTools?.length ?? 0,
    videos: worldData?.videos?.length ?? 0,
    markets: (worldData?.stories || []).filter((s) => s.category === 'markets' || s.category === 'research').length,
    saved: savedItems.length,
  };
  for (const node of document.querySelectorAll('[data-tab-count]')) {
    node.textContent = String(counts[node.dataset.tabCount] ?? 0);
  }
}

function switchTab(key, fromUser = false) {
  activeTab = key;
  wireLimit = 12;
  updateTabsUi();
  renderStage();
  if (fromUser) {
    history.replaceState(null, '', key === 'world' ? location.pathname : `#${key}`);
  }
}

function buildRegions() {
  const wrap = document.querySelector('[data-an-regions]');
  if (!wrap) return;
  for (const r of REGIONS) {
    const btn = el('button', 'an-region-pill', {
      type: 'button',
      'data-region': r.key,
      'aria-pressed': r.key === 'all' ? 'true' : 'false',
    });
    btn.textContent = r.label;
    btn.addEventListener('click', () => {
      activeRegion = r.key;
      activeHub = null;
      globe?.focusHub(null);
      renderHubChips();
      updateHubCard(null);
      updateRegionsUi();
      updateFilterBanner();
      renderStage();
    });
    wrap.append(btn);
  }
}

function updateRegionsUi() {
  for (const btn of document.querySelectorAll('.an-region-pill')) {
    btn.setAttribute('aria-pressed', !activeHub && btn.dataset.region === activeRegion ? 'true' : 'false');
  }
}

function updateFilterBanner() {
  const wrap = document.querySelector('[data-an-active-filter]');
  const label = document.querySelector('[data-an-filter-label]');
  if (!wrap || !label) return;
  const parts = [];
  if (activeHub) parts.push(`Hub: ${getHub(activeHub)?.name || activeHub}`);
  if (activeRegion !== 'all') parts.push(`Region: ${REGIONS.find((r) => r.key === activeRegion)?.label || activeRegion}`);
  if (searchQuery) parts.push(`Query: "${searchQuery}"`);
  wrap.hidden = parts.length === 0;
  label.textContent = parts.join(' · ');
}

function wireControls() {
  const search = document.querySelector('[data-an-search]');
  let searchTimer = 0;
  search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = search.value.trim();
      updateFilterBanner();
      renderStage();
    }, 120);
  });

  document.querySelector('[data-an-clear-filters]')?.addEventListener('click', () => {
    activeHub = null;
    activeRegion = 'all';
    searchQuery = '';
    if (search) search.value = '';
    globe?.focusHub(null);
    renderHubChips();
    updateHubCard(null);
    updateRegionsUi();
    updateFilterBanner();
    renderStage();
  });

  document.querySelector('[data-an-spin-toggle]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const next = !(globe?.isAutoRotate());
    globe?.setAutoRotate(next);
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    btn.textContent = next ? 'Pause' : 'Spin';
  });

  document.querySelector('[data-an-globe-reset]')?.addEventListener('click', () => selectHub(null));

  document.querySelector('[data-an-jump-tools]')?.addEventListener('click', () => {
    switchTab('tools', true);
    document.querySelector('.an-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelector('[data-an-refresh]')?.addEventListener('click', () => fetchWorld({ manual: true }));

  for (const btn of document.querySelectorAll('[data-an-open-alerts]')) {
    btn.addEventListener('click', () => openAlertsModal());
  }

  document.querySelector('[data-an-fresh-apply]')?.addEventListener('click', () => {
    document.querySelector('[data-an-fresh-banner]').hidden = true;
    if (pendingData) applyWorldData(pendingData);
  });
  document.querySelector('[data-an-fresh-close]')?.addEventListener('click', () => {
    document.querySelector('[data-an-fresh-banner]').hidden = true;
  });

  addEventListener('hashchange', () => {
    const h = location.hash.slice(1).toLowerCase();
    if (TABS.some((t) => t.key === h) && h !== activeTab) switchTab(h, false);
  });
}

// ---------- Filtering ----------

function matchesFilters(item) {
  if (!item) return false;
  if (activeHub && item.hub !== activeHub) return false;
  if (activeRegion !== 'all' && item.region !== activeRegion) return false;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const hay = `${item.title || ''} ${item.name || ''} ${item.summary || ''} ${item.lab || ''} ${item.source || ''} ${item.regionLabel || ''} ${item.repo || ''} ${item.videoTitle || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// ---------- Stage Renderer ----------

function renderStage() {
  const stage = document.querySelector('[data-an-stage]');
  if (!stage || !worldData) return;

  if (activeTab === 'world') renderWorldFeed(stage);
  else if (activeTab === 'models') renderModelsView(stage);
  else if (activeTab === 'tools') renderToolsView(stage);
  else if (activeTab === 'videos') renderVideosView(stage);
  else if (activeTab === 'markets') renderMarketsView(stage);
  else if (activeTab === 'saved') renderSavedView(stage);
}

function makeVisualPlate(item) {
  const plate = el('div', 'an-plate', {
    'data-region': item.region || 'global',
    'data-category': item.category || 'models',
  });
  const top = el('div', 'an-plate-top');
  const loc = el('span'); loc.textContent = item.regionLabel || 'Global AI';
  const cat = el('span');
  cat.textContent = item.stars ? `★ ${compactNumber(item.stars)}`
    : item.likes ? `♥ ${compactNumber(item.likes)}`
      : (item.category || 'dispatch').toUpperCase();
  top.append(loc, cat);

  const lab = el('div', 'an-plate-lab');
  lab.textContent = item.name || item.lab || item.source || 'AI World';

  const foot = el('div', 'an-plate-foot');
  foot.textContent = item.githubUrl ? 'OPEN-SOURCE REPOSITORY'
    : item.huggingfaceUrl ? 'HUGGING FACE WEIGHTS'
      : item.source || 'LIVE WIRE';

  plate.append(top, lab, foot);
  return plate;
}

function makeCardMedia(item, { isLead = false, onOpen } = {}) {
  const btn = el('button', 'an-card-media', {
    type: 'button',
    'aria-label': `Open ${item.title || item.name}`,
  });

  if (item.image) {
    const img = el('img', 'an-card-img', {
      src: item.image,
      alt: '',
      loading: isLead ? 'eager' : 'lazy',
      decoding: 'async',
    });
    img.addEventListener('error', () => {
      img.replaceWith(makeVisualPlate(item));
    }, { once: true });
    btn.append(img);
  } else {
    btn.append(makeVisualPlate(item));
  }

  const overlay = el('div', 'an-media-badges');
  const left = el('div', 'an-badge-group');
  if (item.breaking && item.sourceKind === 'spotlight') {
    const b = el('span', 'an-badge an-badge-break'); b.textContent = 'Spotlight'; left.append(b);
  }
  if (item.openWeights) {
    const b = el('span', 'an-badge an-badge-open'); b.textContent = 'Open Weights'; left.append(b);
  }
  if (item.videoId) {
    const b = el('span', 'an-badge an-badge-video');
    b.textContent = item.toolCount ? `Video · ${item.toolCount} Tools` : 'Video Briefing';
    left.append(b);
  }
  const right = el('span', 'an-badge');
  right.textContent = item.regionLabel || 'Global';
  overlay.append(left, right);
  btn.append(overlay);

  if (item.videoId) {
    const play = el('span', 'an-play-fab', { 'aria-hidden': 'true' });
    play.innerHTML = ICON.play;
    btn.append(play);
  }

  btn.addEventListener('click', onOpen);
  return btn;
}

function makeStoryCard(item, { lead = false } = {}) {
  const card = el('article', `an-card${lead ? ' an-card-lead' : ''}`, { 'data-story-id': item.id });
  const open = () => {
    if (item.videoId && item.sourceKind === 'video') {
      const vid = (worldData?.videos || []).find((v) => v.videoId === item.videoId);
      if (vid) { openCinema(vid, 0); return; }
    }
    openReader(item);
  };

  card.append(makeCardMedia(item, { isLead: lead, onOpen: open }));

  const body = el('div', 'an-card-body');
  const meta = el('div', 'an-card-meta');
  const loc = el('span', 'an-card-loc'); loc.textContent = item.lab || item.source;
  const sep = el('span'); sep.textContent = '·';
  const time = el('time', '', { datetime: item.publishedAt || '' }); time.textContent = relativeTime(item.publishedAt);
  meta.append(loc, sep, time);
  if (item.upvotes) {
    const up = el('span'); up.textContent = `· ▲ ${item.upvotes}`; meta.append(up);
  }
  if (item.points) {
    const pts = el('span'); pts.textContent = `· ▲ ${item.points} HN`; meta.append(pts);
  }

  const h = el(lead ? 'h2' : 'h3', 'an-card-title');
  h.textContent = item.title;
  h.addEventListener('click', open);

  const p = el('p', 'an-card-summary');
  p.textContent = item.summary;

  body.append(meta, h, p);

  if (item.tags?.length) {
    const tags = el('div', 'an-card-tags');
    for (const tag of item.tags.slice(0, 4)) {
      const chip = el('span', 'an-tag'); chip.textContent = tag; tags.append(chip);
    }
    body.append(tags);
  }

  const acts = el('div', 'an-card-actions');
  const readBtn = el('button', 'an-act an-act-primary', { type: 'button' });
  readBtn.textContent = item.videoId ? 'Watch Briefing' : 'Inspect';
  readBtn.addEventListener('click', open);
  acts.append(readBtn);

  const gh = safeLink(item.githubUrl);
  if (gh) {
    const a = el('a', 'an-act an-act-gh', { href: gh, target: '_blank', rel: 'noopener noreferrer' });
    a.innerHTML = `${ICON.github}<span>GitHub</span>`;
    acts.append(a);
  }
  const hf = safeLink(item.huggingfaceUrl);
  if (hf && hf !== gh) {
    const a = el('a', 'an-act an-act-hf', { href: hf, target: '_blank', rel: 'noopener noreferrer' });
    a.textContent = 'HF Weights ↗';
    acts.append(a);
  }
  const srcUrl = safeLink(item.url);
  if (srcUrl && srcUrl !== gh && srcUrl !== hf) {
    const a = el('a', 'an-act', { href: srcUrl, target: '_blank', rel: 'noopener noreferrer' });
    a.innerHTML = `<span>Source</span>${ICON.ext}`;
    acts.append(a);
  }

  const saveBtn = el('button', 'an-act an-act-save', {
    type: 'button',
    'aria-pressed': isSaved(item.id) ? 'true' : 'false',
    'aria-label': `Save ${item.title}`,
    title: 'Save to Vault',
  });
  saveBtn.innerHTML = ICON.bookmark;
  saveBtn.addEventListener('click', () => {
    const nowSaved = toggleSave(item);
    saveBtn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
  });
  acts.append(saveBtn);

  body.append(acts);
  card.append(body);
  return card;
}

function makeToolCard(tool) {
  const card = el('article', 'an-tool-card');
  const top = el('div', 'an-tool-top');
  const kindLabels = { github: 'GitHub Repo', huggingface: 'Hugging Face', project: 'Open Project', launch: 'AI Launch' };
  const badge = el('span', 'an-tool-kind', { 'data-kind': tool.kind || 'launch' });
  badge.textContent = kindLabels[tool.kind] || 'AI Tool';
  const topR = el('div', 'an-tool-top-r');
  const loc = el('span', 'an-card-meta');
  loc.textContent = tool.regionLabel || 'Global';
  const saveBtn = el('button', 'an-tool-save', {
    type: 'button',
    'aria-pressed': isSaved(tool.id) ? 'true' : 'false',
    'aria-label': `Save ${tool.name}`,
    title: 'Save tool',
  });
  saveBtn.innerHTML = ICON.bookmark;
  saveBtn.addEventListener('click', () => {
    const on = toggleSave(tool);
    saveBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  topR.append(loc, saveBtn);
  top.append(badge, topR);

  const name = el('h3', 'an-tool-name');
  name.textContent = tool.name;

  const repoEl = el('p', 'an-tool-repo');
  repoEl.textContent = tool.repo || tool.url.replace(/^https?:\/\/(?:www\.)?/, '').slice(0, 48);

  const from = el('p', 'an-tool-from');
  from.textContent = tool.videoTitle ? `From @theAIsearch: ${tool.videoTitle}` : 'Featured on @theAIsearch';

  const acts = el('div', 'an-tool-acts');
  const href = safeLink(tool.url);
  if (href) {
    const link = el('a', `an-act ${tool.kind === 'github' ? 'an-act-gh' : tool.kind === 'huggingface' ? 'an-act-hf' : 'an-act-primary'}`, {
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    if (tool.kind === 'github') link.innerHTML = `${ICON.github}<span>Open GitHub</span>`;
    else link.innerHTML = `<span>Open Tool</span>${ICON.ext}`;
    acts.append(link);
  }
  if (tool.videoId) {
    const watchBtn = el('button', 'an-act', { type: 'button' });
    watchBtn.innerHTML = `${ICON.play}<span>${tool.clock ? `Watch @ ${tool.clock}` : 'Watch Clip'}</span>`;
    watchBtn.addEventListener('click', () => {
      const vid = (worldData?.videos || []).find((v) => v.videoId === tool.videoId);
      if (vid) openCinema(vid, tool.sec || 0);
      else if (safeLink(tool.videoUrl)) window.open(tool.videoUrl, '_blank', 'noopener,noreferrer');
    });
    acts.append(watchBtn);
  }

  card.append(top, name, repoEl, from, acts);
  return card;
}

// ---------- Tab 1: World Feed ----------

function renderWorldFeed(stage) {
  const filtered = (worldData.stories || []).filter(matchesFilters);
  const frag = document.createDocumentFragment();

  if (!filtered.length) {
    const empty = el('p', 'an-empty');
    empty.textContent = 'No AI dispatches match this filter yet. Try clearing your search or picking another world hub.';
    stage.replaceChildren(empty);
    return;
  }

  // Prioritize visual / spotlight stories in the top magazine block when unfiltered
  const spotlights = filtered.filter((s) => s.sourceKind === 'spotlight' || (s.image && s.breaking));
  const topSix = [];
  const usedIds = new Set();
  for (const s of [...spotlights, ...filtered]) {
    if (usedIds.has(s.id)) continue;
    usedIds.add(s.id);
    topSix.push(s);
    if (topSix.length >= 6) break;
  }

  // Section 1: Global Front Page
  const sec1 = el('section', 'an-section', { 'aria-labelledby': 'an-h-front' });
  const head1 = el('div', 'an-sec-head');
  const h1 = el('h2', 'an-sec-title', { id: 'an-h-front' });
  h1.append('Global Front Page ');
  const c1 = el('span', 'an-sec-count'); c1.textContent = `(${filtered.length})`; h1.append(c1);
  const note1 = el('p', 'an-sec-note');
  note1.textContent = activeHub
    ? `Focused on ${getHub(activeHub)?.name || activeHub} · click any story to inspect or launch repos`
    : 'Frontier models, open-weight drops, IPOs & global breakthroughs.';
  head1.append(h1, note1);
  sec1.append(head1);

  const spotGrid = el('div', 'an-spot-grid');
  spotGrid.append(makeStoryCard(topSix[0], { lead: true }));
  if (topSix.length > 1) {
    const side = el('div', 'an-spot-side');
    for (const item of topSix.slice(1, 3)) side.append(makeStoryCard(item));
    spotGrid.append(side);
  }
  sec1.append(spotGrid);

  if (topSix.length > 3) {
    const flash = el('div', 'an-flash-grid');
    for (const item of topSix.slice(3, 6)) flash.append(makeStoryCard(item));
    sec1.append(flash);
  }
  frag.append(sec1);

  // Section 2: @theAIsearch Live Video & Extracted AI Tools Showcase
  const toolsList = (worldData.aiSearchTools || []).filter(matchesFilters);
  const latestVideo = (worldData.videos || [])[0];
  if (latestVideo && (toolsList.length > 0 || (!activeHub && activeRegion === 'all' && !searchQuery))) {
    const sec2 = el('section', 'an-section', { 'aria-labelledby': 'an-h-aisearch' });
    const box = el('div', 'an-aisearch-box');
    const banner = el('div', 'an-aisearch-banner');
    const idBox = el('div', 'an-aisearch-id');
    const mark = el('span', 'an-yt-mark', { 'aria-hidden': 'true' }); mark.innerHTML = ICON.yt;
    const txt = el('div');
    const h2 = el('h2', '', { id: 'an-h-aisearch' }); h2.textContent = '@theAIsearch · Live Tools & GitHub Drops';
    const sub = el('p');
    sub.textContent = `Auto-extracted every time AI Search uploads a new video — with direct tool links, GitHub repos & exact video timestamps.`;
    txt.append(h2, sub);
    idBox.append(mark, txt);

    const actions = el('div', 'an-badge-group');
    const allToolsBtn = el('button', 'an-sec-link', { type: 'button' });
    allToolsBtn.textContent = `All ${worldData.aiSearchTools?.length || 0} tools →`;
    allToolsBtn.addEventListener('click', () => {
      switchTab('tools', true);
      document.querySelector('.an-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const ytLink = el('a', 'an-sec-link', {
      href: 'https://www.youtube.com/@theAIsearch',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    ytLink.textContent = 'YouTube @theAIsearch ↗';
    actions.append(allToolsBtn, ytLink);
    banner.append(idBox, actions);
    box.append(banner);

    const split = el('div', 'an-aisearch-split');
    const vidCard = makeVideoCard(latestVideo, { featured: true });
    const rightGrid = el('div', 'an-tools-grid');
    for (const tool of (toolsList.length ? toolsList : worldData.aiSearchTools || []).slice(0, 6)) {
      rightGrid.append(makeToolCard(tool));
    }
    split.append(vidCard, rightGrid);
    box.append(split);
    sec2.append(box);
    frag.append(sec2);
  }

  // Section 3: Live Global Wire (remaining items with Load More)
  const rest = filtered.filter((s) => !usedIds.has(s.id));
  if (rest.length) {
    const sec3 = el('section', 'an-section', { 'aria-labelledby': 'an-h-wire' });
    const head3 = el('div', 'an-sec-head');
    const h3 = el('h2', 'an-sec-title', { id: 'an-h-wire' });
    h3.append('Live Global Wire ');
    const c3 = el('span', 'an-sec-count'); c3.textContent = `(${rest.length})`; h3.append(c3);
    const n3 = el('p', 'an-sec-note'); n3.textContent = 'Real-time feeds from The Decoder, TechCrunch AI, The Verge, OpenAI, DeepMind, Google AI, HF Daily Papers & HN.';
    head3.append(h3, n3);
    sec3.append(head3);

    const grid = el('div', 'an-grid');
    for (const item of rest.slice(0, wireLimit)) grid.append(makeStoryCard(item));
    sec3.append(grid);

    if (rest.length > wireLimit) {
      const moreWrap = el('div', 'an-more-wrap');
      const moreBtn = el('button', 'an-more-btn', { type: 'button' });
      const remaining = rest.length - wireLimit;
      moreBtn.textContent = `Load more dispatches (${remaining} more)`;
      moreBtn.addEventListener('click', () => {
        wireLimit += 12;
        renderStage();
      });
      moreWrap.append(moreBtn);
      sec3.append(moreWrap);
    }
    frag.append(sec3);
  }

  stage.replaceChildren(frag);
}

// ---------- Tab 2: Models & Open Weights ----------

function renderModelsView(stage) {
  const frag = document.createDocumentFragment();
  const sec = el('section', 'an-section');
  const head = el('div', 'an-sec-head');
  const h = el('h2', 'an-sec-title'); h.textContent = 'Open Weights & GitHub Models';
  const note = el('p', 'an-sec-note'); note.textContent = 'Live GitHub frontier orgs (MoonshotAI Kimi, QwenLM, DeepSeek, Mistral, Sakana) + trending Hugging Face releases.';
  head.append(h, note);
  sec.append(head);

  const filters = el('div', 'an-subfilters');
  for (const [key, lbl] of [['all', 'All Open Weights'], ['github', 'GitHub Repos'], ['huggingface', 'Hugging Face Trending'], ['china', 'China Open Models']]) {
    const b = el('button', 'an-chip', { type: 'button', 'aria-pressed': modelFilter === key ? 'true' : 'false' });
    b.textContent = lbl;
    b.addEventListener('click', () => { modelFilter = key; renderStage(); });
    filters.append(b);
  }
  sec.append(filters);

  let list = (worldData.openWeights || []).filter(matchesFilters);
  if (modelFilter === 'github') list = list.filter((m) => m.kind === 'github');
  else if (modelFilter === 'huggingface') list = list.filter((m) => m.kind === 'huggingface');
  else if (modelFilter === 'china') list = list.filter((m) => m.region === 'china');

  if (!list.length) {
    const empty = el('p', 'an-empty'); empty.textContent = 'No open-weight releases match this filter.';
    sec.append(empty);
  } else {
    const grid = el('div', 'an-weights-grid');
    for (const m of list) {
      const card = el('article', 'an-card');
      const mediaItem = { ...m, openWeights: true, category: 'opensource' };
      card.append(makeCardMedia(mediaItem, { onOpen: () => openReader(mediaItem) }));

      const body = el('div', 'an-card-body');
      const meta = el('div', 'an-card-meta');
      const lab = el('span', 'an-card-loc'); lab.textContent = m.lab || m.source;
      meta.append(lab);
      if (m.stars) { const st = el('span'); st.textContent = `· ★ ${compactNumber(m.stars)}`; meta.append(st); }
      if (m.likes) { const lk = el('span'); lk.textContent = `· ♥ ${compactNumber(m.likes)}`; meta.append(lk); }
      if (m.downloads) { const dl = el('span'); dl.textContent = `· ↓ ${compactNumber(m.downloads)}`; meta.append(dl); }

      const title = el('h3', 'an-card-title');
      title.textContent = m.name || m.title;
      title.addEventListener('click', () => openReader(mediaItem));

      const desc = el('p', 'an-card-summary');
      desc.textContent = m.summary;

      const acts = el('div', 'an-card-actions');
      if (safeLink(m.githubUrl)) {
        const gh = el('a', 'an-act an-act-gh', { href: m.githubUrl, target: '_blank', rel: 'noopener noreferrer' });
        gh.innerHTML = `${ICON.github}<span>GitHub Repo</span>`;
        acts.append(gh);
        const cloneBtn = el('button', 'an-act', { type: 'button' });
        cloneBtn.textContent = 'Copy clone';
        cloneBtn.addEventListener('click', () => copyText(`git clone ${m.githubUrl}.git`, 'Copied git clone command'));
        acts.append(cloneBtn);
      }
      if (safeLink(m.huggingfaceUrl)) {
        const hf = el('a', 'an-act an-act-hf', { href: m.huggingfaceUrl, target: '_blank', rel: 'noopener noreferrer' });
        hf.textContent = 'Hugging Face ↗';
        acts.append(hf);
      }
      const saveBtn = el('button', 'an-act an-act-save', {
        type: 'button',
        'aria-pressed': isSaved(m.id) ? 'true' : 'false',
        'aria-label': `Save ${m.name}`,
      });
      saveBtn.innerHTML = ICON.bookmark;
      saveBtn.addEventListener('click', () => {
        const on = toggleSave(mediaItem);
        saveBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      acts.append(saveBtn);

      body.append(meta, title, desc, acts);
      card.append(body);
      grid.append(card);
    }
    sec.append(grid);
  }

  frag.append(sec);
  stage.replaceChildren(frag);
}

// ---------- Tab 3: @theAIsearch Tools Vault ----------

function renderToolsView(stage) {
  const frag = document.createDocumentFragment();
  const sec = el('section', 'an-section');
  const head = el('div', 'an-sec-head');
  const h = el('h2', 'an-sec-title'); h.textContent = '@theAIsearch · AI Tools & GitHub Vault';
  const link = el('a', 'an-sec-link', {
    href: 'https://www.youtube.com/@theAIsearch',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  link.textContent = 'Subscribe on YouTube ↗';
  head.append(h, link);
  sec.append(head);

  const filters = el('div', 'an-subfilters');
  for (const [key, lbl] of [['all', 'All Tools'], ['github', 'GitHub Repos'], ['project', 'Open Project Pages'], ['huggingface', 'Hugging Face Models'], ['launch', 'Official Launches']]) {
    const b = el('button', 'an-chip', { type: 'button', 'aria-pressed': toolFilter === key ? 'true' : 'false' });
    b.textContent = lbl;
    b.addEventListener('click', () => { toolFilter = key; renderStage(); });
    filters.append(b);
  }
  sec.append(filters);

  let tools = (worldData.aiSearchTools || []).filter(matchesFilters);
  if (toolFilter !== 'all') tools = tools.filter((t) => t.kind === toolFilter);

  if (!tools.length) {
    const empty = el('p', 'an-empty'); empty.textContent = 'No @theAIsearch tools match this filter yet.';
    sec.append(empty);
  } else {
    const grid = el('div', 'an-tools-grid');
    for (const tool of tools) grid.append(makeToolCard(tool));
    sec.append(grid);
  }

  frag.append(sec);
  stage.replaceChildren(frag);
}

// ---------- Tab 4: Video Briefings ----------

function makeVideoCard(video, { featured = false } = {}) {
  const card = el('article', `an-card${featured ? ' an-card-lead' : ''}`);
  const open = () => openCinema(video, 0);
  const mediaItem = {
    title: video.title,
    image: video.thumbnail,
    videoId: video.videoId,
    toolCount: (video.tools || []).length,
    regionLabel: '@theAIsearch',
    lab: '@theAIsearch',
    category: 'videos',
  };
  card.append(makeCardMedia(mediaItem, { isLead: featured, onOpen: open }));

  const body = el('div', 'an-card-body');
  const meta = el('div', 'an-card-meta');
  const ch = el('span', 'an-card-loc'); ch.textContent = video.channel || '@theAIsearch';
  const sep = el('span'); sep.textContent = '·';
  const tm = el('time'); tm.textContent = relativeTime(video.publishedAt);
  const tc = el('span'); tc.textContent = `· ${(video.tools || []).length} tools linked`;
  meta.append(ch, sep, tm, tc);

  const title = el('h3', 'an-card-title');
  title.textContent = video.title;
  title.addEventListener('click', open);

  const sum = el('p', 'an-card-summary');
  sum.textContent = video.summary;

  const acts = el('div', 'an-card-actions');
  const watchBtn = el('button', 'an-act an-act-primary', { type: 'button' });
  watchBtn.innerHTML = `${ICON.play}<span>Watch + Tools</span>`;
  watchBtn.addEventListener('click', open);
  const yt = el('a', 'an-act', { href: safeLink(video.url) || 'https://www.youtube.com/@theAIsearch', target: '_blank', rel: 'noopener noreferrer' });
  yt.innerHTML = `<span>YouTube</span>${ICON.ext}`;
  acts.append(watchBtn, yt);

  body.append(meta, title, sum, acts);
  card.append(body);
  return card;
}

function renderVideosView(stage) {
  const frag = document.createDocumentFragment();
  const sec = el('section', 'an-section');
  const head = el('div', 'an-sec-head');
  const h = el('h2', 'an-sec-title'); h.textContent = 'AI Video Briefings · @theAIsearch Cinema';
  const note = el('p', 'an-sec-note'); note.textContent = 'Watch right inside agi1.app/ainews with clickable timestamps and extracted GitHub & AI tool links.';
  head.append(h, note);
  sec.append(head);

  const videos = (worldData.videos || []).filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const toolText = (v.tools || []).map((t) => t.name).join(' ');
    return `${v.title} ${v.summary} ${toolText}`.toLowerCase().includes(q);
  });

  if (!videos.length) {
    const empty = el('p', 'an-empty'); empty.textContent = 'No video briefings match your search.';
    sec.append(empty);
  } else {
    const grid = el('div', 'an-videos-grid');
    for (const v of videos) grid.append(makeVideoCard(v));
    sec.append(grid);
  }

  frag.append(sec);
  stage.replaceChildren(frag);
}

// ---------- Tab 5: Labs, Markets & Source Radar ----------

function renderMarketsView(stage) {
  const frag = document.createDocumentFragment();
  const list = (worldData.stories || [])
    .filter((s) => s.category === 'markets' || s.category === 'research' || s.sourceKind === 'spotlight')
    .filter(matchesFilters);

  const sec1 = el('section', 'an-section');
  const h1 = el('div', 'an-sec-head');
  const t1 = el('h2', 'an-sec-title'); t1.textContent = 'Frontier Labs, IPOs, AGI & Research';
  const n1 = el('p', 'an-sec-note'); n1.textContent = 'Anthropic Nasdaq ANT, Sam Altman & OpenAI AGI updates, Meta Muse, DeepMind science & global AI markets.';
  h1.append(t1, n1);
  sec1.append(h1);

  if (!list.length) {
    const empty = el('p', 'an-empty'); empty.textContent = 'No lab or market stories match this filter.';
    sec1.append(empty);
  } else {
    const grid = el('div', 'an-grid');
    for (const item of list) grid.append(makeStoryCard(item));
    sec1.append(grid);
  }
  frag.append(sec1);

  // Connected Global Live Sources Health Grid
  const sec2 = el('section', 'an-section');
  const h2 = el('div', 'an-sec-head');
  const t2 = el('h2', 'an-sec-title'); t2.textContent = 'Connected Global Intelligence Sources';
  const n2 = el('p', 'an-sec-note'); n2.textContent = 'Auto-updating feeds powering agi1.app/ainews around the clock.';
  h2.append(t2, n2);
  sec2.append(h2);

  const sGrid = el('div', 'an-sources-grid');
  for (const src of worldData.sources || []) {
    const pill = el('div', 'an-source-pill');
    const nm = el('strong'); nm.textContent = src.name;
    const st = el('span', `an-source-status${src.status === 'fallback' ? ' is-fallback' : src.status !== 'live' ? ' is-offline' : ''}`);
    st.textContent = src.status === 'live' ? `LIVE · ${src.count}` : src.status.toUpperCase();
    pill.append(nm, st);
    sGrid.append(pill);
  }
  sec2.append(sGrid);
  frag.append(sec2);

  stage.replaceChildren(frag);
}

// ---------- Tab 6: Saved Vault ----------

function renderSavedView(stage) {
  const sec = el('section', 'an-section');
  const head = el('div', 'an-sec-head');
  const h = el('h2', 'an-sec-title'); h.textContent = 'Your Saved Vault';
  const note = el('p', 'an-sec-note'); note.textContent = 'Bookmarked dispatches, open-weight repos, and @theAIsearch tools kept in this browser.';
  head.append(h, note);
  sec.append(head);

  if (!savedItems.length) {
    const empty = el('p', 'an-empty');
    empty.textContent = 'Your vault is empty. Tap the bookmark icon on any story, GitHub repo, or @theAIsearch tool to save it here.';
    sec.append(empty);
  } else {
    const grid = el('div', 'an-grid');
    for (const item of savedItems) grid.append(makeStoryCard(item));
    sec.append(grid);
  }
  stage.replaceChildren(sec);
}

// ---------- Modals: Dispatch Reader, Cinema Video Player, Live Alerts ----------

function buildModals() {
  // 1. Dispatch Reader Dialog
  readerDlg = el('dialog', 'an-dialog', { 'aria-labelledby': 'an-reader-h' });
  const rHead = el('div', 'an-dlg-head');
  const rKick = el('span', 'an-dlg-kicker', { 'data-reader-kicker': '' });
  const rClose = el('button', 'an-dlg-close', { type: 'button', 'aria-label': 'Close dispatch' });
  rClose.textContent = '×';
  rClose.addEventListener('click', () => readerDlg.close());
  rHead.append(rKick, rClose);
  const rBody = el('div', 'an-dlg-body', { 'data-reader-body': '' });
  readerDlg.append(rHead, rBody);
  readerDlg.addEventListener('click', (e) => { if (e.target === readerDlg) readerDlg.close(); });
  document.body.append(readerDlg);

  // 2. Cinema Video Player Dialog
  cinemaDlg = el('dialog', 'an-dialog an-dialog-cinema', { 'aria-labelledby': 'an-cinema-h' });
  const cHead = el('div', 'an-dlg-head');
  const cKick = el('span', 'an-dlg-kicker'); cKick.textContent = '@theAIsearch · Cinema Briefing + Live Tools';
  const cClose = el('button', 'an-dlg-close', { type: 'button', 'aria-label': 'Close video player' });
  cClose.textContent = '×';
  cClose.addEventListener('click', () => cinemaDlg.close());
  cHead.append(cKick, cClose);
  const cBody = el('div', 'an-dlg-body', { 'data-cinema-body': '' });
  cinemaDlg.append(cHead, cBody);
  cinemaDlg.addEventListener('click', (e) => { if (e.target === cinemaDlg) cinemaDlg.close(); });
  cinemaDlg.addEventListener('close', () => {
    cBody.replaceChildren(); // Stop YouTube playback immediately on close
    cinemaVideo = null;
  });
  document.body.append(cinemaDlg);

  // 3. Live Alerts & Watchlist Dialog
  alertsDlg = el('dialog', 'an-dialog', { 'aria-labelledby': 'an-alerts-h' });
  const aHead = el('div', 'an-dlg-head');
  const aKick = el('span', 'an-dlg-kicker', { id: 'an-alerts-h' }); aKick.textContent = 'Live AI News Notifications & Watchlist';
  const aClose = el('button', 'an-dlg-close', { type: 'button', 'aria-label': 'Close notifications' });
  aClose.textContent = '×';
  aClose.addEventListener('click', () => alertsDlg.close());
  aHead.append(aKick, aClose);
  const aBody = el('div', 'an-dlg-body', { 'data-alerts-body': '' });
  alertsDlg.append(aHead, aBody);
  alertsDlg.addEventListener('click', (e) => { if (e.target === alertsDlg) alertsDlg.close(); });
  document.body.append(alertsDlg);
}

function openReader(item) {
  if (!readerDlg || !item) return;
  const kicker = readerDlg.querySelector('[data-reader-kicker]');
  const body = readerDlg.querySelector('[data-reader-body]');
  kicker.textContent = `${item.regionLabel || 'Global'} · ${item.lab || item.source || 'AI Dispatch'}`;

  const wrap = document.createDocumentFragment();
  const media = el('div', 'an-reader-media');
  if (item.image) {
    const img = el('img', '', { src: item.image, alt: '' });
    img.addEventListener('error', () => img.replaceWith(makeVisualPlate(item)), { once: true });
    media.append(img);
  } else {
    media.append(makeVisualPlate(item));
  }
  wrap.append(media);

  const title = el('h2', 'an-reader-title', { id: 'an-reader-h' });
  title.textContent = item.title || item.name;
  wrap.append(title);

  const meta = el('div', 'an-reader-meta');
  meta.textContent = [
    item.source,
    relativeTime(item.publishedAt),
    item.openWeights ? 'Open Weights' : '',
    item.stars ? `★ ${compactNumber(item.stars)} GitHub stars` : '',
  ].filter(Boolean).join(' · ');
  wrap.append(meta);

  const summary = el('p', 'an-reader-summary');
  summary.textContent = item.summary;
  wrap.append(summary);

  if (item.agiNote) {
    const note = el('div', 'an-reader-note');
    const av = el('img', '', { src: '/images/landing/agi1-face.webp', alt: '', width: 36, height: 36 });
    const txt = el('p');
    const b = el('b'); b.textContent = 'AGI-1 take: ';
    txt.append(b, item.agiNote);
    note.append(av, txt);
    wrap.append(note);
  }

  const acts = el('div', 'an-reader-actions');
  const srcUrl = safeLink(item.url);
  if (srcUrl) {
    const a = el('a', 'an-btn an-btn-alert', { href: srcUrl, target: '_blank', rel: 'noopener noreferrer' });
    a.innerHTML = `<span>Open Full Source</span>${ICON.ext}`;
    acts.append(a);
  }
  const gh = safeLink(item.githubUrl);
  if (gh) {
    const a = el('a', 'an-btn an-act-gh', { href: gh, target: '_blank', rel: 'noopener noreferrer' });
    a.innerHTML = `${ICON.github}<span>GitHub Repo</span>`;
    acts.append(a);
  }
  const hf = safeLink(item.huggingfaceUrl);
  if (hf) {
    const a = el('a', 'an-btn an-act-hf', { href: hf, target: '_blank', rel: 'noopener noreferrer' });
    a.textContent = 'Hugging Face ↗';
    acts.append(a);
  }
  if (item.hub && getHub(item.hub)) {
    const pingBtn = el('button', 'an-btn', { type: 'button' });
    pingBtn.innerHTML = `${ICON.pin}<span>Ping on Globe</span>`;
    pingBtn.addEventListener('click', () => {
      readerDlg.close();
      selectHub(item.hub);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    acts.append(pingBtn);
  }
  const copyBtn = el('button', 'an-btn', { type: 'button' });
  copyBtn.innerHTML = `${ICON.link}<span>Copy Link</span>`;
  copyBtn.addEventListener('click', () => {
    const share = `${location.origin}/ainews?story=${encodeURIComponent(item.id)}`;
    copyText(share, 'Dispatch link copied');
  });
  acts.append(copyBtn);

  wrap.append(acts);
  body.replaceChildren(wrap);
  if (!readerDlg.open) readerDlg.showModal();
}

function openCinema(video, startSec = 0) {
  if (!cinemaDlg || !video?.videoId) return;
  cinemaVideo = video;
  const body = cinemaDlg.querySelector('[data-cinema-body]');
  const grid = el('div', 'an-cinema-grid');

  const left = el('div');
  const frameWrap = el('div', 'an-cinema-frame-wrap');
  const embedSrc = (sec) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0${sec > 0 ? `&start=${Math.floor(sec)}` : ''}`;
  const iframe = el('iframe', 'an-cinema-frame', {
    src: embedSrc(startSec),
    title: video.title,
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
  frameWrap.append(iframe);

  const meta = el('div', 'an-cinema-meta');
  const h = el('h2', '', { id: 'an-cinema-h' }); h.textContent = video.title;
  const p = el('p'); p.textContent = video.summary;
  const row = el('div', 'an-card-actions');
  const yt = el('a', 'an-act an-act-primary', { href: safeLink(video.url) || 'https://www.youtube.com/@theAIsearch', target: '_blank', rel: 'noopener noreferrer' });
  yt.innerHTML = `<span>Open on YouTube</span>${ICON.ext}`;
  const shareBtn = el('button', 'an-act', { type: 'button' });
  shareBtn.innerHTML = `${ICON.link}<span>Copy Video Link</span>`;
  shareBtn.addEventListener('click', () => copyText(`${location.origin}/ainews?video=${encodeURIComponent(video.videoId)}`, 'Video link copied'));
  row.append(yt, shareBtn);
  meta.append(h, p, row);
  left.append(frameWrap, meta);

  const right = el('div', 'an-cinema-tools');
  const tools = video.tools || [];
  const head = el('p', 'an-cinema-tools-head');
  head.textContent = tools.length
    ? `${tools.length} Extracted AI Tools & Repos in this Video`
    : 'Chapters & Links';
  right.append(head);

  if (!tools.length) {
    const empty = el('p', 'an-empty');
    empty.textContent = 'This briefing has no standalone tool links — open it on YouTube for full notes.';
    right.append(empty);
  } else {
    for (const tool of tools) {
      const item = el('div', 'an-cinema-tool-row');
      const info = el('div', 'an-cinema-tool-info');
      const strong = el('strong'); strong.textContent = tool.name;
      const sub = el('span'); sub.textContent = tool.repo || tool.url.replace(/^https?:\/\/(?:www\.)?/, '').slice(0, 40);
      info.append(strong, sub);

      const btns = el('div', 'an-cinema-tool-btns');
      if (tool.sec > 0) {
        const jump = el('button', 'an-act', { type: 'button', title: `Jump video to ${tool.clock}` });
        jump.textContent = tool.clock;
        jump.addEventListener('click', () => {
          iframe.src = embedSrc(tool.sec);
          toast(`Jumped to ${tool.name} (${tool.clock})`);
        });
        btns.append(jump);
      }
      const href = safeLink(tool.url);
      if (href) {
        const openLink = el('a', `an-act ${tool.kind === 'github' ? 'an-act-gh' : 'an-act-primary'}`, {
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        openLink.textContent = tool.kind === 'github' ? 'GitHub ↗' : 'Open ↗';
        btns.append(openLink);
      }
      item.append(info, btns);
      right.append(item);
    }
  }

  grid.append(left, right);
  body.replaceChildren(grid);
  if (!cinemaDlg.open) cinemaDlg.showModal();
}

function openAlertsModal() {
  if (!alertsDlg) return;
  renderAlertsModalBody();
  if (!alertsDlg.open) alertsDlg.showModal();
}

function syncAlertBadges() {
  const active = alertPrefs.enabled;
  const cta = document.querySelector('[data-an-alert-cta]');
  const heroBtn = document.querySelector('.an-btn-alert[data-an-open-alerts]');
  const bellBtn = document.querySelector('.an-bell-btn');
  const bellText = document.querySelector('[data-an-bell-state]');
  const bellDot = document.querySelector('[data-an-bell-dot]');
  const unseen = document.querySelector('[data-an-unseen]');

  if (cta) cta.textContent = active ? 'Alerts Active' : 'Get Live Alerts';
  heroBtn?.classList.toggle('is-active', active);
  bellBtn?.classList.toggle('is-active', active);
  if (bellText) bellText.textContent = active ? 'Alerts On' : 'Alerts';
  if (bellDot) bellDot.hidden = !active && alertInbox.length === 0;
  if (unseen) {
    unseen.hidden = alertInbox.length === 0;
    unseen.textContent = String(alertInbox.length);
  }
}

function renderAlertsModalBody() {
  const body = alertsDlg.querySelector('[data-alerts-body]');
  const perm = browserNotificationState();
  const frag = document.createDocumentFragment();

  // Section 1: Master Live Notification Toggle
  const sec1 = el('div', 'an-alert-section');
  const status = el('div', 'an-alert-status');
  const left = el('div');
  const title = el('strong');
  title.textContent = alertPrefs.enabled ? 'Live AI News Alerts are ON' : 'Turn On Live AI News Alerts';
  const desc = el('p');
  desc.textContent = perm === 'denied'
    ? 'Browser push notifications are blocked in your browser settings — in-page live alerts & sound chime still work, or allow notifications in site settings.'
    : perm === 'granted' && alertPrefs.enabled
      ? `Browser notifications granted · auto-checking every ${alertPrefs.intervalMin} min for matching global drops.`
      : 'Get notified the moment a new Qwen/Kimi model, Anthropic/OpenAI headline, or @theAIsearch AI tool video lands.';
  left.append(title, desc);

  const btnGroup = el('div', 'an-badge-group');
  const toggleBtn = el('button', `an-btn ${alertPrefs.enabled ? 'an-btn-secondary' : 'an-btn-alert'}`, { type: 'button' });
  toggleBtn.textContent = alertPrefs.enabled ? 'Pause Alerts' : 'Enable Live Alerts';
  toggleBtn.addEventListener('click', async () => {
    if (!alertPrefs.enabled) {
      const p = await requestBrowserNotificationPermission();
      alertPrefs = saveAlertPrefs({ ...alertPrefs, enabled: true });
      schedulePoll();
      syncAlertBadges();
      renderAlertsModalBody();
      if (p === 'granted') {
        if (alertPrefs.sound) playAlertChime();
        fireDesktopNotification({
          title: 'AGI AI News World · Alerts Enabled',
          body: 'You will be notified when new AI models, repos, and @theAIsearch tool videos drop.',
        });
        toast('Live browser alerts enabled!');
      } else {
        toast('In-page live alerts enabled');
      }
    } else {
      alertPrefs = saveAlertPrefs({ ...alertPrefs, enabled: false });
      syncAlertBadges();
      renderAlertsModalBody();
      toast('Live alerts paused');
    }
  });

  const testBtn = el('button', 'an-btn', { type: 'button' });
  testBtn.textContent = 'Test Alert';
  testBtn.addEventListener('click', async () => {
    if (browserNotificationState() === 'default') await requestBrowserNotificationPermission();
    if (alertPrefs.sound) playAlertChime();
    const lead = worldData?.stories?.[0];
    const sent = fireDesktopNotification({
      title: 'AGI AI News · Test Signal',
      body: lead ? lead.title : 'Live AI News World notifications are active!',
    });
    toast(sent ? 'Desktop alert + chime sent!' : `In-page alert triggered: ${lead?.title?.slice(0, 60) || 'Working!'}`);
    renderAlertsModalBody();
  });

  btnGroup.append(toggleBtn, testBtn);
  status.append(left, btnGroup);
  sec1.append(status);
  frag.append(sec1);

  // Section 2: Topic Channels + Cadence
  const sec2 = el('div', 'an-alert-section');
  const h2 = el('strong'); h2.textContent = 'What should notify you?';
  const checks = el('div', 'an-checks');
  const channelDefs = [
    ['breaking', 'Breaking Global AI News', 'Major announcements across all 7 AI hubs'],
    ['models', 'Open Weights & GitHub Repos', 'Qwen, Kimi K3.1 Pro, DeepSeek, Meta Muse, HF'],
    ['aisearch', '@theAIsearch Videos & Tools', 'Every new video + extracted AI tool & repo links'],
    ['markets', 'Frontier Labs, IPOs & AGI', 'Anthropic IPO, Sam Altman / OpenAI, DeepMind'],
  ];
  for (const [key, label, sub] of channelDefs) {
    const lbl = el('label', 'an-check');
    const cb = el('input', '', { type: 'checkbox' });
    cb.checked = Boolean(alertPrefs.channels[key]);
    cb.addEventListener('change', () => {
      alertPrefs = saveAlertPrefs({ ...alertPrefs, channels: { ...alertPrefs.channels, [key]: cb.checked } });
      syncAlertBadges();
    });
    const sp = el('span');
    const b = el('b'); b.textContent = label;
    const sm = el('small'); sm.textContent = sub;
    sp.append(b, sm);
    lbl.append(cb, sp);
    checks.append(lbl);
  }
  sec2.append(h2, checks);

  // Sound + check frequency row
  const optsRow = el('div', 'an-rss-row');
  const soundLbl = el('label', 'an-check');
  const soundCb = el('input', '', { type: 'checkbox' });
  soundCb.checked = alertPrefs.sound;
  soundCb.addEventListener('change', () => { alertPrefs = saveAlertPrefs({ ...alertPrefs, sound: soundCb.checked }); });
  const soundTxt = el('span'); soundTxt.textContent = 'Play gentle signal chime';
  soundLbl.append(soundCb, soundTxt);

  const intWrap = el('div', 'an-badge-group');
  for (const mins of [5, 15, 30]) {
    const b = el('button', 'an-chip', { type: 'button', 'aria-pressed': alertPrefs.intervalMin === mins ? 'true' : 'false' });
    b.textContent = `Check every ${mins}m`;
    b.addEventListener('click', () => {
      alertPrefs = saveAlertPrefs({ ...alertPrefs, intervalMin: mins });
      schedulePoll();
      renderAlertsModalBody();
    });
    intWrap.append(b);
  }
  optsRow.append(soundLbl, intWrap);
  sec2.append(optsRow);
  frag.append(sec2);

  // Section 3: Custom Keyword Watchlist
  const sec3 = el('div', 'an-alert-section');
  const h3 = el('strong'); h3.textContent = 'Custom Keyword Watchlist';
  const p3 = el('p', 'an-sec-note'); p3.textContent = 'Always trigger an alert when any of these words appear anywhere in global AI news.';
  const form = el('form', 'an-kw-form');
  const input = el('input', 'an-kw-input', { type: 'text', placeholder: 'Add keyword (e.g. DeepSeek, GPT-7, ComfyUI)…', maxlength: 32 });
  const addBtn = el('button', 'an-btn an-btn-secondary', { type: 'submit' }); addBtn.textContent = 'Add';
  form.append(input, addBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    alertPrefs = saveAlertPrefs({ ...alertPrefs, keywords: [...alertPrefs.keywords, val] });
    renderAlertsModalBody();
  });

  const kwList = el('div', 'an-kw-list');
  for (const kw of alertPrefs.keywords) {
    const chip = el('span', 'an-kw-chip');
    chip.textContent = kw;
    const rm = el('button', '', { type: 'button', 'aria-label': `Remove ${kw}` });
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      alertPrefs = saveAlertPrefs({ ...alertPrefs, keywords: alertPrefs.keywords.filter((k) => k !== kw) });
      renderAlertsModalBody();
    });
    chip.append(rm);
    kwList.append(chip);
  }
  sec3.append(h3, p3, form, kwList);
  frag.append(sec3);

  // Section 4: 24/7 Background RSS / Discord / Slack / Telegram Alerts
  const sec4 = el('div', 'an-alert-section');
  const h4 = el('strong'); h4.textContent = '24/7 Background Feed (RSS / Discord / Slack / Mobile)';
  const p4 = el('p', 'an-sec-note'); p4.textContent = 'Plug our live RSS 2.0 feed into any RSS notifier app, Discord webhook, Slack, or Apple Shortcut for alerts even when your browser is closed.';
  const rssRow = el('div', 'an-rss-row');
  const rssUrl = `${location.origin}/ainews/rss`;
  const rssInput = el('input', 'an-rss-url', { type: 'url', readonly: true, value: rssUrl, 'aria-label': 'Live RSS feed URL' });
  const copyRss = el('button', 'an-btn an-btn-secondary', { type: 'button' }); copyRss.textContent = 'Copy RSS URL';
  copyRss.addEventListener('click', () => copyText(rssUrl, 'RSS feed URL copied'));
  const openRss = el('a', 'an-btn', { href: '/ainews/rss', target: '_blank', rel: 'noopener noreferrer' }); openRss.textContent = 'Open XML ↗';
  rssRow.append(rssInput, copyRss, openRss);
  sec4.append(h4, p4, rssRow);
  frag.append(sec4);

  // Section 5: Recent Alert Inbox
  if (alertInbox.length) {
    const sec5 = el('div', 'an-alert-section');
    const row5 = el('div', 'an-sec-head');
    const h5 = el('strong'); h5.textContent = `Recent Alert Inbox (${alertInbox.length})`;
    const clear5 = el('button', 'an-mini-btn', { type: 'button' }); clear5.textContent = 'Mark all read';
    clear5.addEventListener('click', () => {
      alertInbox = [];
      syncAlertBadges();
      renderAlertsModalBody();
    });
    row5.append(h5, clear5);
    const inbox = el('div', 'an-inbox');
    for (const item of alertInbox) {
      const btn = el('button', 'an-inbox-item', { type: 'button' });
      const info = el('div');
      const st = el('strong'); st.textContent = item.title;
      const sp = el('span'); sp.textContent = `${item.regionLabel || 'Global'} · ${relativeTime(item.publishedAt)}`;
      info.append(st, sp);
      const go = el('span'); go.textContent = '→';
      btn.append(info, go);
      btn.addEventListener('click', () => {
        alertsDlg.close();
        openReader(item);
      });
      inbox.append(btn);
    }
    sec5.append(row5, inbox);
    frag.append(sec5);
  }

  body.replaceChildren(frag);
}

// ---------- Helpers ----------

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast(text);
  }
}

let toastTimer = 0;
function toast(message) {
  let node = document.querySelector('.an-toast');
  if (!node) {
    node = el('div', 'an-toast', { role: 'status', 'aria-live': 'polite', hidden: true });
    document.body.append(node);
  }
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
}
