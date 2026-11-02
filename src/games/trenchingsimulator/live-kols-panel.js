import {el,setText,keyed,flag} from './ui.js';
const signed = v => Number.isFinite(v) ? `${v>=0?'+':''}${v.toLocaleString('en-US',{maximumFractionDigits:2})} SOL` : '—';
export function mountLiveKols(host,{client,chain,compact=false,onTrader}={}) {
  const root=el('section',{class:`ts-kols${compact?' is-compact':''}`,'aria-label':'Real KOLs'});
  const search=el('input',{type:'search',placeholder:'Search KOLs or wallet','aria-label':'Search real KOLs',on:{input:()=>render()}});
  let following=false,detail=null,detailParts=null;
  const ranked=p=>({...p,...(p.rankings?.[period.value]||(period.value==='1d'?{}:{rank:null,pnlSol:null,wins:null,losses:null}))});
  const period=el('select',{'aria-label':'KOL ranking period',on:{change:()=>render()}},[['1d','24H'],['7d','7D'],['30d','30D']].map(([v,label])=>el('option',{value:v},label)));period.value='1d';
  const followOnly=el('button',{type:'button','aria-pressed':'false',on:{click:()=>{following=!following;render();}}},'Following');
  const status=el('p',{class:'ts-kols-status',role:'status'}), list=el('div',{class:'ts-kols-list'});
  const empty=el('p',{class:'ts-kols-empty'});
  const panel=el('div',{class:'ts-kols-detail',hidden:true});
  const source=el('a',{href:'https://kolscan.io/leaderboard',target:'_blank',rel:'noopener noreferrer'},'Kolscan ↗');
  root.append(el('header',{},el('strong',{},'Real KOLs'),source),el('div',{class:'ts-kols-controls'},search,period,followOnly),status,list,empty,panel,
    el('p',{class:'ts-kols-note'},'Public source rankings · Practice trades do not affect KOL statistics.'));
  host.append(root);
  function show(p){
    if(onTrader){onTrader(p.id);return;}
    detail=p.id;panel.hidden=false;
    detailParts={label:el('dt'),profit:el('dd'),record:el('dd')};
    panel.replaceChildren(el('button',{type:'button',on:{click:()=>{panel.hidden=true;detail=null;}}},'Close'),
      el('h3',{},p.name),el('p',{},p.handle?`@${p.handle}`:'Public tracked wallet'),el('code',{},p.address),
      el('dl',{},detailParts.label,detailParts.profit,el('dt',{},'Wins / losses'),detailParts.record),
      el('a',{href:p.url,target:'_blank',rel:'noopener noreferrer'},'View public profile ↗'),
      p.twitter?el('a',{href:p.twitter,target:'_blank',rel:'noopener noreferrer'},'X profile ↗'):null,
      el('p',{},'Real-time trade activity and holdings are unavailable from this source.'));
    refreshDetail(p);
  }
  function refreshDetail(p){
    if(!detailParts)return;
    setText(detailParts.label,`${period.value==='1d'?'24h':period.value} source P&L`);
    setText(detailParts.profit,signed(p.pnlSol));setText(detailParts.record,`${p.wins??'—'} / ${p.losses??'—'}`);
  }
  function render(){
    const s=client?.snapshot()||{status:chain==='solana'?'unavailable':'unsupported',traders:[]};
    const q=search.value.trim().toLowerCase();
    const rows=s.traders.filter(p=>(!following||p.followed)&&(!q||`${p.name} ${p.handle||''} ${p.address}`.toLowerCase().includes(q)))
      .map(ranked)
      .sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.name.localeCompare(b.name)).slice(0,100);
    followOnly.setAttribute('aria-pressed',String(following));flag(followOnly,'is-active',following);
    setText(status,s.status==='unsupported'?`KOL data is not available for ${chain||'this chain'} yet.`:
      s.status==='unavailable'?'KOL source unavailable.':`${s.status==='stale'?'Last available':'Public'} Solana rankings · ${period.value==='1d'?'24h':period.value}${s.asOf?` · ${new Date(s.asOf).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}`);
    setText(empty,s.traders.length?'No matching KOLs.':'Verified profiles will appear when the source is available.');empty.hidden=!!rows.length;
    keyed(list,rows,p=>p.id,p=>{
      const rank=el('span',{class:'ts-kols-rank'}),avatar=el('span',{class:'ts-kols-avatar','aria-hidden':'true'},p.name.slice(0,1).toUpperCase());
      if(p.avatar){const img=el('img',{src:p.avatar,alt:'',loading:'lazy',decoding:'async',referrerpolicy:'no-referrer',on:{error:()=>img.remove()}});avatar.append(img);}
      const name=el('b'),handle=el('small'),profit=el('strong',{class:'ts-kols-profit'});
      const person=el('button',{type:'button',class:'ts-kols-person',on:{click:()=>show(row._profile)}},avatar,el('span',{},name,handle));
      const follow=el('button',{type:'button',class:'ts-kols-follow',on:{click:()=>client?.toggleFollow(row._profile.id)}});
      const row=el('article',{class:'ts-kols-row'},rank,person,profit,follow);row._parts={rank,name,handle,profit,follow};return row;
    },(row,p)=>{row._profile=p;const x=row._parts;setText(x.rank,p.rank??'—');setText(x.name,p.name);setText(x.handle,p.handle?`@${p.handle}`:`${p.address.slice(0,4)}…${p.address.slice(-4)}`);
      setText(x.profit,signed(p.pnlSol));flag(x.profit,'is-down',p.pnlSol<0);setText(x.follow,p.followed?'Following':'Follow');x.follow.setAttribute('aria-pressed',String(p.followed));x.follow.setAttribute('aria-label',`${p.followed?'Unfollow':'Follow'} ${p.name}`);});
    if(detail){const profile=s.traders.find(p=>p.id===detail);if(profile)refreshDetail(ranked(profile));else{panel.hidden=true;detail=null;detailParts=null;}}
  }
  const off=client?.on(render);render();return{update:render,destroy(){off?.();root.remove();}};
}
