import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEMES, mergeMemes, fileOf, thumbOf, downloadName, downloadUrl } from '../src/memes/list.js';
import { MEDIA_ORIGIN, MEDIA_BUCKET, MEDIA_PUBLIC_ROOT } from '../src/owner/media-model.js';

const moduleUrl = new URL('../src/owner/media.js', import.meta.url);
const source = readFileSync(moduleUrl, 'utf8').replace(/^import '[^']+\.css';$/gm, '')
  .replace(/from '(\.[^']+)'/g, (_, p) => `from '${new URL(p, moduleUrl).href}'`);
const { mediaFileInfo, uploadConfirmed } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const UUID = 'a1111111-2222-4333-8444-555555555555';
const OTHER = 'b1111111-2222-4333-8444-555555555555';
const image = (id = UUID) => ({ id: `upload-${id}`, custom: true, kind: 'image', title: 'New image', note: '', src: `${MEDIA_PUBLIC_ROOT}${id}.png`, thumb: '', secs: 0, hidden: false, proof: 'payload.signature' });
const video = () => ({ ...image(), kind: 'video', src: `${MEDIA_PUBLIC_ROOT}${UUID}.mp4`, secs: 42 });

test('gallery merges uploaded items first, keeps originals unchanged and respects built-in tombstones', () => {
  const original = structuredClone(MEMES);
  const hiddenId = MEMES[0].id, changedId = MEMES.find(m=>m.kind==='image').id;
  const merged = mergeMemes([image(), {id:hiddenId,custom:false,hidden:true}, {id:changedId,title:'Edited title',note:'Edited caption'}]);
  assert.equal(merged[0].id, `upload-${UUID}`);assert.equal(merged.some(m=>m.id===hiddenId),false);assert.equal(merged.find(m=>m.id===changedId).title,'Edited title');
  assert.deepEqual(MEMES,original);assert.equal(mergeMemes([]).some(m=>m.id===hiddenId),true);
  const hidden = mergeMemes([{id:changedId,title:'Saved title',hidden:true}],{includeHidden:true}).find(m=>m.id===changedId);assert.equal(hidden.title,'Saved title');assert.equal(hidden.hidden,true);
});

test('gallery ignores foreign URLs, invalid media families and duplicate uploads', () => {
  const builtin=MEMES.find(m=>m.kind==='image');
  const merged=mergeMemes([{...image(),src:'https://evil.test/file.png'},{...video(),id:`upload-${OTHER}`,src:`${MEDIA_PUBLIC_ROOT}${OTHER}.png`},{id:builtin.id,kind:'video'},image(),image()]);
  assert.equal(merged.filter(m=>m.id===`upload-${UUID}`).length,1);assert.equal(merged.some(m=>m.id===`upload-${OTHER}`),false);assert.equal(merged.find(m=>m.id===builtin.id).kind,'image');
  assert.equal(fileOf({...image(),src:'javascript:alert(1)'}),'');assert.equal(thumbOf({...video(),thumb:'https://evil.test/x.png'}),'');
});

test('existing videos can move to Slopcore without changing their files; downloads have safe names', () => {
  const builtin=MEMES.find(m=>m.kind==='video');const changed=mergeMemes([{id:builtin.id,kind:'slopcore'}]).find(m=>m.id===builtin.id);
  assert.equal(fileOf(changed),fileOf(builtin));assert.equal(thumbOf(changed),thumbOf(builtin));
  const uploaded={...video(),title:'Hello / world! <script>'};assert.equal(downloadName(uploaded),'agi-hello-world-script.mp4');assert.equal(downloadUrl(uploaded),`${uploaded.src}?download=agi-hello-world-script.mp4`);
  assert.equal(thumbOf(image()),fileOf(image()));
});

