// The roadmap (2026-10-14, the owner: "when they go to agi1.app/roadmap they will see a roadmap … make the roadmap page cool
// and beautiful"): roadmap.html, and its coming-soon pages stake.html, games.html and giveaway.html (the same script). Their
// words are in the pages; this only brings the theme, the menu, and the cards below the first screen in as they scroll into
// view. Nothing here asks a wallet for anything, and nothing is sent anywhere.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/roadmap.css';
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';

startTheme();
startMenu();
reveal();

// Cards below the first screen wait (is-pending: see roadmap.css) and come in as they scroll into view, one after another
// when several come at once (--rm-delay, set through the CSS object model: the CSP allows no style attributes). Never with
// "reduce motion", never without IntersectionObserver (then everything is simply there), never what's on screen already (it
// would flash), and never what's above the screen (a reload that kept its place).
function reveal() {
  const nodes = [...document.querySelectorAll('[data-rm-reveal]')];
  if (!nodes.length || typeof IntersectionObserver !== 'function') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fold = innerHeight * 0.92;
  const pending = nodes.filter((node) => node.getBoundingClientRect().top > fold);
  for (const node of pending) node.classList.add('is-pending');
  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));   // in the page's order
    batch.forEach((node, i) => {
      io.unobserve(node);
      node.style.setProperty('--rm-delay', `${Math.min(i * 0.09, 0.45).toFixed(2)}s`);
      node.classList.remove('is-pending');
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  for (const node of pending) io.observe(node);
}
