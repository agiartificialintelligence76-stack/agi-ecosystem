import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalKols,normalizeKols,KOL_FOLLOWS_KEY} from '../src/games/trenchingsimulator/terminal-kols.js';
import {mountLiveKols} from '../src/games/trenchingsimulator/live-kols-panel.js';
import {createPhomoState} from '../src/games/trenchingsimulator/boards/phomo-state.js';
import {createMarket} from '../src/games/trenchingsimulator/engine.js';
import {Element,installDom,byLabel,byClass,socialModuleURL,viewModule} from './helpers/phomo-dom.js';
const {mountPhomoSocial,mountPhomoProfile}=await import(socialModuleURL);
const {mountPhomoClans}=await import(viewModule(new URL('../src/games/trenchingsimulator/boards/phomo-clans.js',import.meta.url)));
const a='5YRgrP3mjGzrzirYYN5HAQH19cTYREYwGxW6XRJQUzij';
const now=1793650000000;
const fixture=()=>({v:1,chain:'solana',status:'live',asOf:now,solUsd:100,traders:[{chain:'solana',address:a,name:'Public Trader',handle:'public_trader',twitterUrl:'https://x.com/public_trader',avatar:`https://cdn.kolscan.io/profiles/${a}.png`,rank:1,pnlSol:12,wins:4,losses:2,
  rankings:{'1d':{rank:1,pnlSol:12,wins:4,losses:2},'7d':{rank:2,pnlSol:-5,wins:10,losses:20}}}]});
const response=data=>({ok:true,json:async()=>data});
function timerBook(){const jobs=new Map();let seq=0;return{jobs,set(fn,ms){const id=++seq;jobs.set(id,{fn,ms});return id;},clear(id){jobs.delete(id);}};}

test('KOL client accepts only bounded verified identities and known source links',()=>{
  const data=fixture();data.traders.push({...data.traders[0]},{address:'invalid',name:'No'}, {...data.traders[0],address:'1'.repeat(32),name:'Other',handle:'javascript:bad',avatar:'https://evil.example/a.png'});
  const value=normalizeKols(data,'solana',now);assert.equal(value.traders.length,2);assert.equal(value.traders[0].simulated,false);
  assert.equal(value.traders[0].activity,null);assert.equal(value.traders[0].positions,null);assert.equal(value.activityStatus,'unavailable');
  assert.equal(value.traders[1].avatar,null);assert.equal(value.traders[1].handle,null);
  assert.equal(value.traders[0].rankings['7d'].pnlSol,-5);
  assert.equal(normalizeKols(data,'base',now).traders.length,0);assert.equal(normalizeKols({...data,status:'unavailable'},'solana',now).status,'unavailable');
  assert.equal(normalizeKols({...data,asOf:now+120000},'solana',now).traders.length,0);
});

test('KOL polling is shared, anonymous, bounded and cleaned up; following never sends an order',async()=>{
  const timers=timerBook(),store=new Map();let resolve,calls=0,signal;
  const client=createTerminalKols({chain:'solana',now:()=>now,timers,storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},fetcher:(url,options)=>{
    calls++;assert.equal(url,'/api/checker?terminal=kols&chain=solana');assert.equal(options.credentials,'omit');signal=options.signal;return new Promise(r=>resolve=r);
  }});
  client.start();client.start();const pending=client.refresh();assert.equal(calls,1);resolve(response(fixture()));await pending;
  assert.equal(client.snapshot().traders.length,1);client.toggleFollow(`kolscan:${a}`);assert.equal(calls,1);assert.equal(client.snapshot().traders[0].followed,true);
  assert.deepEqual(JSON.parse(store.get(KOL_FOLLOWS_KEY)),[`kolscan:${a}`]);assert.equal(timers.jobs.size,1);
  client.destroy();assert.equal(timers.jobs.size,0);assert.equal(signal.aborted,false);
  const disabled=createTerminalKols({chain:'robinhood',fetcher:()=>assert.fail('Clank/Robinhood must not query Solana KOLs')});disabled.start();await disabled.refresh();assert.equal(disabled.snapshot().status,'unsupported');disabled.destroy();
});

