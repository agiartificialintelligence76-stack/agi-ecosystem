// Phone-sized desktop Chromium sample. This is a reproducible rendering proxy;
// the browser cannot reproduce a specific handset GPU, thermals or Safari.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {COLLECTION} from '../../src/games/collection.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5173',ids=process.argv.slice(3);
const targets=ids.length?ids:COLLECTION.map(g=>g.id);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true});
const policy=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url))).headers.find(r=>r.source==='/(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
try{
 const page=await browser.newPage({viewport:{width:360,height:640},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await page.route(/\/api\//,r=>r.fulfill({json:{ok:true,total:0}}));
 if(new URL(base).hostname==='127.0.0.1')await page.route(/\/games\/[^/]+\?demo/,async r=>{const res=await r.fetch();await r.fulfill({response:res,headers:{...res.headers(),'content-security-policy':policy}});});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 for(const id of targets){
  await page.goto(base+'/games/'+id+'?demo&seed=7',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-ak-state="play"] .rm-field canvas');await page.waitForTimeout(1550);
  const sample=await page.evaluate(()=>new Promise(done=>{
   const ms=[];let last;function frame(t){if(last!=null)ms.push(t-last);last=t;
    if(ms.length<100){requestAnimationFrame(frame);return;}
    const values=ms.slice().sort((a,b)=>a-b),q=p=>values[Math.floor((values.length-1)*p)];
    done({p50:q(.5),p95:q(.95),fps:ms.length*1000/ms.reduce((a,b)=>a+b,0)});
   }requestAnimationFrame(frame);
  }));console.log([id,sample.p50.toFixed(1),sample.p95.toFixed(1),sample.fps.toFixed(1)].join('\t'));
 }
}finally{await browser.close();}
