import {PLACES,BY_ID} from './assignments.js';
import {LINES} from './lines.js';
import {readRecipe,printOf} from './run.js';
export function readAlbum(raw={}){
 const a=raw?.photoBook||{},rows=PLACES.map((_,i)=>{
  const seen=new Set();return (Array.isArray(a.rows?.[i])?a.rows[i]:[]).slice(0,3).flatMap(q=>{
   const r=readRecipe(q?.recipe);if(!r||BY_ID[r.id].place!==i||seen.has(r.key))return [];seen.add(r.key);return [{recipe:r,pinned:q.pinned===true,frame:['film','foil'].includes(q.frame)?q.frame:'paper',comment:Object.hasOwn(LINES,q.comment)?q.comment:printOf(r).note}];
  });
 }),stars=PLACES.map((_,i)=>[1,2,3].includes(a.stars?.[i])?a.stars[i]:0);
 const blank=stars.findIndex(n=>!n);if(blank>=0)stars.fill(0,blank+1);
 const unlocked=blank<0?7:blank;
 return {v:1,rows,stars,unlocked,captions:PLACES.map((_,i)=>typeof a.captions?.[i]==='string'?a.captions[i].slice(0,70):''),
  daily:typeof a.daily?.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(a.daily.date)&&Number.isFinite(a.daily.score)?{date:a.daily.date,score:Math.max(0,Math.round(a.daily.score))}:null,
  last:a.last&&Number.isInteger(a.last.seed)&&Number.isInteger(a.last.roll)&&a.last.roll>=0&&a.last.roll<=unlocked?{...a.last}:null};
}
export function filePrint(book,print){
 const i=print.scene.a.place,rows=book.rows[i];if(rows.some(f=>f.recipe.key===print.recipe.key))return;
 if(rows.length<3){rows.push({recipe:print.recipe,pinned:false,frame:'paper',comment:print.note});return;}
 const candidates=rows.map((r,index)=>({index,score:printOf(r.recipe).grade.score,pin:r.pinned})).filter(v=>!v.pin).sort((a,b)=>a.score-b.score);
 if(candidates.length&&print.grade.score>candidates[0].score)rows[candidates[0].index]={recipe:print.recipe,pinned:false,frame:'paper',comment:print.note};
}
export function archive(raw,config,res,date){
 const book=readAlbum(raw);for(const p of res.prints)filePrint(book,p);
 if(config.mode==='campaign'&&config.roll<=book.unlocked){
  book.stars[config.roll]=Math.max(res.grade,book.stars[config.roll]);book.captions[config.roll]=res.spread;book.last={seed:config.seed,roll:config.roll};
 }
 if(config.mode==='daily'&&(book.daily?.date!==date||res.score>book.daily.score))book.daily={date,score:res.score};
 return readAlbum({photoBook:book});
}
export function flipPin(raw,key){
 const book=readAlbum(raw);for(const row of book.rows)for(const entry of row)if(entry.recipe.key===key){entry.pinned=!entry.pinned;return book;}return book;
}
export function selectedRoll(book,choice,seed,practice=false){
 const next=practice?Math.max(0,book.unlocked-(book.stars[7]?0:1)):book.last?.seed===seed?book.last.roll:book.unlocked;
 const cap=practice?Math.max(0,book.unlocked-(book.stars[7]?0:1)):book.unlocked;
 return choice==null||choice==='next'?next:Math.min(cap,Math.max(0,Number(choice)||0));
}

export function frameStyles(book){const rolls=book.stars.filter(Boolean).length;return ['paper',...(rolls>=1?['film']:[]),...(rolls>=4?['foil']:[])];}
export function turnFrame(raw,key){const book=readAlbum(raw),frames=frameStyles(book);for(const p of book.rows.flat())if(p.recipe.key===key){p.frame=frames[(frames.indexOf(p.frame)+1)%frames.length];break;}return book;}
