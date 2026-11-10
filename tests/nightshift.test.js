import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/games/nightshift/logic.js';
const tick=(s,sec)=>{for(let t=0;t<sec;t+=1/60)L.step(s,1/60);};
function drink(s,items,p=.66){L.clearCup(s);items.forEach(i=>L.addIngredient(s,i));L.startBrew(s);tick(s,p*2.1);L.finishBrew(s);}
test('nightshift repeats guest recipes for a seed',()=>{assert.deepEqual(L.createShift(4,42),L.createShift(4,42));assert.notDeepEqual(L.createShift(4,42).customers,L.createShift(4,93).customers);});
test('nightshift ingredients are bounded; brewing locks the cup',()=>{const s=L.createShift();assert.equal(L.startBrew(s),false);assert.equal(L.addIngredient(s,'missing'),false);['bean','milk','ice'].forEach(i=>assert.ok(L.addIngredient(s,i)));assert.equal(L.addIngredient(s,'tea'),false);L.startBrew(s);assert.equal(L.addIngredient(s,'bean'),false);});
test('nightshift perfect timing makes a better drink than an early stop',()=>{const a=L.createShift(),b=L.createShift();drink(a,['bean'],.66);drink(b,['bean'],.1);assert.equal(a.drink.quality,1);assert.equal(b.drink.quality,.4);});
test('nightshift recipes ignore order but retain ingredient quantities',()=>{assert.ok(L.sameRecipe(['milk','bean'],['bean','milk']));assert.equal(L.sameRecipe(['milk','milk'],['milk']),false);});
test('nightshift wrong drink keeps the guest and cup but loses patience',()=>{const s=L.createShift();const c=s.customers[0],before=c.patience;drink(s,['tea']);assert.equal(L.serve(s,c.id),false);assert.ok(s.drink);assert.equal(s.served,0);assert.ok(c.patience<before);});
test('nightshift serving clears the cup, scores, and selects next guest',()=>{const s=L.createShift(),c=s.customers[0];drink(s,L.RECIPES[c.recipe].items);assert.ok(L.serve(s,c.id));assert.equal(s.served,1);assert.equal(s.cup.length,0);assert.equal(s.drink,null);assert.ok(s.score>100);assert.ok(s.selected!==c.id);});
test('nightshift clear resets a brewing or finished cup',()=>{const s=L.createShift();drink(s,['bean']);L.clearCup(s);assert.equal(s.drink,null);assert.deepEqual(s.cup,[]);assert.equal(s.brew,null);});
test('nightshift three missed guests end service and completed states freeze',()=>{const s=L.createShift();tick(s,95);assert.equal(s.phase,'over');const before=structuredClone(s);tick(s,5);assert.deepEqual(s,before);});
test('nightshift every authored shift can be completed by legal preparation',()=>{for(let n=0;n<8;n++){const s=L.createShift(n,7);let next=0;for(let t=0;t<180&&s.phase==='play';t+=1/60){L.step(s,1/60);next-=1/60;if(next<=0){next=.13;L.auto(s);}}assert.equal(s.phase,'won',`shift ${n+1}: ${s.served}/${s.target}`);assert.equal(s.missed,0);}});
test('nightshift endless drinks replenish time without completing a finite target',()=>{const s=L.createShift(7,7,true);const c=s.customers[0];drink(s,L.RECIPES[c.recipe].items);const before=s.time;L.serve(s,c.id);assert.ok(s.time>before);assert.equal(s.phase,'play');});
