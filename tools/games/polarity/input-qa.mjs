import { chromium } from '../../../../trench-qa-tools/node_modules/playwright-core/index.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.ARCADE_BASE_URL||'http://127.0.0.1:5195';
const out=resolve('../action-game-qa');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report=[];
try{
 for(const id of (process.argv.length>2?process.argv.slice(2):['polarity','deepdive','drift'])){
  const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{sessionStorage.setItem('agi_intro','1');localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false,haptics:false}));});
  await context.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(`${base}/games/${id}?qa&seed=7`);await page.evaluate(()=>document.fonts.ready);await page.clock.runFor(3500);
  await page.getByRole('button',{name:'How to play',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('button',{name:'Got it',exact:true}).click();
  await page.locator('.ak-title .ak-btn-primary').tap({force:true});await page.clock.runFor(500);
  if(id==='polarity'){await page.locator('.po-flip').tap();await page.clock.runFor(300);assert.equal(await page.evaluate(()=>window.__polarity.state.flips),1);}
  if(id==='deepdive'){
    const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:340}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:170,y:390}]});await page.clock.runFor(1800);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await page.evaluate(()=>window.__deepdive.state.y>200));await page.locator('.dd-sonar').tap();assert.ok(await page.evaluate(()=>window.__deepdive.state.sonar>0));
    // Return the actual cargo using normal keyboard inputs and verify the durable upgrade counter.
    await page.keyboard.down('ArrowUp');await page.clock.runFor(1800);await page.keyboard.up('ArrowUp');await page.clock.runFor(300);assert.ok(await page.evaluate(()=>window.__deepdive.state.banked>0));assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('agi_arcade:deepdive')).salvage>0));
  }
  if(id==='drift'){
    await page.clock.runFor(2600);const before=await page.evaluate(()=>window.__drift.state.heading);const cdp=await context.newCDPSession(page);const box=await page.getByRole('button',{name:'Steer right',exact:true}).boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await page.clock.runFor(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await page.evaluate(v=>window.__drift.state.heading>v,before));
  }
  const chips=await page.locator('.ak-chip').evaluateAll(nodes=>nodes.map(node=>{const p=node.getBoundingClientRect();return [...node.children].map(c=>{const r=c.getBoundingClientRect();return {text:c.textContent,inside:r.left>=p.left&&r.right<=p.right};});}).flat());assert.ok(chips.every(c=>c.inside),JSON.stringify(chips));
  await page.screenshot({path:resolve(out,`${id}-small-play-fixed.png`)});
  await page.keyboard.press('p');await page.getByRole('button',{name:'Restart',exact:true}).click();assert.ok(await page.evaluate(id=>window['__'+id].state.time<.05,id));
  await page.keyboard.press('p');await page.getByRole('button',{name:'Quit to menu',exact:true}).click();assert.equal(await page.evaluate(id=>window['__'+id].shell,id),'title');
  if(id==='drift'){await page.setViewportSize({width:844,height:390});await page.clock.runFor(200);await page.screenshot({path:resolve(out,'drift-landscape-title-fixed.png')});const buttons=await page.locator('.ak-modes button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().bottom));assert.ok(buttons.every(y=>y<390));}
  await page.setViewportSize({width:480,height:480});const response=await page.goto(`${base}/games/${id}?demo&qa&seed=7`);console.log(id+' demo HTTP '+response.status());await page.waitForFunction(id=>Boolean(window['__'+id]),id);await page.evaluate(()=>document.fonts.ready);await page.clock.runFor(8000);await page.screenshot({path:resolve(out,`${id}-square-demo.png`)});assert.equal(await page.evaluate(id=>window['__'+id].shell,id),'play');
  assert.deepEqual(errors,[]);report.push({id,touch:true,howTo:true,restart:true,quit:true,smallHud:chips,demo:true,errors});console.log(`${id}: touch, shell, HUD and square demo passed`);await context.close();
 }
 writeFileSync(resolve(out,'input-results.json'),JSON.stringify(report,null,2));
}finally{await browser.close();}


