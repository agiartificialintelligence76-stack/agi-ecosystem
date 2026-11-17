import { clip, mix, type, line, oval, polygon, gradient, panel } from '../kit/illustration.js';

const STAMPS=[['DAWN','#ffca7c','sun'],['BLOOM','#ff9c97','flower'],['LUNA','#a9ceff','moon'],['LEAF','#a5dc91','leaf']];
const depth=(x,y,z)=>{const scale=1/(1+z*1.09);return [240+x*scale,218+y*scale];};
function emblem(c,x,y,size,kind,color){
  c.save();c.translate(x,y);c.scale(size,size);
  if(kind==='sun'){for(let i=0;i<10;i++){c.rotate(Math.PI/5);line(c,[[0,-.62],[0,-.96]],color,.12);}oval(c,0,0,.43,.43,color);}
  if(kind==='flower'){for(let i=0;i<6;i++){c.rotate(Math.PI/3);oval(c,0,-.4,.27,.44,color);}oval(c,0,0,.24,.24,'#e4c584');}
  if(kind==='moon'){oval(c,0,0,.75,.75,color);oval(c,.36,-.23,.61,.61,'#294c4a');}
  if(kind==='leaf'){polygon(c,[[-.7,.6],[-.52,-.15],[-.12,-.64],[.76,-.78],[.59,.14],[.1,.63]],color);line(c,[[-.8,.75],[.44,-.42]],'#36594b',.09);}
  c.restore();
}
export default {
  title:'RETURN ADDRESS',tagline:'Play squash in the night sorting office. Send every parcel back stamped.',
  instructions:[['Serve the parcel','Move the paddle and tap or press Space to serve.'],['Read the flight','The dotted guide marks where the parcel will reach your paddle. Catch it before it passes.'],['Stamp your returns','Hit off-center to steer toward the illustrated stamp. Print all twelve before you lose three parcels.']],
  keys:[['Arrows / WASD','Move paddle'],['Space','Serve']],touch:[['Drag','Move paddle'],['Tap','Serve']],
  create(api){
    let x=0,y=0,z=0,dx=0,dy=0,dz=0,px=0,py=10,aimX=0,aimY=10,age=0,score=0,lives=3,count=0,high=0,printed=0;
    let target={x:0,y:-25},kind=0,state='serve',flash=0,notice='',timer=0,trail=[],sample=0;
    const held=new Set();
    function setStamp(){kind=(kind+1)%4;target={x:(api.rng()-.5)*200,y:(api.rng()-.5)*167};}
    function hud(){api.hud('Postage',score,'Parcels',lives);}
    function serve(){
      if(state!=='serve')return;
      state='rally';x=px;y=py;z=.025;dz=.76;dx=(target.x-x)*dz;dy=(target.y-y)*dz;trail=[];api.sound('pop');
    }
    function rebound(paddleX,paddleY){
      const offX=x-paddleX,offY=y-paddleY;
      if(Math.abs(offX)>63||Math.abs(offY)>49){lives--;high=Math.max(high,count);hud();
        if(!lives){state='done';api.end(score,[['Longest rally',high],['Stamps printed',printed]],'postmarked and delivered. meet you on the night shift?');}
        else {state='serve';notice='Parcel lost';timer=1;count=0;}return;}
      count++;high=Math.max(high,count);score+=5+Math.min(count,20);hud();
      dz=Math.min(1.4,.8+count*.04);
      dx=clip(offX*3.2+dx*.15,-195,195);dy=clip(offY*3.5+dy*.15,-160,160);
      z=.008;api.sound('tap');api.haptic(10);
    }
    function step(dt){
      age+=dt;timer=Math.max(0,timer-dt);flash=Math.max(0,flash-dt*2.6);
      const ax=(held.has('ArrowRight')||held.has('KeyD')?1:0)-(held.has('ArrowLeft')||held.has('KeyA')?1:0);
      const ay=(held.has('ArrowDown')||held.has('KeyS')?1:0)-(held.has('ArrowUp')||held.has('KeyW')?1:0);
      aimX=clip(aimX+ax*290*dt,-194,194);aimY=clip(aimY+ay*265*dt,-141,141);
      px=mix(px,aimX,1-Math.exp(-25*dt));py=mix(py,aimY,1-Math.exp(-25*dt));
      if(state==='serve'){x=px;y=py;z=.035;return;}
      if(state!=='rally')return;
      x+=dx*dt;y+=dy*dt;z+=dz*dt;
      if(Math.abs(x)>182){x=clip(x,-182,182);dx=-Math.sign(x)*Math.abs(dx);}
      if(Math.abs(y)>130){y=clip(y,-130,130);dy=-Math.sign(y)*Math.abs(dy);}
      if(z>=1 && dz>0){
        z=1;dz*=-1;
        if(Math.abs(x-target.x)<55&&Math.abs(y-target.y)<53){printed++;score+=50+10*Math.min(8,count);notice='Postmarked!  +'+(50+10*Math.min(8,count));timer=.85;flash=1;
          api.sound('merge');setStamp();hud();
          if(printed===12){state='done';api.end(score,[['Longest rally',high],['Stamps printed',printed]],'every parcel made the last collection.');}}
        else api.sound('tick');
      }
      if(z<=0&&dz<0)rebound(px,py);
      if((sample+=dt)>.028){sample=0;trail.push(depth(x,y,z));if(trail.length>9)trail.shift();}
    }
    function predict(p,v,t,bound){const width=bound*2;let n=((p+v*t+bound)%(width*2)+width*2)%(width*2);return (n<=width?n:width*2-n)-bound;}
    function intercept(){const delay=dz<0?-z/dz:0;return [predict(x,dx,delay,182),predict(y,dy,delay,130)];}
    hud();
    return {
      update:step,
      draw(c){
        gradient(c,0,0,480,480,['#192e31','#335956','#132d32']);
        type(c,'NIGHT MAIL',22,24,16,'#f7cf8c','left');type(c,'COURT   /   01',458,24,15,'#a5c8b5','right');
        const bounds=[[-208,-155],[208,-155],[208,155],[-208,155]];
        const far=bounds.map(([xx,yy])=>depth(xx,yy,1)), near=bounds.map(([xx,yy])=>depth(xx,yy,0));
        polygon(c,far,'#294c4a','#f2cf94',1.6);
        for(let n=0;n<4;n++){const i=(n+1)%4;polygon(c,[near[n],near[i],far[i],far[n]],['#344844','#485e52','#617366','#4d6661'][n],'#9ebea1',1);}
        for(let k=0;k<8;k++){const d=k/8;const box=bounds.map(([xx,yy])=>depth(xx,yy,d));line(c,[...box,box[0]],'#d2e3bd42');}
        for(let i=-150;i<200;i+=50){line(c,[depth(i,155,0),depth(i,155,1)],'#cad9b262');line(c,[depth(i,-155,0),depth(i,-155,1)],'#b3c8a530');}
        const [sx,sy]=depth(target.x,target.y,1), [name,col,shape]=STAMPS[kind];
        panel(c,sx-26,sy-27,52,54,col,2);panel(c,sx-22,sy-23,44,46,'#294c4a',1);
        for(let i=-23;i<=23;i+=7){oval(c,sx+i,sy-27,2,2,'#294c4a');oval(c,sx+i,sy+27,2,2,'#294c4a');}
        emblem(c,sx,sy-4,15,shape,col);type(c,name,sx,sy+17,9,col,'center','Georgia');
        const [ix,iy]=intercept();
        if(dz<0&&state==='rally'){const [ex,ey]=depth(ix,iy,0);c.setLineDash([3,6]);line(c,[depth(x,y,z),[ex,ey]],'#ffe5a381',1.5);c.setLineDash([]);oval(c,ex,ey,12,8,null,'#f4dca6',2);}
        if(state==='rally')trail.forEach(([tx,ty],i)=>oval(c,tx,ty,2+i*.6,2+i*.6,'#ffce8d5e'));
        const [bx,by]=depth(x,y,z), s=14/(1+z);
        c.save();c.translate(bx,by);c.rotate(state==='rally'?age*2:.1);
        polygon(c,[[-s,-s*.65],[s,-s*.65],[s,s*.65],[-s,s*.65]],'#fff2d1','#573d3b',1.8);
        line(c,[[-s,-s*.65],[0,s*.1],[s,-s*.65]],'#ab6a54',1.2);c.restore();
        const [cx,cy]=depth(px,py,0);
        panel(c,cx-47,cy-33,94,66,'#b9f2d229',10);
        c.strokeStyle='#fbddb0';c.lineWidth=2.5;c.stroke();
        for(let j=-28;j<44;j+=13)line(c,[[cx+j,cy-30],[cx+j,cy+30]],'#abcdbd58',1);
        for(let j=-20;j<30;j+=13)line(c,[[cx-45,cy+j],[cx+45,cy+j]],'#abcdbd58',1);
        panel(c,15,391,450,74,'#192e31');
        type(c,timer>0?notice:state==='serve'?'Tap to serve':'Rally  '+String(count).padStart(2,'0'),34,417,23,'#ffe7c2','left','Georgia');
        type(c,'STAMP '+Math.min(printed+1,12)+' / 12',443,410,13,'#b6d0bd','right');type(c,name,443,435,17,col,'right');
        type(c,state==='serve'?'Drag or use arrows to move':'Catch the dotted landing mark',34,443,15,'#b8cdbb','left');
      },
      pointer(t,x,y){if(t==='down'||t==='move'){aimX=clip(x-240,-194,194);aimY=clip(y-218,-141,141);}if(t==='down')serve();},
      key(t,k){if(t==='up'){held.delete(k);return;}held.add(k);if(k==='Space'||k==='Enter')serve();},
      demo(){if(state==='serve'&&age>1){serve();}if(dz<0&&state==='rally'){const [ex,ey]=intercept();aimX=clip(ex-(target.x-ex)*.27,-194,194);aimY=clip(ey-(target.y-ey)*.26,-141,141);}}
    };
  }
};
