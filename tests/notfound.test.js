// 404 NOT_FOUND (2026-10-24): 404.html, which Vercel serves for every address with no page
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('404: its own page, built by Vite, with no inline code and no indexing', () => {
  const page = read('404.html');
  assert.match(page, /<title>404 NOT_FOUND · AGI<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex" \/>/);
  assert.match(page, /<script type="module" src="\/src\/notfound\/page\.js"><\/script>/);
  assert.match(page, /<script src="\/theme\.js\?v=7"><\/script>/, 'the theme from the first paint, like every page');
  assert.ok(!/<script>|style="/.test(page), 'no inline scripts or styles (the security rules block them)');
  assert.match(page, /href="\/"/, 'a way back home');
  assert.match(page, /NOT_FOUND/);
  assert.match(read('vite.config.js'), /notfound: '404\.html'/, 'the build makes dist/404.html');
  assert.ok(existsSync(new URL('../src/styles/notfound.css', import.meta.url)));
});

test('404: the visitor\'s address is shown as text only, never as HTML', () => {
  const js = read('src/notfound/page.js');
  assert.match(js, /textContent = path/);
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js));
});
