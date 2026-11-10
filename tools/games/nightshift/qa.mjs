import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true});
const out=process.env.QA_OUT||'output/simulation-games-qa';mkdirSync(out,{recursive:true});
const results=[];
const sizes=[['compact',360,740],['square',480,480],['phone',390,844],['landscape',844,390],['desktop',1280,800]].filter(([name])=>!process.env.QA_SIZES||process.env.QA_SIZES.split(',').includes(name));
try{for(const [size,width,height]of sizes)for(const id of ['nightshift','switchyard','botworks']){
 const context=await browser.newContext({viewport:{width,height},hasTouch:size!=='desktop',isMobile:size!=='desktop'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false,haptics:false}));});
 await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
 await page.goto(`http://127.0.0.1:5195/games/${id}?qa`,{waitUntil:'networkidle'});await page.clock.runFor(3500);
 await page.screenshot({path:`${out}/${id}-${size}-title.png`});
 await page.locator('.ak-title .ak-btn-primary').click({force:true});await page.clock.runFor(500);
 assert.equal(await page.locator('#ak-root').getAttribute('data-ak-state'),'play');
 const clipped=await page.locator('.ak-chip-value').evaluateAll(nodes=>nodes.filter(n=>{const p=n.parentElement.getBoundingClientRect(),r=n.getBoundingClientRect();return r.left<p.left||r.right>p.right;}).length);assert.equal(clipped,0,'HUD values fit their chips');
 if(id==='nightshift'){
   const ingredients=await page.evaluate(async()=>{const l=await import('/src/games/nightshift/logic.js');const s=window.__nightshift.state;return l.RECIPES[s.customers.find(c=>c.id===s.selected).recipe].items.map(id=>l.INGREDIENTS.find(i=>i.id===id).name);});
   for(const name of ingredients)await page.getByRole('button',{name:`Add ${name}`,exact:true}).click({force:true});
   await page.getByRole('button',{name:'Brew',exact:true}).click({force:true});await page.clock.runFor(1400);
   await page.getByRole('button',{name:'STOP!',exact:true}).click({force:true});await page.getByRole('button',{name:'Serve',exact:true}).click({force:true});
   assert.equal(await page.evaluate(()=>window.__nightshift.state.served),1);
 }else if(id==='switchyard'){
   const p=await page.evaluate(()=>{const q=window.__switchyard, s=q.state,n=s.nodes.find(n=>n.id==='A'),f=q.fit;const x=f.wide?n.y+20:n.x,y=f.wide?n.x+10:n.y+20;return{x:f.x+x*f.scale,y:f.y+y*f.scale};});
   await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__switchyard.state.switches.A),1);
   await page.getByRole('button',{name:'● Signals',exact:true}).click({force:true});await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__switchyard.state.signals.A),true);
 }else{
   for(let i=0;i<6;i++)await page.getByRole('button',{name:'Hint',exact:true}).click({force:true});
   await page.getByRole('button',{name:'Start line',exact:true}).click({force:true});await page.clock.runFor(14000);
   assert.equal(await page.evaluate(()=>window.__botworks.state.phase),'won');
   await page.locator('.ak-over-card .ak-btn-primary').click({force:true});await page.clock.runFor(500);
 }
 await page.getByRole('button',{name:'Pause',exact:true}).click({force:true});await page.clock.runFor(500);assert.equal(await page.locator('#ak-root').getAttribute('data-ak-state'),'pause');await page.keyboard.press('Escape');await page.clock.runFor(1500);assert.equal(await page.locator('#ak-root').getAttribute('data-ak-state'),'play');
 await page.screenshot({path:`${out}/${id}-${size}-play.png`});
 await page.goto(`http://127.0.0.1:5195/games/${id}?demo&seed=7`,{waitUntil:'networkidle'});await page.clock.runFor(7000);await page.screenshot({path:`${out}/${id}-${size}-demo.png`});
 assert.deepEqual(errors,[]);results.push({id,size,passed:true});writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${id} ${size} passed`);await context.close();
}}finally{await browser.close();}
