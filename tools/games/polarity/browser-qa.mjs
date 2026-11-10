import { chromium } from '../../../../trench-qa-tools/node_modules/playwright-core/index.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('../action-game-qa');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{
 for(const [size,w,h] of [['phone',390,844],['desktop',1280,800],['landscape',844,390],['small',360,640]])for(const id of ['polarity','deepdive','drift']){
  const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:size!=='desktop',isMobile:size!=='desktop'});
  await context.addInitScript(()=>{sessionStorage.setItem('agi_intro','1');localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false,haptics:false}));});
  await context.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(`http://127.0.0.1:5195/games/${id}?qa&seed=7`);await page.clock.runFor(3700);
  await page.screenshot({path:resolve(out,`${id}-${size}-title.png`)});
  const titleBox=await page.locator('.ak-title-body').boundingBox();
  await page.locator('.ak-title .ak-btn-primary').click({force:true});await page.clock.runFor(500);
  assert.equal(await page.evaluate(()=>document.querySelector('#ak-root').dataset.akState),'play');
  if(id==='polarity'){await page.keyboard.press('Space');await page.clock.runFor(500);assert.equal(await page.evaluate(()=>window.__polarity.state.flips),1);}
  if(id==='deepdive'){await page.keyboard.down('ArrowDown');await page.clock.runFor(1800);await page.keyboard.up('ArrowDown');assert.ok(await page.evaluate(()=>window.__deepdive.state.y>200));await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>window.__deepdive.state.sonar>0));}
  if(id==='drift'){await page.clock.runFor(2500);await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await page.clock.runFor(600);await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');assert.ok(await page.evaluate(()=>window.__drift.state.time>0));}
  await page.screenshot({path:resolve(out,`${id}-${size}-play.png`)});
  await page.keyboard.press('p');assert.equal(await page.evaluate(()=>document.querySelector('#ak-root').dataset.akState),'pause');
  const before=await page.evaluate(id=>window['__'+id].state.time,id);await page.clock.runFor(1200);assert.equal(await page.evaluate(id=>window['__'+id].state.time,id),before);await page.keyboard.press('p');assert.equal(await page.evaluate(()=>document.querySelector('#ak-root').dataset.akState),'play');
  await page.goto(`http://127.0.0.1:5195/games/${id}?demo&seed=7`);await page.clock.runFor(8000);await page.screenshot({path:resolve(out,`${id}-${size}-demo.png`)});
  assert.deepEqual(errors,[]);results.push({id,size,errors,titleBox,status:'passed'});console.log(`${id} ${size}: passed`);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));await context.close();
 }
}finally{await browser.close();}
