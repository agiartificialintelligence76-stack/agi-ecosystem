// Each dispatch is an outward and homeward manifest. The return half has its own
// wind, colors and parcel order, so a saved layover resumes a different flight.
export const districts = [
  { name:'Poppy Orchard', sky:['#65c5d2','#fce9b4','#4c8180'], hull:'#df664c', mark:'apple', routes:['Apricot Morning','Cider Special','The Red Barn'] },
  { name:'Saffron Docks', sky:['#7bbada','#f9dfac','#447480'], hull:'#e2a13b', mark:'buoy', routes:['Saltwater Ink','Parcel Pier','Lighthouse Line'] },
  { name:'Kite Valley', sky:['#8dc8a9','#ffdf99','#54876d'], hull:'#37a697', mark:'kite', routes:['Paper Tails','Ribbon School','Festival Express'] },
  { name:'Bell Spires', sky:['#98afd9','#ffcdb8','#746789'], hull:'#c97093', mark:'bell', routes:['First Chime','Roof Garden','Evening Bells'] },
  { name:'Night Airshow', sky:['#343c71','#ce8f9d','#414765'], hull:'#9681cb', mark:'moon', routes:['Blue Hour','Moon Parade','Stars on Strings'] },
  { name:'Sunday Post', sky:['#8675b8','#ffc496','#67597a'], hull:'#e98559', mark:'swift', routes:['Sunday Stamps','The Long Edition','A Letter for Me'] },
];
// w = wide wing, b = bank, p = parcel, g = gust, c = climb, d = depth,
// t = changing bank and lane, r = relay. Each line is individually paced.
const manifests = [
 ['wwwbwpwwbw','wwpbwbwpbww'],['wbwpbwbpww','bwpwwbpbwpc'],['wwbcpwbbpwc','bwpbwcwpbwc'],
 ['wwpwpbpcpw','pwbpwwppcbw'],['wbppbcpwpbw','wpbcpbwpbpc'],['wpcppwbpcpbw','pbwpccpwbpc'],
 ['wwgwbpgbwg','wpgbwgpcwgb'],['wbggpcbwgpc','bgwpcpgcwpb'],['wpbgcgpbcwgp','gpwcbgpgwbc'],
 ['wwdwbpdcwd','wbdpwcdbwpd'],['wdcbdgcwpbd','dpwbgdcwbdc'],['wdpcgdcbgwpd','wdgcbpgddwc'],
 ['wbtwbdtpbt','cbtpwdgtbct'],['wgbtpcbdtgt','wctgdbtpcgt'],['wcbdttgpbdct','bctdgpcbtgt'],
 ['wwrpbrdcwr','gbrwdrptbgr'],['wbrdgptbrrc','wcgtbrptdgr'],['wcbdgrtprrrrc','ggpbdrctprrrr'],
];
export const routes=manifests.map(([out,home],i)=>({id:i,name:districts[Math.floor(i/3)].routes[i%3],district:Math.floor(i/3),legs:out+home,turn:out.length}));
export function randomWord(seed,index,salt=0){
 let h=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+3,0x85ebca77))>>>0;
 h=Math.imul(h^(h>>>16),0x21f0aaad);h=Math.imul(h^(h>>>15),0x735a2d97);
 return ((h^(h>>>15))>>>0)/4294967296;
}
export function weather(seed,mode,route,n){
 const u=i=>randomWord(seed,n,i);
 const lv=mode==='post' ? route.district : Math.min(5,Math.floor(n/6));
 const bag=['wbp','wbcp','wbgpc','bpdgc','bcgdpt','cbpdgtr'][lv];
 const glyph=mode==='post'?route.legs[n%route.legs.length]:n<2?'w':bag[Math.floor(u(0)*bag.length)];
 const wide=glyph==='w',first=n===0, cross='dtr'.includes(glyph);
 const power=first?.49:.22+u(1)*.58;
 return {glyph,power,level:lv,letter:'prtc'.includes(glyph)||(n>1&&n%3===2),lane:cross?(u(2)<.5?-1:1):0,
  gap:(1.05+2.95*power)*((3.8+.42*power)*2/6.8), half:first?.82:wide?.7:Math.max(.27,.55-.036*lv)+u(3)*.08,
  amp:first?0:wide?.055:'ct'.includes(glyph)?.28:.13,bank:wide?.025:'btr'.includes(glyph)?.18:.071,
  gust:'gtr'.includes(glyph)?(u(4)<.5?-1:1)*(.29+u(5)*.38):0,phase:u(6)*Math.PI*2,
  cadence:.6+u(7)*.8,y:first?0:(u(8)-.5)*.52,letterBias:(u(9)-.5)*.24,
  body:Math.floor(u(10)*4),paint:Math.floor(u(11)*4)};
}
export const shelf = data => data?.wingwalk?.routes || {};
export function fileCard(data,id,grade,score){
 const old=data.wingwalk||{},cards=old.routes||{},prev=cards[id]||{};
 return {...data,wingwalk:{...old,routes:{...cards,[id]:{grade:Math.max(grade,prev.grade||0),score:Math.max(score,prev.score||0)}}}};
}
