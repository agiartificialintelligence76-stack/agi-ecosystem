// Exercise real focus, key and pointer capture in Chromium. Run against a local
// Vite preview of the source so the same dock module can host a changing fixture.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined,headless:true});
try {
  const context=await browser.newContext({hasTouch:true,viewport:{width:800,height:680}});
  await context.routeWebSocket('**/*',()=>{});
  await context.route('**/api/**',route=>route.fulfill({status:200,json:{}}));
  const tab=await context.newPage();
  await tab.goto(base+'/games/echoforge?seed=7');
  await tab.locator('#agi-intro').waitFor({state:'hidden'});
  assert.equal(await tab.locator('.rm-field canvas').isVisible(),false);
  await tab.locator('.ak-btn-play').click();
  await tab.evaluate(async()=>{
    const {createDock}=await import('/src/games/kit/remaster-controls.js');
    const data={events:[],list:[{id:'a',label:'First'},{id:'b',label:'Second'},{id:'slider',type:'range',label:'Gain',min:0,max:10,value:3}]};
    const dock=createDock((id,type,value)=>data.events.push([id,type,value]));
    const wrap=document.createElement('aside');wrap.style.position='fixed';wrap.style.top='0';wrap.style.left='0';wrap.style.zIndex='99999';
    wrap.style.background='white';wrap.append(dock.node);document.body.append(wrap);
    data.render=()=>dock.render(data.list);data.render();data.node=dock.node;
    window.dockFixture=data;
  });
  const first=tab.locator('aside [data-action=a]'),second=tab.locator('aside [data-action=b]');
  await first.focus();await tab.keyboard.down('Space');
  await tab.evaluate(()=>{const d=window.dockFixture;d.first=d.node.querySelector('[data-action=a]');d.list[0].label='First held';d.list[1].pressed=true;d.list[2].value=4;d.render();});
  assert.equal(await tab.evaluate(()=>{const d=window.dockFixture;return d.first===document.activeElement&&d.first.classList.contains('is-held')&&d.node.querySelector('input').value==='4';}),true);
  await tab.keyboard.press('ArrowLeft');
  assert.deepEqual(await tab.evaluate(()=>window.dockFixture.events.map(x=>x.slice(0,2))),[['a','down']]);
  await tab.keyboard.up('Space');
  await second.focus();
  await tab.evaluate(()=>{const d=window.dockFixture;d.list.reverse();d.render();});
  assert.equal(await second.evaluate(el=>el===document.activeElement),true);
  await tab.evaluate(()=>{const d=window.dockFixture;d.list=d.list.filter(x=>x.id!=='b');d.render();});
  assert.ok(await tab.evaluate(()=>window.dockFixture.node.contains(document.activeElement)));
  const slider=tab.locator('aside input');await slider.focus();await tab.keyboard.press('ArrowRight');
  assert.ok(await tab.evaluate(()=>window.dockFixture.events.some(([id,phase,value])=>id==='slider'&&phase==='input'&&value===5)));
  await tab.evaluate(()=>{const d=window.dockFixture;d.list=[{id:'a',label:'First'},{id:'b',label:'Second'}];d.render();d.events=[];});
  const a=await first.boundingBox(),b=await second.boundingBox(),finger=(box,id)=>({x:box.x+box.width/2,y:box.y+box.height/2,id});
  const cdp=await context.newCDPSession(tab);
  const points=[finger(a,1),finger(b,2)];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await tab.evaluate(()=>{const d=window.dockFixture;d.list[1].label='Second held';d.list[0].pressed=true;d.render();});
  assert.equal(await tab.locator('aside .is-held').count(),2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await tab.locator('aside .is-held').count(),0);
  const edges=await tab.evaluate(()=>window.dockFixture.events.map(e=>e.slice(0,2).join('/')).sort());
  assert.deepEqual(edges,['a/down','a/up','b/down','b/up']);
  await first.focus();await tab.keyboard.down('Enter');
  await tab.evaluate(()=>{const d=window.dockFixture;d.list[0].disabled=true;d.render();});
  await tab.keyboard.up('Enter');assert.equal(await second.evaluate(el=>el===document.activeElement),true);
  console.log('Passing: title tab order, held keyboard, unchanged DOM nodes, independent keys, reordering, focused removal, live slider, two-finger capture, disabled action release.');
  await context.close();

  // Drive the actual page factory and shared shell with an observable model.
  // Old asynchronous model callbacks must not affect the replacement run.
  const lifecycle=await browser.newContext({viewport:{width:900,height:700}});
  await lifecycle.routeWebSocket('**/*',()=>{});
  await lifecycle.route('**/api/**',r=>r.fulfill({status:200,json:{}}));
  await lifecycle.addInitScript(()=>{sessionStorage.setItem('agi_intro','1');});
  const fixture=`
    const controls=[{id:'hold',label:'Hold'}];
    window.runs=[];
    export default {
      modes:[{id:'setlist',label:'Setlist'}], controls,tagline:'Timing fixture',
      instructions:[['Hold','Hold the pad or canvas.']],keys:[['H','Hold']],touch:[['Tap','Hold']],
      create(api) {
        const events=[];
        const add=(...args)=>events.push(args);
        const run={api,events,update(){},draw(){},demo(){},
          action:(id,phase)=>add('action',id,phase),pointer:phase=>add('pointer',phase),
          key:(phase,key)=>add('key',key,phase),pause:()=>add('pause'),dispose:()=>add('dispose')};
        api.hud('Points',window.runs.length+1,'Test',2);window.runs.push(run);return run;
      }
    };
  `;
  await lifecycle.route(/\/src\/games\/echoforge\/game\.js(\?.*)?$/,r=>r.fulfill({contentType:'application/javascript',body:fixture}));
  const play=await lifecycle.newPage();
  await play.goto(base+'/games/echoforge?seed=7');
  await play.locator('.ak-btn-play').click();
  const pad=play.locator('[data-action=hold]');
  const bounds=await pad.boundingBox();
  await play.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await play.mouse.down();await play.keyboard.press('Escape');await play.mouse.up();
  let events=await play.evaluate(()=>window.runs[0].events);
  assert.deepEqual(events.slice(-3),[['action','hold','down'],['action','hold','up'],['pause']]);
  await play.getByRole('button',{name:'Restart',exact:true}).click();
  await play.evaluate(()=>{
    const old=window.runs[0].api;
    old.hud('Old',101);old.controls([{id:'old',label:'Old'}]);old.say('old run');old.end(200,[],'old');
  });
  assert.equal(await play.locator('main').getAttribute('data-ak-state'),'play');
  assert.equal(await pad.count(),1);
  assert.deepEqual(await play.locator('.ak-chip-value').allTextContents(),['2','2']);
  assert.equal(await play.locator('.rm-voice').textContent(),'');
  const field=play.locator('.rm-field canvas'),box=await field.boundingBox();
  await play.mouse.move(box.x+box.width/2,box.y+box.height/2);await play.mouse.down();
  await play.keyboard.press('Escape');await play.mouse.up();
  events=await play.evaluate(()=>window.runs[1].events.filter(e=>e[0]==='pointer'&&e[1]!=='move'));
  assert.deepEqual(events,[['pointer','down'],['pointer','cancel']]);
  await play.goto(base+'/games/echoforge?demo&seed=7');
  await play.waitForFunction(()=>window.runs?.length===1);
  await play.locator('.rm-field canvas').click();await play.keyboard.press('h');
  assert.deepEqual(await play.evaluate(()=>window.runs[0].events),[]);
  console.log('Passing: paused action and canvas cancellation, replay ownership of HUD, controls, status and end card, demo input isolation.');
} finally {await browser.close();}
