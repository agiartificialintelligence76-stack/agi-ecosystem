// Public identities and source rankings. These never feed the practice market's actors or prices.
export const KOL_FOLLOWS_KEY = 'trench_real_kols_v1';
const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const clean = (v, max = 80) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0,max) : '';
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function normalizeKols(data, chain, now = Date.now()) {
  const supported = chain === 'solana';
  const asOf = finite(data?.asOf) && data.asOf > 0 && data.asOf <= now + 60000 ? data.asOf : null;
  const valid = supported && data?.v === 1 && data.chain === chain && asOf !== null && ['live','stale'].includes(data.status);
  const seen = new Set();
  const traders = valid && Array.isArray(data.traders) ? data.traders.slice(0,600).flatMap(p => {
    if (!p || p.chain!=='solana' || !address.test(p.address) || seen.has(p.address) || !clean(p.name)) return [];
    seen.add(p.address);
    const wins = Number.isSafeInteger(p.wins) && p.wins >= 0 ? p.wins : null;
    const losses = Number.isSafeInteger(p.losses) && p.losses >= 0 ? p.losses : null;
    const handle = /^[A-Za-z0-9_]{1,15}$/.test(p.handle || '') && p.twitterUrl===`https://x.com/${p.handle}` ? p.handle : null;
    const rankings={};
    for(const period of ['1d','7d','30d']){const r=p.rankings?.[period];if(r&&Number.isSafeInteger(r.rank)&&r.rank>0&&finite(r.pnlSol))rankings[period]={rank:r.rank,pnlSol:r.pnlSol,wins:Number.isSafeInteger(r.wins)&&r.wins>=0?r.wins:null,losses:Number.isSafeInteger(r.losses)&&r.losses>=0?r.losses:null};}
    return [{ id:`kolscan:${p.address}`, key:`kolscan:${p.address}`, chain, address:p.address,rankings,
      name:clean(p.name), handle, avatar:p.avatar === `https://cdn.kolscan.io/profiles/${p.address}.png` ? p.avatar : null, url:`https://kolscan.io/account/${p.address}`,
      twitter:handle ? `https://x.com/${handle}` : null, rank:Number.isSafeInteger(p.rank) && p.rank > 0 ? p.rank : null,
      pnlSol:finite(p.pnlSol) ? p.pnlSol : null, wins, losses,
      winRate:wins !== null && losses !== null && wins + losses > 0 ? wins / (wins + losses) : null,
      volumeSol:null, positions:null, activity:null, source:'Kolscan', simulated:false }];
  }) : [];
  return { v:1, chain, source:{name:'Kolscan',url:'https://kolscan.io/leaderboard'}, period:'1d',
    status:!supported ? 'unsupported' : !valid ? 'unavailable' : data.status === 'stale' || now - asOf > 180000 ? 'stale' : 'live',
    asOf, solUsd:valid && finite(data.solUsd) && data.solUsd > 0 ? data.solUsd : null,
    activityStatus:'unavailable', activity:[], traders };
}

export function createTerminalKols({chain, storage = null, fetcher = (...args) => fetch(...args), now = Date.now,
  timers = {set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)} } = {}) {
  let value = normalizeKols(null,chain,now()), started = false, dead = false, timer = null, pending = null, controller = null, revision=0;
  let followed = [];
  try { const saved=JSON.parse(storage?.getItem(KOL_FOLLOWS_KEY)||'[]');
    followed=Array.isArray(saved)?saved.filter(v=>typeof v==='string'&&v.startsWith('kolscan:')&&address.test(v.slice(8))).slice(-100):[];
  } catch { /* optional local preferences */ }
  const listeners = new Set();
  const emit = () => { revision++;for (const fn of listeners) fn(); };
  const expire=()=>{if(value.asOf&&now()-value.asOf>600000){value=normalizeKols(null,chain,now());revision++;}};
  const schedule = () => { if(!dead&&started&&chain==='solana'&&timer===null)timer=timers.set(()=>{timer=null;refresh();},60000); };
  async function refresh() {
    if(dead||chain!=='solana')return;
    if(pending)return pending;
    controller=new AbortController(); const timeout=timers.set(()=>controller?.abort(),10000);
    pending=(async()=>{
      try {
        const response=await fetcher('/api/checker?terminal=kols&chain=solana',{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('unavailable');
        const data=await response.json(); if(dead)return;
        const next=normalizeKols(data,chain,now());
        if(next.status==='unavailable')throw new Error('invalid');
        value=next;
      } catch {
        if(dead)return;
        value=value.traders.length&&now()-value.asOf<=600000 ? {...value,status:'stale'} : normalizeKols(null,chain,now());
      } finally {
        timers.clear(timeout);pending=null;controller=null;
        if(!dead){emit();schedule();}
      }
    })(); return pending;
  }
  return {
    get revision(){expire();return revision;},
    get status(){expire();return value.status==='live'&&now()-value.asOf>180000?'stale':value.status;},
    start(){if(dead||started)return;started=true;refresh();}, refresh,
    snapshot(){expire();
      const status=value.status==='live'&&now()-value.asOf>180000?'stale':value.status;
      return {...value,status,traders:value.traders.map(p=>({...p,followed:followed.includes(p.id)})),activity:[]};},
    on(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    toggleFollow(id){if(dead||!value.traders.some(p=>p.id===id))return false;
      if(followed.includes(id))followed=followed.filter(x=>x!==id);else followed=[...followed,id].slice(-100);
      try{storage?.setItem(KOL_FOLLOWS_KEY,JSON.stringify(followed));}catch{/* optional */}emit();return followed.includes(id);},
    isFollowing:id=>followed.includes(id),
    destroy(){dead=true;started=false;timers.clear(timer);controller?.abort();listeners.clear();},
  };
}
