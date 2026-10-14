// The phone menu: on small screens (up to 960 px since 2026-10-05, when the Telegram button made the row longer; 920 px from
// 2026-09-27; up to 1040 px in Pop mode, whose pills are wider) the top bar's section links are hidden, and this button
// shows them as a drop-down. It closes when a link is picked, on Escape, on a tap outside, or when the links fit again (a
// wider screen, or switching Pop mode off). Where the menu starts is decided by the CSS (layout.css, pop.css) alone.
export function startMenu() {
  const bar = document.querySelector('.topbar');
  const button = bar?.querySelector('[data-menu]');
  const nav = bar?.querySelector('#site-nav');
  if (!button || !nav) return;
  const collapsed = () => getComputedStyle(button).display !== 'none';   // the menu button shows = the links are folded away

  const setOpen = (open, { focus = false } = {}) => {
    bar.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    if (open && focus) nav.querySelector('a')?.focus();
  };
  const isOpen = () => bar.classList.contains('menu-open');

  button.addEventListener('click', (e) => setOpen(!isOpen(), { focus: e.detail === 0 }));   // keyboard: focus the first link
  nav.addEventListener('click', (e) => { if (e.target.closest('a') && isOpen()) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); button.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !bar.contains(e.target)) setOpen(false); });
  const closeIfWide = () => { if (isOpen() && !collapsed()) setOpen(false); };
  for (const width of ['(min-width: 961px)', '(min-width: 1041px)']) matchMedia(width).addEventListener('change', closeIfWide);
  addEventListener('agi:skin', closeIfWide);

  // Pop mode's top bar floats see-through over the hero; once the hero has scrolled away (on the diary page: once the page
  // scrolls at all), pop.css gives it a frosted band, so the pills stay readable over busy content and any section's color.
  // On the home page the first hero is the front's (2026-09-28): the band comes once it has scrolled away; on the roadmap and
  // its coming-soon pages (2026-10-14), theirs
  const hero = document.querySelector('.lp-hero, .hero, .rm-hero');
  let stuck = null;
  const band = () => {
    const on = hero ? hero.getBoundingClientRect().bottom <= bar.offsetHeight : scrollY > 0;
    if (on !== stuck) { stuck = on; bar.classList.toggle('is-stuck', on); }
  };
  addEventListener('scroll', band, { passive: true });
  addEventListener('resize', band, { passive: true });
  band();
}