test('upload limits match the configured bucket and reject empty or unsupported files before any request', () => {
  assert.equal(mediaFileInfo({name:'x.png',type:'image/png',size:20_000_000}).family,'image');
  assert.equal(mediaFileInfo({name:'x.mp4',type:'video/mp4',size:50_000_000}).family,'video');
  assert.equal(mediaFileInfo({name:'x.gif',type:'',size:100}).mime,'image/gif');
  assert.throws(()=>mediaFileInfo({name:'x.png',type:'image/png',size:20_000_001}),/20 MB/);
  assert.throws(()=>mediaFileInfo({name:'x.mp4',type:'video/mp4',size:50_000_001}),/50 MB/);
  assert.throws(()=>mediaFileInfo({name:'x.svg',type:'image/svg+xml',size:100}),/PNG/);
  assert.throws(()=>mediaFileInfo({name:'x.png',type:['image/png'],size:100}),/PNG/);
  assert.throws(()=>mediaFileInfo({name:'x.png',type:'__proto__',size:100}),/PNG/);
  assert.throws(()=>mediaFileInfo({name:'x.png',type:'image/png',size:0}),/nonempty/);
});

function uploadHarness({status=200,media=image(),target=null,finishError=null,neverSend=false}={}) {
  const actions=[],progress=[],xhrCalls=[];
  const api=async(action,payload)=>{
    actions.push({action,payload});
    if(action==='site-media-start')return {ok:true,id:`upload-${UUID}`,ticket:'ticket.signature',uploadUrl:target||`${MEDIA_ORIGIN}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${UUID}.png?token=signed`};
    if(finishError)throw new Error(finishError);
    return {ok:true,media};
  };
  const xhrFactory=()=>({upload:{},status,open(...args){xhrCalls.push(['open',...args]);},setRequestHeader(...args){xhrCalls.push(['header',...args]);},send(file){xhrCalls.push(['send',file]);if(neverSend)return;this.upload.onprogress({loaded:file.size,total:file.size,lengthComputable:true});queueMicrotask(()=>this.onload());},abort(){this.onabort?.();}});
  return {api,xhrFactory,actions,progress,xhrCalls,onProgress:(...args)=>progress.push(args)};
}
const file={name:'image.png',type:'image/png',size:123};

test('a successful upload returns a record only after PUT and server verification, preserving its proof', async()=>{
  const h=uploadHarness();const result=await uploadConfirmed(file,h);
  assert.equal(result.proof,'payload.signature');assert.deepEqual(h.actions.map(a=>a.action),['site-media-start','site-media-finish']);
  assert.deepEqual(h.actions[0].payload,{name:'image.png',mime:'image/png',bytes:123});assert.deepEqual(h.actions[1].payload,{ticket:'ticket.signature'});
  assert.ok(h.xhrCalls.some(a=>a[0]==='header'&&a[1]==='Content-Type'&&a[2]==='image/png'));assert.ok(h.xhrCalls.some(a=>a[0]==='header'&&a[1]==='x-upsert'&&a[2]==='false'));
  assert.equal(h.progress.at(-1)[0],123);
});

test('failed uploads never proceed to finish and never produce a draft entry', async()=>{
  const refused=uploadHarness({status:403});await assert.rejects(uploadConfirmed(file,refused),/refused/);assert.equal(refused.actions.length,1);
  const foreign=uploadHarness({target:'https://evil.test/upload'});await assert.rejects(uploadConfirmed(file,foreign),/safe upload/);assert.equal(foreign.xhrCalls.length,0);
  const unverified=uploadHarness({media:{...image(),proof:''}});await assert.rejects(uploadConfirmed(file,unverified),/verified/);
  const unavailable=uploadHarness({finishError:'Storage could not verify'});await assert.rejects(uploadConfirmed(file,unavailable),/could not verify/);
});

test('abort prevents uploading or verifying after the editor is closed', async()=>{
  const before=new AbortController();before.abort();const h=uploadHarness();await assert.rejects(uploadConfirmed(file,{...h,signal:before.signal}),/cancelled/);assert.equal(h.actions.length,0);
  const during=new AbortController();const pending=uploadHarness({neverSend:true});const promise=uploadConfirmed(file,{...pending,signal:during.signal});await Promise.resolve();during.abort();await assert.rejects(promise,/cancelled/);assert.equal(pending.actions.length,1);
});
