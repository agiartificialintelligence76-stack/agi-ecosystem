import { chromium } from '../../../../trench-qa-tools/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reference } from '../../../src/games/timeloop/rules.js';
import { planShot } from '../../../src/games/orbital/rules.js';
const base='http://127.0.0.1:5195',out=resolve('../../puzzle-new-qa');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--mute-audio']});
const results=[];
try{for(const [size,width,height] of [['phone',390,844],['landscape',844,390],['desktop',1280,800]])for(const game of ['prism','timeloop','orbital']){
  if(process.env.QA_GAME&&process.env.QA_GAME!==game||process.env.QA_SIZE&&process.env.QA_SIZE!==size)continue;
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:size!=='desktop',isMobile:size==='phone'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>{sessionStorage.setItem('agi_intro','1');localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false,haptics:false}));});
  await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
  await page.goto(`${base}/games/${game}?qa`);await page.clock.runFor(4000);
  await page.screenshot({path:resolve(out,`${game}-${size}-title.png`)});
  const bounds=await page.locator('.ak-title-body').boundingBox();
  await page.locator('.ak-title .ak-btn-primary').click({force:true});await page.clock.runFor(300);
  if(game==='prism'){
    const f=await page.evaluate(()=>window.__prism.fit);await page.mouse.click(f.x+(3*60+30)*f.scale,f.y+(3*60+30)*f.scale);await page.clock.runFor(1800);
    if(await page.evaluate(()=>window.__prism.state)!=='over')throw new Error('prism first solution did not win');
  }else if(game==='timeloop'){
    const names={right:'→',left:'←',up:'↑',down:'↓',wait:'Wait',rewind:'↶ Rewind'};
    for(const action of reference(0)){await page.getByRole('button',{name:names[action],exact:true}).click({force:true});await page.clock.runFor(90);}
    await page.clock.runFor(1800);if(await page.evaluate(()=>window.__timeloop.state)!=='over')throw new Error('timeloop actual controls did not solve');
  }else{
    const data=await page.evaluate(()=>({flight:window.__orbital.flight,fit:window.__orbital.fit})),s=planShot(data.flight),f=data.fit;
    const from={x:f.x+270*f.scale,y:f.y+310*f.scale},dist=s.power/2.4;
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x-Math.cos(s.angle)*dist*f.scale,from.y-Math.sin(s.angle)*dist*f.scale,{steps:8});await page.mouse.up();await page.clock.runFor(9000);
    if(await page.evaluate(()=>window.__orbital.state)!=='over'){await page.screenshot({path:resolve(out,`orbital-${size}-failed.png`)});throw new Error('orbital reference drag did not win '+JSON.stringify(await page.evaluate(()=>({flight:__orbital.flight,aim:__orbital.aim,state:__orbital.state}))));}
  }
  await page.screenshot({path:resolve(out,`${game}-${size}-win.png`)});
  await page.goto(`${base}/games/${game}?demo&qa&seed=7`);await page.clock.runFor(9000);await page.screenshot({path:resolve(out,`${game}-${size}-demo.png`)});
  results.push({game,size,errors,titleBounds:bounds,viewport:{width,height},state:await page.locator('#ak-root').getAttribute('data-ak-state')});
  await ctx.close();console.log(`${game} ${size}: ${errors.length} errors`);writeFileSync(resolve(out,'report.json'),JSON.stringify(results,null,2));
}}finally{await browser.close();}
if(results.some(r=>r.errors.length))process.exitCode=1;
