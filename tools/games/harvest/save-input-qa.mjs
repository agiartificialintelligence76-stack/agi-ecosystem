import {createRequire} from 'node:module';
import {createFarm} from '../../../src/games/harvest/engine.js';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'../../../../trench-qa-tools/node_modules/playwright-core');
const farm=createFarm(19);farm.cash=987;farm.day=14;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1000,height:800},reducedMotion:'reduce'});
 await context.addInitScript(farm=>{sessionStorage.setItem('agi_intro','1');localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false}));if(!localStorage.getItem('agi_arcade:harvest'))localStorage.setItem('agi_arcade:harvest',JSON.stringify({farm}));},farm);
 await context.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 await page.goto((process.env.ARCADE_BASE_URL||'http://127.0.0.1:5195')+'/games/harvest?qa');await page.waitForFunction(()=>Boolean(window.__harvest));
 await page.reload();await page.waitForFunction(()=>Boolean(window.__harvest));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('agi_arcade:harvest')).farm.cash),987);
 await page.evaluate(()=>document.fonts.ready);await page.clock.runFor(3700);await page.locator('.ak-title .ak-btn-primary').click();assert.equal(await page.evaluate(()=>window.__harvest.state.cash),987);
 await page.locator('[data-hf-plot="5"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__harvest.state.plots[5].crop),'sunberry');assert.equal(await page.evaluate(()=>window.__harvest.state.plots[0].crop),'sunberry');
 await page.keyboard.press('p');await page.getByRole('button',{name:'Quit to menu',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Fresh farm A new beginning',exact:true}).count(),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('agi_arcade:harvest')).farm.cash),979);
 assert.deepEqual(errors,[]);console.log('HARVEST: saved title survives reload; Enter tends focused plot; Quit refreshes saved-farm menu. Passed.');
}finally{await browser.close();}
