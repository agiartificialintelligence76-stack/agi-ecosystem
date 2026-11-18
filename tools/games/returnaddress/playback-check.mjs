// Observe the browser's real decoded buffer source offsets through a backspin,
 // a pause and a resume. This uses the same controls the player gets.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true});
try{
  const page=await browser.newPage();
  await page.route('**/api/wallet',route=>route.fulfill({json:{ok:true}}));
  await page.addInitScript(()=>{
    window.plays=[];
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(when=0,offset=0,...rest){
      if(this.buffer?.duration>100)window.plays.push({offset,stamp:performance.now()/1000,duration:this.buffer.duration});
      return original.call(this,when,offset,...rest);
    };
  });
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173')+'/games/returnaddress?seed=7');
  await page.locator('.ak-title .ak-btn-play').click();
  await page.waitForFunction(()=>window.plays.length>0);
  await page.waitForTimeout(6500);
  await page.getByRole('button',{name:/Backspin/}).click();
  const [first,rewind]=await page.evaluate(()=>window.plays);
  assert.ok(rewind.offset+1<first.offset+rewind.stamp-first.stamp,'backspin rewinds the audio itself');
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(450);
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  const resumes=await page.evaluate(()=>window.plays);assert.ok(resumes.length>=3);
  assert.ok(Math.abs(resumes.at(-1).offset-rewind.offset)<.5);
  console.log('Actual source length '+first.duration.toFixed(3)+' s; backspin after '+(rewind.stamp-first.stamp).toFixed(3)+' s -> offset '+rewind.offset.toFixed(3)+' s; resumed at '+resumes.at(-1).offset.toFixed(3)+' s.');
}finally{await browser.close();}
