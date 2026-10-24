// The safety note's "Load more" (2026-10-24, the owner: "it's too long … put load more there so they don't have to scroll
// down too long just to read it"). Each note shows its first lines, faded, with a "Load more" button that opens the rest
// ("Show less" folds it again). Only the browser folds it: every word stays in the page (the tests, find in page, search
// engines and a page without its script all get the whole note), and a note that's already short gets no button.
// The fold's height is in footer.css (.safety-item.is-folded p).
export function startSafety(root) {
  if (!root) return;
  const items = [...root.querySelectorAll('.safety-item')];
  items.forEach((item, i) => {
    const text = item.querySelector('p');
    if (!text) return;
    text.id ||= `safety-text-${i + 1}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'safety-more';
    button.setAttribute('aria-controls', text.id);
    button.hidden = true;
    item.append(button);

    const fold = (folded) => {
      item.classList.toggle('is-folded', folded);
      button.setAttribute('aria-expanded', String(!folded));
      button.innerHTML = folded
        ? 'Load more <span aria-hidden="true">↓</span>'
        : 'Show less <span aria-hidden="true">↑</span>';
    };
    // fold it, then keep the button only if the fold actually hides something (a short note, or a wide screen, needs none)
    const measure = () => {
      if (!item.classList.contains('is-folded') && button.getAttribute('aria-expanded') === 'true') return;   // opened: leave it
      fold(true);
      const hides = text.scrollHeight - text.clientHeight > 8;
      if (!hides) { item.classList.remove('is-folded'); button.hidden = true; } else button.hidden = false;
    };

    button.addEventListener('click', () => {
      const opening = item.classList.contains('is-folded');
      fold(!opening);
      // folding a long note back up: bring its title back on screen, so the reader isn't left far below it
      if (!opening) {
        const top = item.getBoundingClientRect().top;
        if (top < 0) item.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
    // a link to something inside a folded note (or find in page landing there) opens it
    text.addEventListener('focusin', () => { if (item.classList.contains('is-folded')) fold(false); });

    measure();
    let t = 0;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(measure, 150); }, { passive: true });
    // the burn sentences (data-burn-only) appear once burns open, and the fonts change the lines: measure again then
    document.fonts?.ready.then(measure);
    new MutationObserver(measure).observe(text, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  });
}
