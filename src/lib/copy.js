// A Copy button for the official contract address: the Model card's, and (2026-09-29, the owner: "contract address needs to
// be copy pasted on landing page right away") the front's. Copies the whole address; where a browser blocks the clipboard,
// it selects the address instead so Ctrl+C (or a long-press) copies it. `say` (optional): a polite live region that tells
// screen readers what happened (the button keeps its own label). `what`: which address it is (2026-09-30: also the burn
// address, src/chat/burn.js)
export function copyButton(button, { text, select, idle = button?.textContent || 'Copy', say = null, what = 'Contract address' } = {}) {
  if (!button) return;
  let reset = null;
  const show = (label, done) => {
    button.textContent = label;
    button.classList.toggle('is-done', done);
    if (say) say.textContent = done ? `${what} copied` : `${what} selected: copy it with your keyboard or a long-press`;
    clearTimeout(reset);
    reset = setTimeout(() => {
      button.textContent = idle;
      button.classList.remove('is-done');
      if (say) say.textContent = '';
    }, 1800);
  };
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      show('Copied', true);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(select);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      show('Selected', false);
    }
  });
}
