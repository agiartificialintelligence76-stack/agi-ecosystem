import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/nightpress/game.js';
import {DECALS,ISSUES,issueFor} from '../src/games/nightpress/issues.js';
import {PROOFS} from '../src/games/nightpress/proofs.js';
import {bits,geometry,rotCells,evaluate,placementsFor,solve,permutations,placementOf} from '../src/games/nightpress/press.js';
import {createDesk,choose,turn,nudge,drop,depth,undo,pull,reopen,cover,begin,deadline,rushIssue,nextRush,swapMotif} from '../src/games/nightpress/editor.js';
import {readBinder,fileArt,removeArt,recoverArt,renameArt,earned,nextIssue,readCover} from '../src/games/nightpress/binder.js';
import {layout,rackSlots} from '../src/games/nightpress/desk-art.js';
import {pressSound,CUES} from '../src/games/nightpress/sound.js';
import {certify} from '../tools/games/nightpress/certify.mjs';
const P=(id,x,y,turn=0)=>({id,x,y,turn}),b=()=>readBinder({});
function apply(d,ps){for(const p of ps){choose(d,p.id);Object.assign(d.cursor,{x:p.x,y:p.y,turn:p.turn});assert.ok(drop(d));}}
function shapeIssue(pieces,rules=[]){return {...ISSUES[0],pieces,rules,coverage:1,head:[]};}
function testing(mode='campaign',saved={},seed=7,demo=false){
 let end,actions=[],tts=[],tones=0;const model=game.create({seed,mode,options:{},demo,audio:{tone(){tones++;},noise(){tones++;}},store:{read:()=>saved,update(fn){saved=fn(saved);}},controls:a=>actions=a,say:t=>tts.push(t),end:(score,stats)=>{end={score,stats};}});
 return {model,get end(){return end;},get actions(){return actions;},get saved(){return saved;},get tones(){return tones;},tts};
}
test('36 handmade issues carry exact independently reproducible bounded solver certificates',()=>{
 const actual=certify();assert.deepEqual(actual,PROOFS);assert.equal(ISSUES.length,36);assert.equal(new Set(ISSUES.map(q=>q.title)).size,36);
 for(const q of actual){
  const issue=ISSUES[q.id];assert.ok(q.distinct>=2);assert.equal(q.par,issue.pieces.length);
  const a=q.witnesses.map(w=>{const d=createDesk(issue);const partial=w.slice(0,-1);apply(d,partial);assert.ok(d.checks.failed.includes('stock'));apply(d,w.slice(-1));assert.equal(pull(d).stars,3);return d.checks.occupied;});assert.notEqual(a[0],a[1]);
 }
});
test('complete reference BFS on two miniature covers matches optimized counts and pars',()=>{
 for(const rules of [[],['corner']]){
  const issue={...shapeIssue(['stamp','foil'],rules),w:3,h:3,head:[1]},c=solve(issue),sets=issue.pieces.map(id=>placementsFor(issue,id));
  // BFS adds one fresh sticker to the top at each edge. A complete 2-sticker
  // layout first appears at depth two; all orderings and placements are visited.
  let frontier=[[]],minimum=null,found=0;const visual=new Set();
  for(let i=0;i<=2;i++){const next=[];for(const q of frontier){const e=evaluate(issue,q);if(!e.failed.length){minimum??=i;found++;visual.add(e.occupied);}
   if(i<2)for(const rack of sets)if(!q.some(p=>p.id===rack[0].id))for(const p of rack)next.push([...q,p]);}frontier=next;}
  assert.equal(c.par,minimum);assert.equal(c.solutions,found);assert.equal(c.distinct,visual.size);
 }
});
test('turning a die cut preserves material, independently rotates eye/window coordinates',()=>{
 const f=rotCells('agi',0),r=rotCells('agi',1);assert.equal(f.w,r.h);assert.equal(f.h,r.w);
 for(const p of f.points)assert.ok(r.points.some(q=>q.x===f.h-p.y-1&&q.y===p.x&&q.ch===p.ch));
 const issue=shapeIssue(['frame']);const a=geometry(issue,P('frame',1,1));assert.equal(bits(a.mask),8);assert.equal(bits(a.hole),1);assert.equal(a.hole&a.mask,0);
});
test('opaque paper obscures a masthead, clear film prints over the same cell',()=>{
 const issue={...shapeIssue(['agi','film']),head:[1]};assert.equal(evaluate(issue,[P('agi',0,0)]).pass.head,false);
 assert.equal(evaluate(issue,[P('film',0,0)]).pass.head,true);
});
test('both protected eyes account for clipping, clear film and the order of opaque overlays',()=>{
 const i=shapeIssue(['agi','film','foil'],['eyes']);const face=P('agi',1,1),film=P('film',1,1),seal=P('foil',1,1);
 assert.equal(evaluate(i,[face,film]).visibleEyes,2);assert.equal(evaluate(i,[face,seal]).visibleEyes,1);assert.equal(evaluate(i,[seal,face]).visibleEyes,2);
 assert.equal(evaluate(i,[P('agi',-1,1)]).pass.eyes,false);
});
test('a punched ring requires printed lower art; a solid cover can block the window',()=>{
 const i=shapeIssue(['agi','frame','foil'],['window','eyeWindow']),a=P('agi',1,1),r=P('frame',0,0),f=P('foil',1,1);
 assert.ok(evaluate(i,[a,r]).pass.eyeWindow);assert.equal(evaluate(i,[a,r,f]).pass.window,false);
 assert.equal(evaluate(i,[r,a]).pass.window,false);
});
test('transparent ink bridges artwork, top foil seal actually touches art below',()=>{
 const i=shapeIssue(['agi','film','foil'],['film','top']),p=[P('agi',1,1),P('film',1,1),P('foil',2,1)];
 assert.ok(evaluate(i,p).pass.top);assert.ok(evaluate(i,p).pass.film);assert.equal(evaluate(i,[p[1],p[0],p[2]]).pass.film,false);assert.equal(evaluate(i,[p[0],p[2],p[1]]).pass.top,false);
 assert.equal(evaluate(i,[p[0],p[1],P('foil',4,4)]).pass.top,false);
});
test('cardinal contact fails separation, diagonal kisses are allowed, overlap cannot masquerade as a kiss',()=>{
 const i=shapeIssue(['foil','stamp'],['corner']),p=P('stamp',2,2);
 assert.equal(evaluate(i,[p,P('foil',1,1)]).pass.corner,true);assert.equal(evaluate(i,[p,P('foil',1,2)]).pass.apart,false);
 assert.equal(evaluate(i,[p,P('foil',2,2)]).pass.corner,false);
});
test('a fold sees real positions, coverage counts unique occupied cells and clips never teleport',()=>{
 const i=shapeIssue(['stamp','foil'],['order','gutter']);assert.ok(evaluate(i,[P('stamp',0,2),P('foil',4,2)]).pass.order);
 assert.equal(evaluate(i,[P('stamp',0,2),P('foil',2,2)]).pass.gutter,false);assert.equal(evaluate(i,[P('stamp',0,2),P('foil',0,2)]).count,3);
 assert.equal(geometry(i,P('stamp',-2,2)),null);const j=shapeIssue(['ticket'],['clip']);assert.ok(geometry(j,P('ticket',-1,1)).cut);assert.equal(evaluate({...j,rules:[]},[P('ticket',-1,1)]).pass.trim,false);
});
test('moving a lifted preview is free; released transforms and depth changes cost a peel',()=>{
 const d=createDesk(ISSUES[0]);nudge(d,1,0);turn(d);turn(d,-1);assert.equal(d.moves,0);
 apply(d,PROOFS[0].witnesses[0]);const before=JSON.stringify(d.layers);choose(d,'agi');assert.ok(depth(d,1));assert.equal(d.moves,3);
 assert.ok(undo(d));assert.equal(JSON.stringify(d.layers),before);assert.equal(d.moves,3);assert.equal(pull(d).stars,2);
});
test('failed proof revises in place; five extra committed placement edits only earn one star',()=>{
 const d=createDesk(ISSUES[0]);assert.equal(pull(d),null);assert.ok(d.checks.failed.includes('stock'));d.phase='desk';
 apply(d,PROOFS[0].witnesses[0]);for(let i=0;i<3;i++){choose(d,'agi');depth(d,1);depth(d,-1);}
 assert.equal(pull(d).stars,1);
});
test('gallery normalizes transforms, preserves stock and names, edit/remove/undo restore last original',()=>{
 const d=createDesk(ISSUES[0]);apply(d,PROOFS[0].witnesses[0]);const doc=cover(d,'Butterfly news','Still warm.'),book=b();
 const id=fileArt(book,doc);assert.ok(id);assert.equal(fileArt(book,{...doc,title:'Second proof'},id),id);assert.equal(book.gallery.length,1);assert.ok(recoverArt(book));assert.equal(book.gallery[0].title,'Butterfly news');
 assert.ok(renameArt(book,id,'My shelf'));assert.ok(removeArt(book,id));assert.equal(book.gallery.length,0);assert.ok(recoverArt(book));assert.equal(book.gallery[0].title,'My shelf');
 assert.deepEqual(reopen(book.gallery[0]).layers,d.layers);assert.deepEqual(readBinder({pressBinder:book}).gallery,book.gallery);
});
test('full shelf replaces one slot with a recoverable last cover; malformed stored data is bounded',()=>{
 const d=createDesk(ISSUES[0]);apply(d,PROOFS[0].witnesses[0]);const doc=cover(d),book=b();
 for(let i=0;i<12;i++)fileArt(book,{...doc,title:'Issue '+i});const safe=book.gallery[0];fileArt(book,{...doc,title:'Replacement'});assert.equal(book.gallery.length,12);assert.ok(recoverArt(book));assert.deepEqual(safe,book.gallery[0]);
 assert.equal(readCover({...doc,pieces:['unknown']}),null);assert.equal(readCover({...doc,layers:[P('agi',300,5)]}),null);
 assert.deepEqual(readBinder({pressBinder:{gallery:[null,{}],stars:[0,3],rush:-32}}).gallery,[]);assert.equal(nextIssue(readBinder({pressBinder:{stars:[0,3]}})),0);
});
test('earned motifs and editorial options follow actual cleared issues',()=>{
 const book=b();assert.ok(!earned(book).includes('moon'));assert.equal(begin('campaign',book,48,'35').desk.issue.id,0);
 for(let j=0;j<6;j++)book.stars[j]=2;assert.equal(nextIssue(book),6);assert.ok(earned(book).includes('moon'));assert.equal(begin('campaign',book,48,'35').desk.issue.id,6);
 const d=begin('studio',book,7).desk;choose(d,d.issue.pieces[0]);assert.ok(swapMotif(d,book));assert.equal(new Set(d.issue.pieces).size,d.issue.pieces.length);
});
test('daily and Rush use bounded seeded solvable material',()=>{
 assert.equal(issueFor(20261118).id,issueFor(20261118).id);const list=new Set();
 for(let i=0;i<366;i++){const q=issueFor(20260101+i);list.add(q.id);assert.ok(PROOFS[q.id].distinct>1);}assert.ok(list.size>=20);
 const s=begin('rush',b(),785);for(let i=0;i<10;i++){assert.equal(s.desk.issue.id,rushIssue(785,i).id);assert.ok(s.left>=45&&s.left<=75);nextRush(s);}
});
test('normal published 3-star opener is reachable with keyboard alone',()=>{
 const h=testing(),key=k=>h.model.key('down',k);
 for(const k of ['Digit1','ArrowRight','ArrowRight','ArrowUp','ArrowUp','Enter','Digit2','ArrowLeft','ArrowUp','Enter','Space','Space'])key(k);
 assert.equal(h.end.score,340);assert.equal(h.saved.pressBinder.stars[0],3);assert.equal(h.saved.pressBinder.gallery.length,0);
});
test('touch survives resize without committing an interrupted drag, then prints at a different size',()=>{
 const h=testing(),m=h.model,w=360,hh=440;let l=layout(w,hh-37);const cell=(a,x,y)=>[a.gx+(x+.4)*a.cell,a.gy+(y+.4)*a.cell];
 m.pointer('down',...cell(l,1,1),w,hh);m.pointer('cancel',0,0,w,hh);m.action('pick-agi','down');m.pointer('down',...cell(l,3,0),w,hh);m.pointer('up',...cell(l,3,0),w,hh);
 l=layout(920,503);m.action('pick-ticket','down');m.pointer('down',...cell(l,0,1),920,540);m.pointer('up',...cell(l,0,1),920,540);m.action('print','down');m.action('file','down');
 assert.equal(h.end.score,340);assert.ok(rackSlots(layout(1400,760),createDesk(ISSUES[0])).length>=2);
});
test('Rush deadline freezes on pause and eventually ends honestly',()=>{
 const q=testing('rush');q.model.pause();q.model.update(200);assert.equal(q.end,undefined);q.model.resume();q.model.update(200);assert.equal(q.end.score,0);
});
test('actual demo and disposed model never save or make a sound',()=>{
 const q=testing('campaign',{},7,true);for(let i=0;i<840;i++){q.model.demo(1/60);q.model.update(1/60);}
 assert.ok(q.end);assert.equal(q.tones,0);assert.deepEqual(q.saved,{});q.model.dispose();q.model.action('print','down');assert.deepEqual(q.saved,{});
 const ns=[],mix=pressSound({tone:q=>ns.push(q),noise:q=>ns.push(q)});for(const k of Object.keys(CUES))mix.play(k,1);assert.ok(ns.length<10);mix.update(1,0);assert.equal(ns.at(-1).bus,'music');mix.pause();const n=ns.length;mix.play('foil',4);assert.equal(n,ns.length);
});
