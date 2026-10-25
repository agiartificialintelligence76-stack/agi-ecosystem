// Regression for Her world editing at the editor widths that previously hid live captions.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.OWNER_PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:5179';
await mkdir('tools/owner-qa', {recursive:true});
const browser = await chromium.launch({headless:true,...(process.env.OWNER_BROWSER_PATH?{executablePath:process.env.OWNER_BROWSER_PATH}:{})});
const context = await browser.newContext({viewport:{width:1600,height:1000}});
context.setDefaultTimeout(30000);
await context.route('**/*', route => new URL(route.request().url()).origin===base ? route.continue() : route.abort());
const page = await context.newPage(), errors=[];
page.on('pageerror',error=>errors.push(error.message));
const publish=async()=>{await page.getByRole('button',{name:'Publish changes',exact:true}).click();await page.getByText('Published. Visitors will see').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-owner-workspace]').inert);};
const inputEquals=async(label,value)=>{const input=page.getByLabel(label,{exact:true});await input.waitFor();await page.waitForFunction(({label,value})=>[...document.querySelectorAll('.oc-field')].find(n=>n.querySelector('span')?.textContent===label)?.querySelector('input')?.value===value,{label,value});};
try {
  const fake=await(await context.request.get(`${base}/__owner-test/session`)).json();
  const current=await(await context.request.post(`${base}/api/wallet`,{data:{action:'site-owner',session:fake.session}})).json();
  if(current.revision)await context.request.post(`${base}/api/wallet`,{data:{action:'site-restore',session:fake.session,revision:current.revision,targetRevision:0}});
  await page.goto(`${base}/__owner-test`);await page.getByRole('button',{name:'Open as the owner',exact:true}).click();
  await page.locator('[data-owner-workspace]').waitFor({state:'visible'});
  const preview=page.frameLocator('[data-owner-preview]');
  const studio=preview.locator('.lp-eco a[href="/studio"]');
  await studio.waitFor();
  await preview.locator('html[data-owner-picking="true"]').waitFor({state:'attached'});
  assert.equal(await studio.evaluate(()=>innerWidth),1440,'Desktop layout independent of the narrow editor panel');
  assert.equal(await studio.locator('small').isVisible(),true,'Desktop description is visible');
  const initialFrame=page.frames().find(f=>f.url().includes('ownerPreview=1'));
  await initialFrame.evaluate(()=>{window.__ownerPreviewIdentity='preserved';});
  for(const target of [studio,studio.locator('.lp-dot'),studio.locator('small'),studio.locator('i')]){
    await target.click();await inputEquals('Entry name','AGI Studio');await inputEquals('Entry description','your own AI influencer');
    assert.equal(await page.getByLabel('Link address',{exact:true}).inputValue(),'/studio');
  }
  await page.getByLabel('Entry name',{exact:true}).fill('Studio preview check');
  await page.getByLabel('Entry description',{exact:true}).fill('This caption can be changed');
  await studio.getByText('This caption can be changed',{exact:true}).waitFor();
  for(const width of [1760,1280,390]){
    await page.setViewportSize({width,height:900});
    assert.equal(await studio.evaluate(()=>innerWidth),1440);
    assert(await studio.locator('small').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No outer horizontal overflow');
  }
  await page.getByRole('button',{name:'Phone',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-owner-preview]').contentWindow.innerWidth===390);
  await studio.getByText('This caption can be changed',{exact:true}).waitFor();
  assert.equal(await initialFrame.evaluate(()=>window.__ownerPreviewIdentity),'preserved','Mode changes preserve the iframe and draft');
  await page.locator('.oc-preview-wrap').screenshot({path:'tools/owner-qa/preview-phone-fixed.png'});
  await page.setViewportSize({width:1600,height:1000});
  await page.getByRole('button',{name:'Desktop',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-owner-preview]').contentWindow.innerWidth===1440);
  await page.getByRole('button',{name:'Actual size',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Actual size',exact:true}).getAttribute('aria-pressed'),'true');
  assert(await page.locator('[data-owner-preview-window]').evaluate(n=>n.scrollWidth>n.clientWidth),'Actual size scrolls inside its own preview');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await studio.locator('small').click();await inputEquals('Entry description','This caption can be changed');
  await page.getByRole('button',{name:'Actual size',exact:true}).click();
  assert.equal(await initialFrame.evaluate(()=>window.__ownerPreviewIdentity),'preserved');
  await page.locator('.oc-editor-grid').screenshot({path:'tools/owner-qa/preview-desktop-fixed.png'});
  await publish();
  const visitor=await context.newPage();await visitor.goto(base);
  await visitor.locator('.lp-eco a[href="/studio"] small').getByText('This caption can be changed',{exact:true}).waitFor();
  assert.match(await visitor.locator('.lp-eco a[href="/studio"]').textContent(),/Studio preview check/);
  await visitor.close();
  await studio.locator('small').click();
  await inputEquals('Entry description','This caption can be changed');
  await page.getByRole('button',{name:'Reset to original',exact:true}).click();
  await inputEquals('Entry name','AGI Studio');await inputEquals('Entry description','your own AI influencer');
  await studio.getByText('your own AI influencer',{exact:true}).waitFor();
  await publish();
  const saved=await(await context.request.get(`${base}/api/wallet?site-content`)).json();
  assert.deepEqual(saved.document.edits,[],'Composite reset removes child field overrides');
  const restored=await context.newPage();await restored.goto(base);
  await restored.locator('.lp-eco a[href="/studio"] small').getByText('your own AI influencer',{exact:true}).waitFor();await restored.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: 1600/1760px preview regression, visible desktop captions, row/name/dot/description/arrow selection, edit and publish reflected publicly, modes and resizing retain draft, phone overflow, complete reset, no page errors.');
} catch(error){
  console.error(error.message);console.log('PAGE ERRORS',errors);
  await page.screenshot({path:'tools/owner-qa/preview-regression-failure.png',fullPage:true}).catch(()=>{});
  throw error;
} finally {await browser.close();}
