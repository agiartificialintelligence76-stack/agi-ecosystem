import {chromium} from '../../../../trench-qa-tools/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {LEVELS} from '../../../src/games/prism/rules.js';
const out=resolve('../../puzzle-new-qa'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--mute-audio']});
const result=[];
try{for(const game of ['prism','timeloop','orbital']){
 const ctx=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await ctx.addInitScript(()=>{sessionStorage.setItem('agi_intro','1');localStorage.setItem('agi_arcade:settings',JSON.stringify({sound:false,music:false,haptics:false}));});
 await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
 await page.goto(`http://127.0.0.1:5195/games/${game}?qa`);await page.clock.runFor(4000);await page.locator('.ak-title .ak-btn-primary').click({force:true});await page.clock.runFor(300);
 const hook=()=>page.evaluate(g=>window['__'+g].state,game);
 await page.getByRole('button',{name:'Pause',exact:true}).click({force:true});if(await hook()!=='pause')throw Error('pause failed '+game);await page.getByRole('button',{name:'Resume',exact:true}).click({force:true});
 if(await hook()!=='play')throw Error('resume failed '+game);
 const menu={prism:'Labs',timeloop:'Rooms',orbital:'Sectors'}[game];await page.getByRole('button',{name:menu,exact:true}).click({force:true});await page.keyboard.press('Escape');await page.getByRole('button',{name:'Resume',exact:true}).click({force:true});
 await page.getByRole('button',{name:'Pause',exact:true}).click({force:true});await page.getByRole('button',{name:'Restart',exact:true}).click({force:true});if(await hook()!=='play')throw Error('restart failed '+game);
 await page.screenshot({path:resolve(out,`${game}-360-play.png`)});
 await page.getByRole('button',{name:'Pause',exact:true}).click({force:true});await page.getByRole('button',{name:'Quit to menu',exact:true}).click({force:true});if(await hook()!=='title')throw Error('quit failed '+game);
 if(game==='prism'){
  await page.evaluate(()=>localStorage.setItem('agi_arcade:prism',JSON.stringify({levels:Object.fromEntries(Array.from({length:12},(_,i)=>[i,3]))})));
  await page.reload();await page.clock.runFor(4000);await page.locator('.ak-title .ak-btn-primary').click({force:true});await page.clock.runFor(300);
  let info=await page.evaluate(()=>({board:__prism.board,fit:__prism.fit}));if(info.board.index!==12)throw Error('saved progress did not resume lab13');
  let m=info.board.optics.find(t=>t.movable),s=LEVELS[12].solution.find(t=>t.id===m.id);const f=info.fit,at=t=>({x:f.x+(t.x*60+30)*f.scale,y:f.y+(t.y*60+30)*f.scale});
  let a=at(m),b=at(s);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();
  for(const target of LEVELS[12].solution){let current=(await page.evaluate(()=>__prism.board.optics)).find(t=>t.id===target.id);for(let n=0;current.rot!==target.rot&&n<3;n++){const p=at(current);await page.mouse.click(p.x,p.y);current=(await page.evaluate(()=>__prism.board.optics)).find(t=>t.id===target.id);}}
  await page.clock.runFor(1800);if(await hook()!=='over')throw Error('lab13 drag/color mix solution failed');
 }
 await page.setViewportSize({width:480,height:480});await page.goto(`http://127.0.0.1:5195/games/${game}?demo&qa&seed=7`);await page.clock.runFor(5700);await page.screenshot({path:resolve(out,`${game}-square-5700.png`)});await page.clock.runFor(6000);await page.screenshot({path:resolve(out,`${game}-square-11700.png`)});if(await hook()!=='play')throw Error('demo ends in menu');
 await page.clock.runFor(60000);if(await hook()!=='play')throw Error('long demo ends in menu');result.push({game,errors,pause:true,restart:true,quit:true,demoLoop:true});await ctx.close();console.log(game+' extended QA passed');
}}finally{await browser.close();}
writeFileSync(resolve(out,'extended-report.json'),JSON.stringify(result,null,2));if(result.some(r=>r.errors.length))process.exitCode=1;
