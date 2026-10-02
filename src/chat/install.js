// The AGI-1 app (2026-10-02, the owner: "i have an another idea but its going to be a windows app and mac app. they can
// download agi-1 on their pc … she also speaks on my pc, she will appear on my screen as well … make this better then
// continue"). The first, free step: this site installed as an app (a "web app": public/manifest.webmanifest). She gets her
// own window and icon on Windows, Mac, ChromeOS, Android, iPhone and iPad, and opens straight into full-screen talk
// (agi1.app/talk, src/chat/fullscreen.js): her voice, the mic and calls work there as on the site. Nothing to download from
// an app store, no file to trust (fake "AGI-1.exe" downloads are a classic crypto scam: the screen says we never send one),
// and it updates with every push. Chrome and Edge install it with one button; Safari has "Add to Dock" (Mac) and "Add to
// Home Screen" (iPhone, iPad); Firefox can't install sites, and the screen says so.
// A native Windows / Mac app (her on the desktop without a window, a hotkey, starting with the computer) and AGI-1 doing
// tasks on the computer are the next steps, the owner's decisions (costs, safety): see CLAUDE.md, "The AGI-1 app".
import { inTalk } from './fullscreen.js';

// Which way this browser installs a site → 'installed' | 'inapp' | 'prompt' | 'ios' | 'mac-safari' | 'android' |
// 'desktop' | 'firefox' | 'other'. prompt: the browser offered its install prompt (Chrome, Edge, Samsung Internet…);
// inapp: a link opened inside an app (Telegram, X, Instagram…), whose browser can't install anything
export function installHow({ ua = '', platform = '', touchPoints = 0, standalone = false, prompt = false } = {}) {
  if (standalone) return 'installed';
  if (/Telegram|Twitter|Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|Line\/|; wv\)/.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)) return 'ios';   // (iPads say "Macintosh")
  if (prompt) return 'prompt';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return 'mac-safari';
  if (/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'desktop';
  return 'other';
}

// What the screen says for each (plain text, shown with textContent)
export const HOW_WORDS = {
  prompt: 'Your browser can install her right here: press Install, then confirm.',
  desktop: "Your browser's menu has it: in Chrome, ⋮ → Cast, save and share → Install AGI-1 (or Install page as app); in Edge, ⋯ → Apps → Install this site as an app. Or the install icon at the right end of the address bar. Already installed? Open AGI-1 from your apps.",
  'mac-safari': "In Safari's menu bar: File → Add to Dock (macOS Sonoma or newer). The Dock app keeps its own chat history, apart from Safari's.",
  ios: 'In Safari, tap Share (the square with an arrow; on iOS 26 it\'s in the ⋯ menu), then Add to Home Screen. She opens from your home screen like an app, with her own chat history, apart from Safari\'s.',
  android: "Open your browser's menu (⋮), then Install app or Add to Home screen.",
  inapp: "This page is open inside another app, which can't install her. Open it in your browser first (the app's ⋯ or share menu → Open in browser), then Get the app there.",
  firefox: "Firefox doesn't install websites as apps the usual way. Open agi1.app/talk in Chrome, Edge or Safari to install her; full-screen talk works right here too.",
  other: "Open agi1.app/talk in Chrome, Edge or Safari, then pick Install (or Add to Home Screen) in the browser's menu.",
  installed: "She's installed: open AGI-1 from your apps, dock, taskbar or home screen.",
};

const standalone = () => ['standalone', 'fullscreen', 'window-controls-overlay', 'minimal-ui']
  .some((mode) => matchMedia(`(display-mode: ${mode})`).matches) || navigator.standalone === true;

export function startInstall(doc = document) {
  const dialog = doc.querySelector('[data-app-dialog]');
  if (!dialog) return null;
  const d$ = (sel) => dialog.querySelector(sel);
  const openers = [...doc.querySelectorAll('[data-app-open]')];
  const text = d$('[data-appdlg-text]'), install = d$('[data-appdlg-install]'), status = d$('[data-appdlg-status]');
  let deferred = null, installed = false;

  const how = () => (installed ? 'installed'
    : installHow({ ua: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints, standalone: standalone(), prompt: Boolean(deferred) }));
  const say = (words) => { status.textContent = words || ''; };
  function draw() {
    const h = how();
    text.textContent = HOW_WORDS[h];
    install.hidden = h !== 'prompt';
  }
  // inside the app itself there's nothing to get
  const showOpeners = () => { for (const b of openers) b.hidden = standalone(); };

  // Chrome, Edge (and other Chromium browsers) offer to install a site that has a manifest, once you've spent a little
  // time on it: kept for our own Install button instead of the browser's own small banner
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (dialog.open) draw();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    if (dialog.open) { draw(); say(''); }
  });

  function open() {
    const h = how();
    // Safari keeps the address it's on when you add it: full-screen talk first, so the app starts there
    if ((h === 'ios' || h === 'mac-safari') && !inTalk()) dispatchEvent(new CustomEvent('agi:talk-open', { detail: { full: false } }));
    say('');
    draw();
    if (!dialog.open) dialog.showModal();
    (install.hidden ? d$('[data-appdlg-close]') : install).focus();
  }
  for (const b of openers) b.addEventListener('click', open);
  install.addEventListener('click', async () => {
    const asked = deferred;
    if (!asked) { draw(); return; }
    deferred = null;                                  // (a prompt can be shown once)
    install.disabled = true;
    try {
      await asked.prompt();
      const choice = await asked.userChoice;
      if (choice?.outcome === 'accepted') { installed = true; say('Installing… she\'ll be in your apps in a moment.'); }
      else say('Not installed. You can install her any time from here.');
    } catch {
      say("Your browser didn't open its install window. Its menu has it too.");
    } finally {
      install.disabled = false;
      draw();
    }
  });
  d$('[data-appdlg-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // a tap outside closes it

  showOpeners();
  matchMedia('(display-mode: standalone)').addEventListener?.('change', showOpeners);
  return { open, how };
}
