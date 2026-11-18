export function targets(balls,seat){const suit=seat===0?'sun':'stripe',own=balls.filter(b=>!b.potted&&b.suit===suit);return (own.length?own:balls.filter(b=>!b.potted&&b.suit==='moon')).map(b=>b.id);}
export function ruling(before,log,seat,called,condition=0){
 const eligible=targets(before,seat),moon=before.find(b=>b.suit==='moon')?.id;
 const scratch=log.pots.some(p=>p.id===0),wrong=!eligible.includes(log.first),moonPot=log.pots.find(p=>p.id===moon);
 const foul=scratch?'scratch':wrong?'wrong':!log.pots.length&&!log.rails.some(r=>r.after)?'no rail':moonPot&&(!eligible.includes(moon)||moonPot.pocket!==called||condition===1&&!log.rails.some(r=>r.id===moon)||condition===2&&![1,4].includes(called))?'uncalled':'';
 const own=log.pots.filter(p=>eligible.includes(p.id)),win=!foul&&moonPot&&eligible.includes(moon)&&moonPot.pocket===called;
 return {foul,win:!!win,keep:!foul&&own.length>0,own:own.length,returnMoon:!!moonPot&&!win,ballInHand:!!foul};
}
export function featMet(card,input,log){
 if(!log.pots.some(p=>p.id===card.target&&p.pocket===card.pocket)||log.pots.some(p=>p.id===0))return false;
 switch(card.feat){case 'bank':return log.rails.some(r=>r.id===card.target);case 'combo':return log.contacts.some(([a,b])=>a!==0&&b!==0);
 case 'draw':return input.spin<-.34;case 'follow':return input.spin>.34;case 'soft':return input.power<.60;case 'cut':return log.first===1;
 case 'called':return input.called===card.pocket;default:return true;}
}
