import { clip, TAU, type, line, oval, gradient, panel, polygon, painting } from '../kit/illustration.js';

import { chartStars, transit, tracePoint, drawChart } from './chart.js';
const sky=painting(new URL('./scene.webp',import.meta.url));
const PLATES=[
 ['Paper kite',[[-.12,-.03],[0,-.15],[.12,-.03],[0,.15],[-.12,-.03],[.12,-.03]]],
 ['Sleeping fox',[[-.17,.05],[-.14,-.1],[-.04,-.035],[.08,-.08],[.16,-.17],[.15,.07],[.03,.12],[-.17,.05]]],
 ['River bend',[[-.19,-.08],[-.08,-.12],[-.03,.015],[.07,.09],[.15,.05],[.19,-.06]]],
 ['Windmill',[[0,0],[-.13,-.18],[-.16,-.07],[0,0],[.19,-.1],[.08,-.16],[0,0],[.1,.17],[.16,.08],[0,0]]],
 ['Twin peaks',[[-.19,.12],[-.09,-.13],[0,.04],[.1,-.17],[.19,.1]]],
 ['Starling',[[-.2,-.09],[-.07,-.05],[0,.05],[.07,-.09],[.14,-.11],[.08,.04],[-.01,.14],[-.11,.06],[-.2,-.09]]],
];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function projectStar(ra,dec,yaw,pitch){
  const dx=wrap(ra-yaw),cz=Math.cos(dec),sy=Math.sin(dec),sp=Math.sin(pitch),cp=Math.cos(pitch);
  const forward=cz*Math.cos(dx)*cp+sy*sp;
  if(forward<=.15)return null;
  return [240+cz*Math.sin(dx)*400/forward,202-(sy*cp-cz*Math.cos(dx)*sp)*400/forward];
}
export default {
  title:'STARLING RELAY',tagline:'Expose the turning sky, ink the constellations and catch a comet on glass.',
  instructions:[['Find the constellation','Drag the sky or use the arrows. Follow the brass bearing marker, center the gold star and hold the shutter to expose the glass.'],['Ink the atlas','The miniature atlas shows the next star in gold. Trace it on the glass in sequence. Repeated junctions count again. A wrong star costs one second.'],['Watch for transits','Tag the violet comet while tracing for a rarer plate. Finish all six before dawn. Flawless plates earn extra points.']],
  keys:[['Arrows','Aim or select a star'],['Space','Shutter or mark star'],['Up in chart','Record passing comet']],
  touch:[['Drag the sky','Aim telescope'],['Hold shutter','Expose plate'],['Tap stars or comet','Trace or record transit']],
  create(api){
    let yaw=0,pitch=.2,ra=.36,dec=.27,shutter=false,drag=null,stage=0,t=0,left=100,exposure=0,score=0,wait=0,done=false;
    let lastHud='',plateSeconds=0,chart=null,comets=0,clean=0,botClock=0;
    const stars=Array.from({length:850},()=>({ra:api.rng()*TAU-Math.PI,dec:Math.asin(api.rng()*2-1),r:.55+api.rng()**3*1.8,h:api.rng(),phase:api.rng()*TAU}));
    const keys=new Set();
    function next(){
      ra=wrap(yaw+(api.rng()<.5?-1:1)*(.35+api.rng()*.36));
      dec=clip(pitch+(api.rng()-.5)*.58,-.8,.8);exposure=0;plateSeconds=0;shutter=false;
    }
    function updateHud(){const key=stage+'-'+Math.ceil(left);if(key!==lastHud){api.hud('Plate',Math.min(stage+1,6)+'/6','Dawn',Math.ceil(left)+'s');lastHud=key;}}
    function finish(){done=true;api.end(score,[['Plates exposed',stage+' / 6'],['Transits',comets],['Flawless plates',clean]],'let’s name the next constellation after something small.');}
    const error=()=>Math.hypot(wrap(ra-yaw)*Math.cos(dec),dec-pitch);
    function mark(index) {
      if(!chart||done)return;
      if(!tracePoint(chart,index)){left=Math.max(0,left-1);api.sound('error');return;}
      api.sound('merge');
      if(chart.ink.length===chart.order.length){
        clean+=Number(!chart.errors);comets+=Number(chart.satellite);
        score+=Math.max(70,Math.round(220-plateSeconds*3))+(chart.satellite?75:0)+(chart.errors?0:35);
        chart=null;stage++;wait=1.25;api.sound('win');api.haptic(18);updateHud();
      }
    }
    function trackComet(){
      if(!chart||chart.satellite)return;
      const {x}=transit(chart);
      if(x<171||x>317){api.sound('tick');return;}
      chart.satellite=true;api.sound('power');api.haptic(8);
    }
    updateHud();
    return {
      update(dt){
        if(done)return;t+=dt;
        if(wait>0){wait=Math.max(0,wait-dt);if(wait===0){if(stage===6)finish();else next();}return;}
        left=Math.max(0,left-dt);plateSeconds+=dt;if(left<=0){finish();return;}
        if(chart){chart.age+=dt;chart.idle+=dt;chart.faded=Math.max(0,chart.faded-dt);updateHud();return;}
        ra=wrap(ra+dt*(.011+stage*.004));
        const speed=shutter?.32:.83;
        yaw=wrap(yaw+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*speed);
        pitch=clip(pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt*speed,-1.22,1.22);
        const e=error();
        if(shutter&&e<.13)exposure+=dt*(.39+.27*(1-e/.13));else if(shutter)exposure=Math.max(0,exposure-dt*.23);
        if(exposure>=1){exposure=1;shutter=false;drag=null;keys.clear();chart=chartStars(PLATES[stage][1],stage);api.sound('clear');api.haptic(12);}
        updateHud();
      },
      draw(c){
        if(chart){drawChart(c,chart,PLATES[stage][0],sky);return;}
        gradient(c,0,0,480,480,['#131e39','#21375c','#42466f']);
        // The star catalog and plate share one spherical camera.
        c.save();c.beginPath();c.arc(240,202,190,0,TAU);c.clip();
        const field=c.createRadialGradient(200,145,10,240,202,205);field.addColorStop(0,'#30446a');field.addColorStop(.6,'#1c2f50');field.addColorStop(1,'#0e172e');c.fillStyle=field;c.fillRect(0,0,480,406);
        c.save();c.globalAlpha=.77;
        const ox=Math.sin(yaw)*49,oy=Math.sin(pitch)*42;
        sky(c,-70+ox,-97+oy,624,628);
        c.restore();
        for(let d=-1.1;d<=1.15;d+=.24){
          let pts=[];for(let j=-12;j<=12;j++){const p=projectStar(yaw+j*.065,d,yaw,pitch);if(p)pts.push(p);}
          if(pts.length>1)line(c,pts,'#88adcb24',1);
        }
        const m=Math.floor(yaw/.28);
        for(let a=m-4;a<=m+4;a++){let pts=[];for(let d=-1.45;d<1.5;d+=.08){const p=projectStar(a*.28,d,yaw,pitch);if(p)pts.push(p);}if(pts.length>1)line(c,pts,'#8aa6bd22',1);}
        for(const s of stars){const p=projectStar(s.ra,s.dec,yaw,pitch);if(!p||Math.hypot(p[0]-240,p[1]-202)>191)continue;
          oval(c,...p,s.r,s.r,s.h>.67?'#ffdbbe':'#dbe9fb');if(s.r>1.9){line(c,[[p[0]-4,p[1]],[p[0]+4,p[1]]],'#cddff599',1);}}
        const idx=Math.min(5,wait>0?stage-1:stage),model=PLATES[idx], points=model[1].map(([x,y])=>projectStar(ra+x/Math.cos(dec),dec-y,yaw,pitch));
        for(let i=1;i<points.length;i++)if(points[i-1]&&points[i])line(c,[points[i-1],points[i]],'#9bb8cfb3',1.7);
        for(const p of points)if(p)oval(c,...p,2.6,2.6,'#fff4ca');
        const pos=projectStar(ra,dec,yaw,pitch);
        if(pos){const s=5;polygon(c,[[pos[0],pos[1]-s],[pos[0]+s,pos[1]],[pos[0],pos[1]+s],[pos[0]-s,pos[1]]],'#ffc47c');}
        oval(c,240,202,43,43,null,shutter?'#f2c38f':'#97b4c99c',1.5);
        for(let i=0;i<4;i++){const a=Math.PI*i*.5;line(c,[[240+Math.cos(a)*14,202+Math.sin(a)*14],[240+Math.cos(a)*48,202+Math.sin(a)*48]],'#d1d9c8aa',1);}
        if(!wait&&error()>.12){const a=Math.atan2(pitch-dec,wrap(ra-yaw)*Math.cos(dec));
          c.save();c.translate(240,202);c.rotate(a);polygon(c,[[62,0],[51,-5],[52,5]],'#ffd394');c.restore();}
        c.restore();oval(c,240,202,192,192,null,'#443b40',8);oval(c,240,202,191,191,null,'#c8a775',3);oval(c,240,202,197,197,null,'#867a69',3);
        for(const [u,v] of [[35,38],[445,38],[32,362],[448,362]]){oval(c,u,v,7,7,'#a7906d','#443c39',2);line(c,[[u-3,v+2],[u+3,v-2]],'#4d4846',1.4);}
        for(let i=0;i<72;i++){const a=i*TAU/72,L=i%6===0?7:2;line(c,[[240+Math.cos(a)*196,202+Math.sin(a)*196],[240+Math.cos(a)*(196+L),202+Math.sin(a)*(196+L)]],'#c7b590a0',1);}
        panel(c,0,397,480,83,'#192439',0);
        type(c,'GLASS PLATE  '+String(idx+1).padStart(2,'0'),18,416,13,'#b6c6dd','left');type(c,model[0],18,447,24,'#f3ddb6','left','Georgia');
        panel(c,254,411,207,52,wait?'#95b9aa':shutter?'#ebc998':'#a9bcd2');
        type(c,wait?'Plate developed':shutter?'Exposing '+Math.round(exposure*100)+'%':'Hold shutter',357,434,19,'#273043');
        if(exposure>0)panel(c,269,450,177*exposure,4,'#374b55',2);
      },
      pointer(action,x,y){if(chart){
        if(action!=='down')return;
        const s=transit(chart);
        if(!chart.satellite&&Math.hypot(x-s.x,y-s.y)<14){trackComet();return;}
        const at=chart.stars.findIndex(p=>Math.hypot(x-p.x,y-p.y)<21);if(at>=0)mark(at);return;
      }if(action==='down'){if(y>=397&&x>=242){shutter=true;drag=null;}else drag={x,y};}
        if(action==='move'&&drag){yaw=wrap(yaw-(x-drag.x)*.0039);pitch=clip(pitch+(y-drag.y)*.0039,-1.22,1.22);drag={x,y};}
        if(action==='up'||action==='cancel'){drag=null;shutter=false;}},
      key(a,k){if(chart){
        if(a!=='down')return;
        const n=chart.stars.length;
        if(k==='ArrowLeft'||k==='ArrowRight')chart.cursor=(chart.cursor+(k==='ArrowRight'?1:n-1))%n;
        if(k==='ArrowUp')trackComet();if(k==='Space'||k==='Enter')mark(chart.cursor);return;
      }if(a==='down'){keys.add(k);if(k==='Space')shutter=true;}else{keys.delete(k);if(k==='Space')shutter=false;}},
      demo(dt){if(wait||done)return;
        if(chart){botClock+=dt;if(botClock>.39){botClock=0;if(!chart.satellite&&chart.ink.length===2)trackComet();else mark(chart.order[chart.ink.length]);}return;}
        const step=dt*1.6;yaw=wrap(yaw+wrap(ra-yaw)*step);pitch+=(dec-pitch)*step;shutter=error()<.09;}
    };
  }
};
