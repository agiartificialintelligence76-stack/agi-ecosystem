// Record genuine title, gameplay and result states on the built arcade.
import { createRequire } from 'node:module';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chamber } from '../../src/games/prismcourier/rehearsal.js';
import { layout as oceanLayout,project } from '../../src/games/pearlshift/layout.js';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base,out,phase,...ids]=process.argv.slice(2);
const csp=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url))).headers.find(r=>r.source==='/(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
const local=new URL(base).hostname==='127.0.0.1';
const shapes={phone:[360,640],desktop:[1440,900],sideways:[740,360],foldable:[884,1104],large:[2560,1440]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
mkdirSync(out,{recursive:true});
async function check(id,label) {
  const [width,height]=shapes[label];
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:label!=='desktop'&&label!=='large', deviceScaleFactor:1});
  const page=await ctx.newPage(), errors=[],audio=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/heartbeat\/audio|\.mp3/.test(r.url()))audio.push([new URL(r.url()).pathname,r.status()]);});
  await page.addInitScript(()=>{window.cspProblems=[];document.addEventListener('securitypolicyviolation',e=>window.cspProblems.push([e.violatedDirective,e.blockedURI]));});
  if(local && !phase.includes('dev')) await page.route(/\/games\/[^/]+\?seed=/,async route=>{
    const res=await route.fetch();await route.fulfill({response:res,headers:{...res.headers(),'content-security-policy':csp}});
  });
  // Local static preview lacks the site's play-count endpoint. Never count a QA run.
  await page.route(/\/api\/(?:games|wallet)(?:\?|\/|$)/,r=>r.fulfill({json:{ok:true,total:0}}));
  try {
    await page.goto(base+'/games/'+id+'?seed=7',{waitUntil:'domcontentloaded',timeout:60000});
    const root=page.locator('.remastered');
    await root.waitFor(); await page.locator('#agi-intro').waitFor({state:'detached',timeout:12500}).catch(()=>{});
    const shot=state=>page.screenshot({path:join(out,id+'-'+label+'-'+state+'.jpg'),type:'jpeg',quality:85});
    const full=['phone','desktop'].includes(label);
    if(phase==='full'&&id==='echoforge'){await page.locator('select[name=mode]').selectOption('rehearse');const song=page.locator('select').filter({has:page.locator('option[value="agi"]')});if(await song.count())await song.first().selectOption('agi');}
    if(phase==='full'&&id==='prismcourier')await page.locator('select[name=room]').selectOption('6');
    if(id==='driftglass'&&full)await page.locator('select[name=mode]').selectOption('check');
    if(full)await shot('title');
    await page.locator('.ak-title .ak-btn-play').click();
    await page.waitForSelector('[data-ak-state="play"] .rm-field canvas');
    const first=page.locator('.rm-pad:not([disabled])').first();
    const openingPuzzles = new Set(['switchyard','waxworks','starlingrelay','prismcourier','rookery']);
    if(id==='cloudfoil'){await page.keyboard.down('Space');await delay(600);await page.keyboard.up('Space');}
    else if(id==='inkveil'){await page.keyboard.press('Space');}
    else if(id==='driftglass'){await delay(3180);await page.keyboard.press('Space');}
    else if(id==='moonfreight'||id==='tetherturn'){await page.keyboard.press('Space');}
    else if(!openingPuzzles.has(id)){await first.click();await page.keyboard.press(id==='returnaddress'?'ArrowUp':'ArrowRight');}
    else if(id==='prismcourier')await page.keyboard.press('KeyH');
    const until=phase.startsWith('layout')?250:phase.includes('dev')?1600:({cloudfoil:480,moonfreight:420,tetherturn:770,inkveil:850}[id]??7500);
    await delay(until);
    const size=await page.evaluate(()=>{
      const box=n=>{const r=n.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];};
      return {canvas:box(document.querySelector('canvas')),controls:[...document.querySelectorAll('.rm-pad,.rm-fader input')].filter(n=>n.checkVisibility()).map(n=>[n.textContent.trim() || n.name,...box(n)]),state:document.querySelector('.ak').dataset.akState,overflow:document.body.scrollWidth>innerWidth};
    });
    for(const [name,x,y,w,h] of size.controls)if(w<44||h<44||x<0||y<0||x+w>width+1||y+h>height+1)failures.push('control outside accessible size: '+name+' '+[x,y,w,h].join(','));
    if(size.overflow)failures.push('horizontal overflow');
    if(size.canvas[2]<width*.53 || size.canvas[3]<height*.39)failures.push('undersized canvas '+size.canvas);
    if(full)await shot('run');
    if(phase==='full'&&full){
      if(id==='cloudfoil')await page.locator('[data-action="file"]').waitFor();
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      await page.getByRole('button',{name:'Resume',exact:true}).click();
      if(id==='returnaddress'){await page.locator('[data-action="backspin"]').click();await page.locator('[data-action="jump"]').click();}
      if(id==='summitline') { await page.keyboard.press('Digit1');await page.keyboard.press('Digit2'); }
      if(id==='pearlshift'){
        const box=await page.locator('.rm-field canvas').boundingBox();
        const {chart}=oceanLayout(box.width,box.height);
        const tap=async(x,y)=>{const [cx,cy]=project(chart,x,y);await page.mouse.click(box.x+cx,box.y+cy);};
        await tap(.75,.75);await page.keyboard.press('KeyE');
        await tap(.69,.42);await page.keyboard.press('Space');
      }
      if(id==='pearlshift'||id==='summitline')await page.keyboard.press('KeyX');
      if(id==='tidepool') {
        for(let i=0;i<44 && await page.locator('[data-ak-state="play"]').count();i++){
          await page.keyboard.press('Space');await page.waitForTimeout(1800);
        }
      }
      const puzzleInputs={
        cloudfoil:['KeyF'],inkveil:['KeyT','Enter','ArrowRight','ArrowRight','ArrowDown','ArrowRight','ArrowDown','KeyF'],
        moonfreight:['KeyX'],tetherturn:['KeyX'],
        prismcourier:[...[...chamber(6).witness].map(k=>['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Space','KeyX'][Number(k)]),'KeyB'],switchyard:['ArrowRight','Space','ArrowRight','KeyX'],
        starlingrelay:['KeyB','KeyG','KeyF'],waxworks:['ArrowRight','ArrowRight','KeyF'],rookery:['ArrowRight'],
      };
      for(const key of puzzleInputs[id]||[]){
        if(['moonfreight','tetherturn'].includes(id)&&key==='KeyX')await page.locator('[data-action="file"]').waitFor({timeout:15000});
        if(id==='starlingrelay'&&key==='KeyF')await page.locator('[data-action="file"]').waitFor();
        await page.keyboard.press(key);await delay(key==='KeyG'?2200:650);
      }
      await page.waitForSelector('[data-ak-state="over"]',{timeout:330000});
      await delay(700);await shot('end');
      assert.ok(await page.locator('.ak-stats').innerText());
      await page.getByRole('button',{name:'Replay this run'}).click();
      await page.waitForSelector('[data-ak-state="play"]');
    }
    const cspErrors=await page.evaluate(()=>window.cspProblems);
    const result={id,label,phase,size,audio,errors,cspErrors,failures};
    writeFileSync(join(out,id+'-'+label+'.json'),JSON.stringify(result,null,2));
    console.log(id,label,JSON.stringify({canvas:size.canvas,errors,cspErrors,failures,audio:audio.length}));
    assert.deepEqual([...errors,...cspErrors,...failures],[]);
  } finally {await ctx.close();}
}
try {
  for(const label of (phase.startsWith('layout')?['sideways','foldable','large']:['phone','desktop'])){
    const settled=await Promise.allSettled(ids.map(id=>check(id,label)));
    for(const v of settled)if(v.status==='rejected'){console.error(v.reason);process.exitCode=1;}
  }
}finally{await browser.close();}
