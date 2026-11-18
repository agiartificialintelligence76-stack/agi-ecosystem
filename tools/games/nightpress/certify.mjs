import {writeFileSync} from 'node:fs';
import {ISSUES} from '../../../src/games/nightpress/issues.js';
import {solve,evaluate} from '../../../src/games/nightpress/press.js';
export function certify(){
 return ISSUES.map(issue=>{
  const q=solve(issue);if(q.distinct<2)throw new Error(issue.title+' has '+q.distinct+' distinct compositions');
  for(const w of q.witnesses)if(evaluate(issue,w).failed.length)throw new Error('Proof does not print: '+issue.title);
  return q;
 });
}
if(import.meta.url===new URL('file:///'+process.argv[1]?.replaceAll('\\','/')).href || process.argv[1]?.endsWith('certify.mjs')){
 const rows=certify();
 if(process.argv.includes('--write'))writeFileSync(new URL('../../../src/games/nightpress/proofs.js',import.meta.url),'// Generated with tools/games/nightpress/certify.mjs --write.\nexport const PROOFS='+JSON.stringify(rows,null,1)+';\n');
 console.log(rows.map(q=>[q.id+1,ISSUES[q.id].title,q.par,q.solutions,q.distinct].join(' · ')).join('\n'));
}
