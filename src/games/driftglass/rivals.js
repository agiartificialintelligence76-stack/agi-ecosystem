export const RIVALS=[
 {name:'Learner',call:'NEW DRIVER',body:'#ec89ac',style:'Gives ground',tell:.9,reaction:.40,aim:.24,evade:.42},
 {name:'Tailgater',call:'IN YOUR WAKE',body:'#ffb37e',style:'Drafts first',tell:.82,reaction:.30,aim:.18,evade:.57},
 {name:'Blink',call:'DOUBLE FLASH',body:'#e294cb',style:'Fakes a signal',tell:.77,reaction:.27,aim:.15,evade:.66},
 {name:'Night Courier',call:'EXPRESS MAIL',body:'#e99c9e',style:'Holds boost in reserve',tell:.70,reaction:.22,aim:.14,evade:.68},
 {name:'Switchback',call:'LEFT BANK',body:'#e8b381',style:'Cuts at the arch',tell:.67,reaction:.21,aim:.12,evade:.76},
 {name:'Side-B AGI',call:'SIDE B',body:'#ed91c1',style:'Remembers your counters',tell:.61,reaction:.18,aim:.09,evade:.82},
];
export const MEETS=[
 ['Mirror Check',0,0,24],['Slipstream FM',1,1,26],['Double Exposure',2,2,27],
 ['Express Delivery',3,3,29],['Arch Rival',4,0,30],['Side A Finale',5,1,31],
 ['Parking Ticket',0,2,30],['Crosswind',1,3,31],['Blush Signal',2,0,32],
 ['Night Mail',3,1,33],['Last Exit',4,2,34],['Antennas Up',5,3,35],
].map(([title,rival,district,target],i)=>({id:i,title,rival,district,target,flip:i>=6}));
