import { clamp, mix, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

export default {
  title:'DRIFTGLASS',tagline:'Read the next flags. Throw a sideways slide across a mirror-bright salt flat.',
  instructions:[
    ['Read the course','Drive between each pair of flags. The ribbons on the salt link one gate to the next.'],
    ['Slide the corner','Tap Drift or hold Space as you steer. Your car rotates faster and carries its sideways momentum.'],
    ['Chain the flags','Clean passes build a multiplier. Slide through for extra style. Finish eighteen gates before the clock runs out.'],
  ],
  keys:[['Left / Right or A / D','Steer'],['Hold Space','Drift']],
  touch:[['Drag across the salt','Steer toward your finger'],['Tap DRIFT','Switch drift on or off']],
  create(api){
    const course=[{x:0,z:0}],keys=new Set(),marks=[],crystals=[];
    let next=1,z=0,x=0,vx=0,yaw=0,speed=28,wantX=0,touch=false,latched=false,drift=false;
    let score=0,chain=0,clean=0,slides=0,remaining=67,t=0,ended=false,notice='FOLLOW THE FLAGS',noticeTime=2.3,markClock=0;
    for(let i=1;i<=19;i++){
      const prev=course.at(-1);course.push({x:clamp(prev.x+(i===1?0:(i%2?1:-1))*(24+api.rng()*49),-91,91),z:prev.z+79+api.rng()*12});
    }
    for(let i=0;i<110;i++)crystals.push({x:(api.rng()-.5)*775,z:api.rng()*850,t:api.rng()});
    function centreAt(p){
      const j=course.findIndex(g=>g.z>=p);
      if(j<=0)return course[j===0?0:course.length-1].x;
      const a=course[j-1],b=course[j],s=clamp((p-a.z)/(b.z-a.z),0,1);
      return mix(a.x,b.x,s*s*(3-2*s));
    }
    function projection(wx,wz,h=0){
      const f=81/(81+wz-z);
      return [240+(wx-x*.8)*f*2.15,165+(205-h*2.1)*f,f];
    }
    function flag(c,wx,p,side,first){
      const [xx,yy,s]=projection(wx,p);
      const hh=(first?46:36)*s,sideColor=side===1?'#ed7657':'#22697b';
      line(c,[[xx,yy],[xx,yy+hh*.49]],'#789b9a78',Math.max(1,2*s));
      line(c,[[xx,yy],[xx,yy-hh]],'#403a4c',Math.max(.8,2.6*s));
      poly(c,[[xx,yy-hh],[xx+side*17*s,yy-hh+3*s],[xx+side*13*s,yy-hh+12*s],[xx,yy-hh+11*s]],sideColor);
      poly(c,[[xx,yy-hh+1*s],[xx+side*7*s,yy-hh+2*s],[xx+side*6*s,yy-hh+7*s],[xx,yy-hh+6*s]],'#f5e5b6');
      poly(c,[[xx-5*s,yy],[xx,yy-10*s],[xx+5*s,yy]],'#e98b65');
    }
    return{
      pointer(type,px,py){
        if(type==='down'){
          if(py>=411&&px>280){latched=!latched;api.sound('click');return;}touch=true;
        }
        if(touch&&(type==='down'||type==='move'))wantX=clamp(x*.8+(px-240)/1.8,-153,153);
        if(type==='up'||type==='cancel')touch=false;
      },
      key(type,code){if(type==='down')keys.add(code);else keys.delete(code);},
      demo(){
        const target=course[next];if(!target)return;
        touch=true;wantX=centreAt(z+38);
        latched=Math.abs(wantX-x)>11||Math.abs(vx)>12;
      },
      update(dt){
        if(ended)return;t+=dt;remaining-=dt;noticeTime-=dt;
        const arrows=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
        const steer=clamp(touch?(wantX-x)*.066-vx*.024:arrows,-1,1);
        drift=latched||keys.has('Space');yaw=mix(yaw,steer*(drift?1.1:.66),Math.min(1,dt*(drift?6.4:4.5)));
        const sideSpeed=drift?88:63;
        vx=mix(vx,Math.sin(yaw)*sideSpeed,Math.min(1,dt*(drift?2.55:4.85)));
        x=clamp(x+vx*dt,-157,157);
        speed=mix(speed,(drift?29:39)+Math.min(chain,10)*.65,Math.min(1,.67*dt));z+=speed*dt;
        markClock-=dt;
        if(markClock<=0){markClock=.085;marks.push({x,z,yaw,drift:drift&&Math.abs(vx)>8});}
        while(marks[0]?.z<z-45)marks.shift();
        const gate=course[next],half=gate?24-next*.36:20;
        if(gate&&z>=gate.z){
          const off=Math.abs(x-gate.x);
          if(off<=half){
            chain++;clean++;const style=drift&&Math.abs(vx)>10;
            if(style)slides++;
            score+=Math.round((style?155:95)*(1+Math.min(5,chain-1)*.18));
            notice=style?'SLIDE PASS  ×'+chain:'CLEAN GATE  ×'+chain;api.sound(style?'combo':'coin');
          }else{
            chain=0;speed*=.58;remaining-=1.2;notice='WIDE  •  −1.2 SEC';api.sound('hurt');api.haptic(20);
          }
          next++;noticeTime=1.1;
        }
        api.hud('Race',score,'Time',Math.max(0,Math.ceil(remaining))+'s');
        if(next>18||remaining<=0){ended=true;api.end(score,[['Clean gates',clean+'/18'],['Drift passes',slides]],next>18?'now look back at the lines you drew.':'there is a faster line through those flags.');}
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#7e73ae'],[.27,'#ffb2a8'],[.345,'#ffdfb7'],[.35,'#bfd9cb'],[.7,'#9bc8cc'],[1,'#7798b1']]);c.fillRect(0,0,480,480);
        oval(c,343-x*.065,102,42,42,'#ffe2b8');
        for(let j=0;j<2;j++){
          const p=[[-30,170]];for(let i=-2;i<23;i++)p.push([i*25-x*(j*.033+.027),139+j*12+Math.sin(i*.81+j)*11+Math.cos(i*1.64+j)*8]);
          p.push([510,170]);poly(c,p,j?'#8a839a':'#a69ab0');
          poly(c,p.map(([px,py])=>[px,330-py*.95]),j?'#91a3b0':'#b3b4bb');
        }
        const roadLeft=[],roadRight=[];
        for(let d=470;d>=-32;d-=6){
          const zz=z+d,mid=centreAt(zz);
          roadLeft.push(projection(mid-26,zz));roadRight.push(projection(mid+26,zz));
        }
        poly(c,[...roadLeft,...roadRight.reverse()],'#f5e7cc4f');
        line(c,roadLeft,'#dff2e255',1.5);line(c,roadRight,'#f3e7d980',1.5);
        for(const p of crystals){
          const dz=(p.z-z%850+1700)%850-41,[cx,cy,s]=projection(p.x,z+dz);
          if(cx<0||cx>480||cy>478)continue;
          const count=4+Math.floor(p.t*3);
          const kinks=Array.from({length:count},(_,i)=>[cx+(i-count/2)*s*4,cy+Math.sin(i*1.65+p.t*4)*s*2.2]);
          line(c,kinks,'#f4f5de80',Math.max(.5,s));
        }
        for(let i=Math.min(18,next+5);i>=next;i--){
          const g=course[i],half=24-i*.36;
          flag(c,g.x-half,g.z,-1,i===next);flag(c,g.x+half,g.z,1,i===next);
        }
        for(let i=1;i<marks.length;i++){
          const a=marks[i-1],b=marks[i];if(!b.drift)continue;
          for(const k of [-7,7])line(c,[projection(a.x+k,a.z),projection(b.x+k,b.z)],'#637b8d77',2.5);
        }
        const [cx,cy]=projection(x,z);oval(c,cx,cy+2,36,8,'#586e85aa');
        c.save();c.translate(cx,cy);c.transform(1,0,-yaw*.52,1,0,0);c.rotate(yaw*.055);
        for(const k of [-1,1]){panel(c,k*27-5,-10,11,15,'#3e4054',3);}
        poly(c,[[-34,-8],[-29,-19],[-17,-31],[11,-34],[26,-24],[32,-7],[25,0],[-25,0]],'#85435a');
        poly(c,[[-30,-18],[-18,-32],[11,-34],[26,-24],[17,-16],[-12,-13]],'#ff9b79');
        poly(c,[[-18,-30],[10,-32],[19,-23],[-11,-21]],'#455672');
        poly(c,[[-12,-30],[-3,-31],[-10,-22],[-15,-22]],'#9bacb4');
        poly(c,[[-31,-13],[27,-17],[31,-10],[26,-4],[-25,-3]],'#c65f64');
        line(c,[[-25,-11],[-13,-11]],'#ffcec0',3);line(c,[[13,-13],[25,-14]],'#ffcec0',3);
        panel(c,-5,-9,11,4,'#ffdfaa',1);line(c,[[-28,-17],[27,-21]],'#693e58',3.3);c.restore();
        panel(c,14,15,181,47,'#42415be8');caption(c,'SALT FLAT SLALOM',28,38,'#ffe0c3',17,'left');
        if(noticeTime>0){panel(c,109,292,262,32,'#45485de8');caption(c,notice,240,309,'#fff0cc',16);}
        panel(c,13,412,246,53,'#404559');caption(c,'GATE '+Math.min(next,18)+' / 18',27,432,'#f4e4d3',16,'left');
        meter(c,27,448,213,(next-1)/18,'#ffb894','#72788c');
        panel(c,273,412,193,53,drift?'#ffb997':'#e4d8ce');caption(c,drift?'DRIFT  •  ON':'DRIFT  •  OFF',369,439,'#4a4458',18);
      },
    };
  },
};
