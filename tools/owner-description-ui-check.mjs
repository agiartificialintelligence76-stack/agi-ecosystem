// Local fixture only: a Her world row with no original caption stays fully editable.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.OWNER_PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:5179';
const originalName = 'Risk check your coins on clank';
const firstCaption = 'Check any coin before you trade';
const secondCaption = 'A fresh description after clearing';
await mkdir('tools/owner-qa', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.OWNER_BROWSER_PATH ? { executablePath: process.env.OWNER_BROWSER_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
context.setDefaultTimeout(30000);
await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
const page = await context.newPage(), errors = [];
context.on('page', current => current.on('pageerror', error => errors.push(error.message)));
page.on('pageerror', error => errors.push(error.message));
const preview = page.frameLocator('[data-owner-preview]');
const checker = preview.locator('.lp-eco a[href="#checker"]');
const description = page.getByLabel('Entry description', { exact: true });

async function inputEquals(label, value) {
  await page.getByLabel(label, { exact: true }).waitFor();
  await page.waitForFunction(({ label, value }) => [...document.querySelectorAll('.oc-field')].find(n => n.querySelector('span')?.textContent === label)?.querySelector('input')?.value === value, { label, value });
}
async function publish() {
  const saved = page.waitForResponse(response => {
    if (!response.url().endsWith('/api/wallet') || response.request().method() !== 'POST') return false;
    try { return response.request().postDataJSON()?.action === 'site-save'; } catch { return false; }
  });
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  assert((await saved).ok(), 'The fixture accepted the published content');
  await page.getByText('Published. Visitors will see').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-owner-workspace]').inert);
}
async function openOwner() {
  await page.goto(`${base}/__owner-test`);
  await page.getByRole('button', { name: 'Open as the owner', exact: true }).click();
  await page.locator('[data-owner-workspace]').waitFor({ state: 'visible' });
  await preview.locator('html[data-owner-picking="true"]').waitFor({ state: 'attached' });
  await checker.waitFor();
}
async function otherRows(scope) {
  return scope.locator('.lp-eco > ul > li > a').evaluateAll(nodes => nodes.filter(n => n.getAttribute('href') !== '#checker').map(n => ({ href: n.getAttribute('href'), text: n.textContent, caption: n.querySelector('small')?.textContent, arrow: n.querySelector('i')?.textContent })));
}
async function checkEntry(link, name, caption) {
  assert.equal(await link.evaluate(n => [...n.childNodes].filter(t => t.nodeType === 3).map(t => t.textContent).join('').trim()), name);
  assert.equal(await link.locator('small').textContent(), caption);
  assert.equal(await link.getAttribute('href'), '#checker');
  assert.equal(await link.locator('i').textContent(), '↓');
  assert.equal(await link.locator('i').isVisible(), true, 'The arrow stays visible with an empty or filled caption');
  assert.equal(await link.locator('small').isVisible(), Boolean(caption));
}
async function freshVisitor(name, caption, baseline) {
  const visitor = await context.newPage();
  try {
    await visitor.goto(base);
    await visitor.waitForFunction(({ name, caption }) => {
      const node = document.querySelector('.lp-eco a[href="#checker"]');
      return node && [...node.childNodes].filter(t => t.nodeType === 3).map(t => t.textContent).join('').trim() === name && node.querySelector('small')?.textContent === caption;
    }, { name, caption });
    await checkEntry(visitor.locator('.lp-eco a[href="#checker"]'), name, caption);
    assert.deepEqual(await otherRows(visitor), baseline, 'Other entries keep their names, captions, links and arrows');
  } finally { await visitor.close(); }
}

try {
  const fake = await (await context.request.get(`${base}/__owner-test/session`)).json();
  const current = await (await context.request.post(`${base}/api/wallet`, { data: { action: 'site-owner', session: fake.session } })).json();
  if (current.revision) await context.request.post(`${base}/api/wallet`, { data: { action: 'site-restore', session: fake.session, revision: current.revision, targetRevision: 0 } });
  await openOwner();
  const baseline = await otherRows(preview);

  // Seed the existing renamed entry through the same editor used by the owner.
  await checker.click();
  await inputEquals('Entry name', originalName);
  await inputEquals('Entry description', '');
  await checkEntry(checker, originalName, '');
  await page.getByLabel('Entry name', { exact: true }).fill('ClankChecker');
  await publish();
  await openOwner();
  await checker.click();
  await inputEquals('Entry name', 'ClankChecker');
  await inputEquals('Entry description', '');
  assert.equal(await description.isVisible(), true, 'An originally empty caption has a visible editor field');
  assert.equal(await description.isEnabled(), true);

  await description.fill(firstCaption);
  await checker.locator('small').getByText(firstCaption, { exact: true }).waitFor();
  await checkEntry(checker, 'ClankChecker', firstCaption);
  await page.mouse.move(40, 40);
  await page.locator('.oc-editor-grid').screenshot({ path: 'tools/owner-qa/checker-description-filled.png' });
  await publish();
  await freshVisitor('ClankChecker', firstCaption, baseline);

  await checker.locator('small').click();
  await inputEquals('Entry description', firstCaption);
  await description.fill('');
  await publish();
  await freshVisitor('ClankChecker', '', baseline);
  await openOwner();
  await checker.click();
  await inputEquals('Entry name', 'ClankChecker');
  await inputEquals('Entry description', '');
  await page.mouse.move(40, 40);
  await page.locator('.oc-editor-grid').screenshot({ path: 'tools/owner-qa/checker-description-empty.png' });

  await description.fill(secondCaption);
  await checker.locator('small').getByText(secondCaption, { exact: true }).waitFor();
  await publish();
  await freshVisitor('ClankChecker', secondCaption, baseline);
  await checker.locator('small').click();
  await inputEquals('Entry description', secondCaption);
  await page.getByRole('button', { name: 'Reset to original', exact: true }).click();
  await inputEquals('Entry name', originalName);
  await inputEquals('Entry description', '');
  await checkEntry(checker, originalName, '');
  assert.deepEqual(await otherRows(preview), baseline);
  await publish();
  const saved = await (await context.request.get(`${base}/api/wallet?site-content`)).json();
  assert.deepEqual(saved.document.edits, [], 'Reset removes both the name and caption overrides');
  await freshVisitor(originalName, '', baseline);
  assert.deepEqual(errors, []);
  console.log('PASS: initially blank ClankChecker description, preserved existing name override, fill/publish/fresh visitor, clear/reopen/refill, complete reset, unchanged links/arrows/other captions, no browser errors.');
} catch (error) {
  console.error(error.message);
  console.error('PAGE ERRORS', errors);
  await page.screenshot({ path: 'tools/owner-qa/checker-description-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
