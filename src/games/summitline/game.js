import { clamp, mix, poly, line, oval, gradient, caption, panel, meter } from '../kit/field-art.js';

const stops=[112,245,395,558,739];
const names=['PINE BASIN','BELL RIDGE','SNOW LAKE','HIGH PASS','THE SUMMIT'];
const heightAt = d => 23*Math.sin(d*.015)+d*.13;
const bendAt = d => Math.sin(d*.009)*48;
export default {
  title:'SUMMIT LINE',tagline:'Run the last mountain gondola. Ease into each platform without spilling the cocoa.',
  instructions:[
    ['Set the throttle','Select Drive to accelerate, Coast to glide, or Brake to slow. Each setting stays on until you change it.'],
    ['Read the approach','The red brake mark appears when your current stopping distance reaches the platform.'],
    ['Dock gently','Stop within five metres of the station. A centred stop and a quiet cabin earn extra. Reach the fifth stop before closing.'],
  ],
  keys:[['1 / Left','Brake'],['2 / Down','Coast'],['3 / Right','Drive']],
  touch:[['Tap Brake, Coast or Drive','Set the throttle']],
  create(api){
    let pos=0,speed=0,mode=2,idx=0,docked=0,score=0,remaining=102,t=0,dwell=0,finished=false,go=false;
    let swing=0,swingV=0,best=0,notice='PINE BASIN AHEAD',noticeTime=2,windPhase=api.rng()*6,lastSpeed=0;
    const trees=Array.from({length:115},(_,i)=>({d:i*8-90,k:api.rng(),z:30+api.rng()*77}));
    function choose(n){if(mode===n||dwell>0)return;mode=n;api.sound('select');}
    const brakeRate=8.4;
    function stop(right){
      const off=Math.abs(stops[idx]-pos);
      if(right){
        const grade=Math.round(clamp(100-off*9-Math.abs(swing)*36,15,100));
        score+=150+grade*2;docked++;best=Math.max(grade,best);
        notice=off<1.6?'PERFECT PLATFORM STOP':'DOORS OPEN  •  '+grade+'% COMFORT';api.sound(off<1.6?'combo':'clear');
        pos=stops[idx];speed=0;dwell=2.1;mode=1;
      }else{notice='PLATFORM MISSED';api.sound('error');}
      idx++;noticeTime=2;
      if(idx===stops.length){go=true;dwell=2;}
    }
    function ridge(c,j,col){
      const pts=[[-40,400]];const scale=68-j*8,scroll=pos*(.025+j*.022);
      for(let i=-3;i<15;i++){
        const k=i+Math.floor(scroll/scale);pts.push([i*scale-scroll%scale,102+j*33+Math.sin(k*1.9+j)*22+Math.cos(k*.88)*30]);
      }
      pts.push([540,404]);poly(c,pts,col);
      if(j===0)for(let i=2;i<pts.length-2;i++){
        const a=pts[i-1],b=pts[i],d=pts[i+1];
        if(b[1]<a[1]&&b[1]<d[1])poly(c,[[mix(b[0],a[0],.37),mix(b[1],a[1],.37)],b,[mix(b[0],d[0],.49),mix(b[1],d[1],.49)],[b[0]+7,b[1]+8],[b[0],b[1]+16],[b[0]-4,b[1]+8]],'#fff4df');
      }
    }
    // Project the changing altitude and winding path of the cable in a three-quarter tracking view.
    function project(d,h=0,z=0){
      const relativeZ=bendAt(d)-bendAt(pos)+z;
      const depth=clamp(1-relativeZ*.0021,.65,1.3);
      return [180+(d-pos)*2.6*depth-relativeZ*.6,200-(heightAt(d)-heightAt(pos)+h)*depth+relativeZ*.5,depth];
    }
    function cabin(c){
      const [cx,cy]=project(pos);
      oval(c,cx,cy,5,4,'#343e4d');
      c.save();c.translate(cx,cy);c.rotate(swing*.36);
      line(c,[[0,0],[0,15],[5,23]],'#3e4250',3.3);
      poly(c,[[-18,22],[10,18],[22,24],[20,52],[-10,58],[-20,49]],'#ba564b');
      poly(c,[[-18,22],[10,18],[22,24],[-5,29]],'#ffe1a4');
      poly(c,[[-17,26],[-5,31],[-5,44],[-17,40]],'#8fb2c2');
      poly(c,[[-2,30],[17,26],[16,39],[-2,43]],'#4a7087');
      line(c,[[7,29],[7,41]],'#eec09c',2);line(c,[[-2,46],[16,42]],'#ffd79d',2.5);
      oval(c,5,51,2,2,'#ffe7ab');c.restore();
    }
    function station(c,d,n){
      const [cx,cy,s]=project(d);
      c.save();c.translate(cx,cy);c.scale(s,s);
      if(n%2)line(c,[[-14,5],[-14,78]],'#525267',5);
      poly(c,[[-22,53],[22,45],[35,51],[-9,62]],'#f4debc');
      poly(c,[[-9,62],[35,51],[35,59],[-9,72]],'#756a73');
      line(c,[[-1,70],[-1,107]],'#565467',4);line(c,[[23,62],[23,95]],'#565467',4);
      poly(c,[[6,20],[27,14],[27,47],[6,52]],'#af7a65');
      poly(c,[[27,14],[37,21],[37,51],[27,47]],'#976961');
      poly(c,[[0,21],[9,7],[29,2],[41,20],[27,16]],'#eee9dc');
      poly(c,[[9,25],[19,22],[19,34],[9,36]],'#536779');
      line(c,[[-22,54],[-22,39]],'#676176',2);oval(c,-22,36,3,3,'#ffcc7a');
      c.restore();
    }
    return {
      pointer(type,x,y){if(type==='down'&&y>=402)choose(clamp(Math.floor(x/160),0,2));},
      key(type,code){if(type!=='down')return;const v={Digit1:0,ArrowLeft:0,Digit2:1,ArrowDown:1,Digit3:2,ArrowRight:2}[code];if(v!==undefined)choose(v);},
      demo(){
        if(dwell||go)return;
        const left=stops[idx]-pos;
        mode=left<speed*speed/(2*brakeRate)+1.2?0:left<8&&speed>3?1:2;
        if(left<1.8)mode=0;
      },
      update(dt){
        if(finished)return;t+=dt;noticeTime-=dt;remaining-=dt;
        if(dwell>0){
          dwell=Math.max(0,dwell-dt);
          if(dwell===0&&!go){mode=2;notice=names[idx]+' AHEAD';noticeTime=1.6;}
        }else if(!go){
          const slope=Math.cos(pos*.015)*.35+.13;
          const acceleration=mode===2?5.3-slope*.95:mode===1?-.42-slope*.65:-brakeRate;
          speed=clamp(speed+acceleration*dt,0,20);pos+=speed*dt;
          if(Math.abs(stops[idx]-pos)<=5&&speed<.47&&mode===0)stop(true);
          else if(pos>stops[idx]+5.05)stop(false);
        }
        const wind=Math.sin(t*1.6+windPhase)*Math.cos(pos*.028+1)*.9;
        swingV+=((speed-lastSpeed)*.36+wind*dt-swing*5.2*dt)-swingV*2.1*dt;
        swing=clamp(swing+swingV*dt,-1,1);lastSpeed=speed;
        api.hud('Service',score,'Closing',Math.max(0,Math.ceil(remaining))+'s');
        if((go&&dwell===0)||remaining<=0){
          finished=true;api.end(score,[['Stations served',docked+'/5'],['Best comfort',best+'%']],docked===5?'last car up. look at that sunset.':'i warmed the cocoa for the next run.');
        }
      },
      draw(c){
        c.fillStyle=gradient(c,0,480,[[0,'#8c88a3'],[.27,'#e9b8ab'],[.54,'#f4d8b6'],[1,'#70827e']]);c.fillRect(0,0,480,480);
        oval(c,329-pos*.015,69,30,30,'#ffdfae');
        ridge(c,0,'#a79aa6');ridge(c,1,'#948a98');ridge(c,2,'#77838b');ridge(c,3,'#627b80');
        for(const p of trees){
          if(Math.abs(p.d-pos)>160)continue;
          const [cx,cy,s]=project(p.d,-86,p.z),r=5+p.k*8;
          poly(c,[[cx,cy-r*3*s],[cx-r*s,cy],[cx+r*s,cy]],p.k>.5?'#4c7375':'#416c70');
          poly(c,[[cx,cy-r*3*s],[cx-r*.45*s,cy-r*1.5*s],[cx,cy-r*1.65*s],[cx+r*.35*s,cy-r*1.55*s]],'#b2c6bd');
        }
        for(let n=Math.max(0,Math.floor((pos-100)/55));n*55<pos+160;n++){
          const [cx,cy]=project(n*55);
          line(c,[[cx-3,cy+1],[cx-9,cy+108]],'#506267',4);
          line(c,[[cx+6,cy+3],[cx+12,cy+107]],'#667579',4);
          for(let k=0;k<3;k++)line(c,[[cx-3-k*2,cy+12+k*26],[cx+7+k*2,cy+37+k*26],[cx-5-k*2,cy+38+k*26]],'#72817e',2);
        }
        for(let i=0;i<stops.length;i++)if(Math.abs(pos-stops[i])<155)station(c,stops[i],i);
        const path=[];for(let d=pos-140;d<pos+175;d+=4)path.push(project(d));line(c,path,'#3b4c55',2.3);
        line(c,path.map(([a,b])=>[a+4,b-4]),'#606e76',1.1);cabin(c);
        const distance=Math.max(0,(stops[idx]??pos)-pos);
        const braking=distance<=speed*speed/(2*brakeRate)+2&&speed>1&&!dwell;
        panel(c,14,14,222,56,'#343c4be8');caption(c,'NEXT STOP',28,31,'#dbc9b9',15,'left');
        caption(c,names[idx]??'TERMINUS',28,54,'#fff0d5',19,'left');
        panel(c,13,322,454,70,'#303e4bed');
        caption(c,dwell?'AT PLATFORM':Math.round(distance)+' m',29,345,'#ffdfae',21,'left');
        caption(c,braking?'BRAKE NOW':Math.round(speed*3.6)+' km/h',451,344,braking?'#ffb190':'#e0ebda',18,'right');
        meter(c,29,367,422,idx>=5?1:1-distance/(stops[idx]-(stops[idx-1]??0)),'#ecc68c','#667379');
        if(noticeTime>0){panel(c,86,274,308,31,'#39454cde');caption(c,notice,240,290,'#fff1d0',15);}
        ['BRAKE','COAST','DRIVE'].forEach((s,i)=>{
          panel(c,7+i*158,406,150,57,mode===i?'#f4c998':'#45545e');
          caption(c,s,82+i*158,435,mode===i?'#3a4249':'#f3e8d7',19);
        });
      },
    };
  },
};
