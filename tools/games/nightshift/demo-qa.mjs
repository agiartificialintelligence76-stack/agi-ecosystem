import{createRequire}from'node:module';
import assert from'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true});
try{for(const id of ['nightshift','switchyard','botworks'].filter(id=>!process.env.QA_GAMES||process.env.QA_GAMES.split(',').includes(id))){
 const page=await browser.newPage({viewport:{width:480,height:480}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:5195/games/${id}?demo&seed=7&qa`,{waitUntil:'networkidle'});
 await page.waitForTimeout(6500);
 const info=await page.evaluate(id=>{const q=window[`__${id}`],c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let nonzero=0;for(let i=3;i<d.length;i+=4)if(d[i])nonzero++;return{shell:q.shell,state:q.state.phase,age:q.state.age,fit:q.fit,canvas:[c.width,c.height],nonzero};},id);
 console.log(id,info,errors);assert.ok(info.nonzero>10000);assert.deepEqual(errors,[]);
 await page.screenshot({path:`${process.env.QA_OUT}/${id}-square-live-demo.png`});await page.close();
}}finally{await browser.close();}