test('KOL source failures retain clearly stale data only for the allowed interval',async()=>{
  let time=now,fail=false;const timers=timerBook();const client=createTerminalKols({chain:'solana',now:()=>time,timers,fetcher:async()=>{if(fail)throw new Error('offline');return response(fixture());}});
  await client.refresh();fail=true;time+=90000;await client.refresh();assert.equal(client.snapshot().status,'stale');assert.equal(client.snapshot().traders.length,1);
  time+=600000;await client.refresh();assert.equal(client.snapshot().status,'unavailable');assert.equal(client.snapshot().traders.length,0);client.destroy();
});

test('KOL panels preserve rows while changing periods/search/follows, without implying activity or holdings',async()=>{
  installDom();const data=fixture(),timers=timerBook(),client=createTerminalKols({chain:'solana',now:()=>now,timers,fetcher:async()=>response(data)});await client.refresh();
  const host=new Element('main');document.body.append(host);const view=mountLiveKols(host,{client,chain:'solana',compact:true});
  const row=byClass(host,'ts-kols-row');assert.ok(host.textContent.includes('Kolscan'));assert.ok(host.textContent.includes('+12 SOL'));
  const period=byLabel(host,'KOL ranking period');period.value='7d';period.fire('change');assert.equal(byClass(host,'ts-kols-row'),row);assert.ok(row.textContent.includes('-5 SOL'));
  byLabel(host,'Follow Public Trader').click();assert.equal(client.snapshot().traders[0].followed,true);
  byClass(host,'ts-kols-person').click();assert.ok(host.textContent.includes('Real-time trade activity and holdings are unavailable'));
  const detail=byClass(host,'ts-kols-detail'),close=detail.querySelector('button');close.focus();
  data.traders[0].rankings['7d'].pnlSol=18;await client.refresh();assert.ok(detail.textContent.includes('+18 SOL'));
  assert.equal(detail.querySelector('button'),close);assert.equal(document.activeElement,close);
  period.value='1d';period.fire('change');assert.ok(detail.textContent.includes('24h source P&L'));assert.ok(detail.textContent.includes('+12 SOL'));
  const query=byLabel(host,'Search real KOLs');query.value='no-match';query.fire('input');assert.equal(byClass(host,'ts-kols-row'),undefined);
  view.destroy();client.destroy();assert.equal(host.children.length,0);
});

test('Phomo Live uses only verified public profiles and never converts NPC trades into real KOL activity',async()=>{
  installDom();const timers=timerBook(),client=createTerminalKols({chain:'solana',now:()=>now,timers,fetcher:async()=>response(fixture())});await client.refresh();
  const market=createMarket({seed:'real-kols',live:true});market.smartWallets=()=>assert.fail('Do not read NPC profiles in Live mode');
  const state=createPhomoState(market,{kols:client});const people=state.traders();assert.equal(people.length,1);assert.equal(people[0].kind,'real');assert.equal(people[0].pnlUsd,null);assert.equal(people[0].dailyPnlUsd,1200);
  assert.equal(state.isFollowing(null),false);assert.equal(state.toggleFollow(undefined),false);
  assert.equal(state.feed().some(e=>e.traderKey?.startsWith('kolscan:')),false);
  const host=new Element('main'),ctx={market,chain:'solana',kols:client};const view=mountPhomoSocial(host,ctx,{state,kind:'leaderboard',compact:true});
  assert.ok(host.textContent.includes('Public Trader'));assert.ok(!host.textContent.includes('Smart wallet'));view.destroy();
  const clans=mountPhomoClans(host,ctx,{state});assert.ok(host.textContent.includes('Public clan membership is unavailable'));assert.ok(!host.textContent.includes('Candle Collective'));clans.destroy();
  const profile=mountPhomoProfile(host,ctx,people[0].key,{state});assert.ok(host.textContent.includes('Trade activity and holdings unavailable'));assert.ok(!host.textContent.includes('Fictional history'));
  const identity=byClass(host,'phs-public-identity'),image=identity.querySelector('img'),follow=identity.querySelector('button');follow.focus();
  for(let i=0;i<10;i++)profile.update();assert.equal(identity.querySelector('img'),image);assert.equal(identity.querySelector('button'),follow);assert.equal(document.activeElement,follow);
  profile.destroy();client.destroy();
});
