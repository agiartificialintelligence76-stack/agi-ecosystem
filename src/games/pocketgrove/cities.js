// Stop numbers only identify platform entries inside one city. Each city has
// its own geography, services, working evening and handwritten window notes.
export const CITIES=[
 {name:'Lantern Quay',color:'#df714b',sky:['#91d3d1','#f7d79d'],type:'quay',home:'Lamp House',
  stops:['Lamp House','Crust Street','West Lantern','Maple Green','Sleeve Alley','Harbor Steps','Salt Baths','Kite Beach'],
  xy:[[.14,.62],[.23,.32],[.46,.26],[.67,.20],[.84,.47],[.70,.78],[.44,.76],[.83,.83]],
  services:[['Honey local','0134520',6,0,3],['Harbor local','0254310',7,1,3],['Shore loop','567453',8,2,4],['Seagull Ltd','0470',15,7,3]],
  nights:[['Bakery Lights',1,4,3],['Low Tide Letters',6,2,5],['Last Beach Train',7,3,1]]},
 {name:'Prism Ward',color:'#9974bc',sky:['#9fb6d6','#f5cba1'],type:'tower',home:'Glass Hall',
  stops:['Glass Hall','Lilac Kiosk','North Prism','Mallow Park','B-side Books','South Prism','Ribbon Steps','Blue Arcade'],
  xy:[[.13,.47],[.28,.18],[.48,.26],[.71,.16],[.85,.48],[.50,.65],[.33,.82],[.75,.82]],
  services:[['Glass local','012320',6,0,3],['South loop','0567450',7,1,3],['Footbridge','2542',6,2,3],['Ribbon Ltd','02750',14,5,2]],
  nights:[['Glass Kiosk',1,5,2],['Footbridge Notes',3,7,6],['Two Terminals',4,2,7]]},
 {name:'Paper Heights',color:'#568981',sky:['#87bdcd','#f6dba2'],type:'cliff',home:'Paper Square',
  stops:['Paper Square','Fold Bakery','Ink Landing','Cloud Garden','Pressed Wax','Valley Floor','Upper Fold','Paper Summit'],
  xy:[[.15,.69],[.20,.43],[.42,.41],[.61,.24],[.83,.43],[.56,.76],[.75,.67],[.86,.16]],
  services:[['Valley local','012450',7,0,3],['Ridge local','0543210',8,3,3],['Funicular','26762',9,1,4],['Fold Ltd','0370',17,5,3]],
  nights:[['The Fold',1,2,6],['Counterweight',6,4,7],['Summit Appointment',7,3,5]]},
 {name:'Orchard Ring',color:'#779453',sky:['#a4cfac','#ffe0a3'],type:'orchard',home:'Cider Gate',
  stops:['Cider Gate','Little Oven','Apple Cross','Picnic Field','Sleeve Grove','Dusk Market','North Fork','Observatory'],
  xy:[[.15,.48],[.30,.21],[.56,.20],[.78,.30],[.83,.59],[.57,.78],[.32,.76],[.88,.12]],
  services:[['Clockwise','01234560',7,0,3],['Counterloop','06543210',8,2,3],['Star branch','23732',11,2,4],['Orchard Ltd','0470',16,6,3]],
  nights:[['Apple Cross',2,5,1],['Night Picnic',3,6,4],['Telescope Hour',7,4,2]]},
 {name:'Bell Harbor',color:'#587aab',sky:['#8397c6','#efbd9e'],type:'ferry',home:'Bell Terminal',
  stops:['Bell Terminal','Steam Buns','East Bell','Rain Park','Echo Sleeves','Pier Nine','Island Gate','Ferry Lights'],
  xy:[[.15,.30],[.32,.22],[.52,.27],[.76,.19],[.85,.44],[.64,.52],[.38,.77],[.72,.82]],
  services:[['Bell local','0123450',7,0,3],['Pier local','0543210',9,2,3],['Night ferry','56765',13,1,5],['Moon Ltd','0260',19,8,3]],
  nights:[['Bell Terminal',1,5,3],['Island Supper',6,2,4],['Last Ferry Home',7,4,6]]},
];
export const NIGHTS=CITIES.flatMap((c,city)=>c.nights.map(([name,a,b,star],shift)=>({id:city*3+shift,city,shift,name,wishes:[a,b],star})));
export const LANDMARKS=['platform clock','bakery window','station tiles','garden lantern','sleeve display','night market','painted steps','skyline lights'];
export const POSTCARDS=[
 ['warm flour on the platform','a lantern caught in the glass','salt in the air all the way home'],
 ['the whole station changes color','a bridge between two reflections','the glass kept our last light'],
 ['six paper birds above the square','the hill folds into the clouds','all those stairs look small from here'],
 ['apple blossoms on the rail','the picnic stars came out early','the telescope points at our train'],
 ['i can hear all five bells','the island sent back a little echo','we waved at our reflection in the ferry'],
];
export const cityForWeek=(day=Date.now())=>((Math.floor((Number(day)/86400000+3)/7)%CITIES.length)+CITIES.length)%CITIES.length;
