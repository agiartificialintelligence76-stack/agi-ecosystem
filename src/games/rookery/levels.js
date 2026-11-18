import { buildBoard } from './rules.js';

export const WORLDS=[
 {name:'Laptop',look:'Soft touch',body:'#778dbe',key:'#dce4ef',accent:'#ffd66e',lamp:'#f4d993',intro:'Nudge from behind. Call down a clear row.'},
 {name:'Mechanical',look:'Mint switches',body:'#7caf9b',key:'#f4e8bf',accent:'#75e5c4',lamp:'#9eded1',intro:'Mint keys are slick. The next dry cap stops her.'},
 {name:'Numpad',look:'Red diode',body:'#897eb0',key:'#e2d5ec',accent:'#ff858c',lamp:'#d6ade7',intro:'Aim a dot on a marked cap. She takes one step per turn.'},
 {name:'Writer’s desk',look:'Ribbon keys',body:'#bb9073',key:'#ffe9cf',accent:'#eea697',lamp:'#ffd493',intro:'The cat types only where her paws come to rest.'},
 {name:'Giant piano',look:'Night recital',body:'#746e94',key:'#fff1d2',accent:'#bcb1ff',lamp:'#d7b8f3',intro:'A shy cat creeps toward a visible moon when you look away.'},
];
// @ = her start, c = the cat, o = the moon. # is a tall divider, : is a
// cat-sized ledge. * is a selectable laser mark; ~ is a polished key.
const nap=(name,tip,map,feature,extra={})=>({name,tip,map,feature,...extra});
const chapters=[
 [
  nap('Sleep Button','Walk right. Her moon is one key away.',['....','@co.','..#.'],'push'),
  nap('Two Seats','Call twice. Her ears work across a whole row.',['c.o@','.#..'],'call'),
  nap('Screen Hinge','Step around the hinge before calling.',['c.o..','.#...','.@...'],'call'),
  nap('Space Bar','Get under her first, then find room at the edge.',['.#.o.','..c..','@..#.'],'push'),
  nap('Home Row','Give her room between you and the moon.',['.c...','.#.#.','..o@.','....#'],'call'),
  nap('Function Lock','A cat on an outside edge can still hear you.',['c.o#.','.....','##.#.','@....'],'call'),
  nap('Delete Later','Keep a listening lane open along the edge.',['#.c..','.@##.','....o','..#..'],'call'),
  nap('Close the Lid','The short way around the hinge is hers.',['c....','..##.','.@#..','...o.'],'call'),
 ],[
  nap('Fresh Wax','Push across the mint stripe. Dry caps have grip.',['.....','@c~o.','.#...'],'slide'),
  nap('End Stop','A raised cap catches a sliding cat.',['..c~~#','....#.','.#..@.'],'slide',{home:4}),
  nap('Short Slide','See where the mint rail meets solid plastic.',['@...#','..c~.','.#.#o','.....'],'slide'),
  nap('Caps Lock','Call from beyond the polished run.',['c~~o.','#.#..','@....'],'slide'),
  nap('Switch Tester','Take the first slide, then work across it.',['@.##.','..c~.','.#.~o','.....'],'slide'),
  nap('Space Cadet','A slide stops one cap short of her shoes.',['c~~..','.#..#','..o@.','.##..'],'slide'),
  nap('Double Click','Two short dry landings divide the slick lane.',['.#..o','..~..','c~.~.','.##.@'],'slide'),
  nap('Last Keycap','Try the vertical mint lane before the horizontal one.',['@..#.','.#.c.','..~~.','o~~#.','.....'],'slide'),
 ],[
  nap('Little Red Dot','Tap the numbered laser cap, then wait for a pawstep.',['@#c:o*','##:.#.','##...#'],'laser'),
  nap('Around Five','Use one dot for each axis of the bend.',['@#..*.','##:.o.','##c::*'],'laser'),
  nap('Dot Behind Glass','A divider interrupts the laser sight line.',['@#c.#.*','##:##.:','##*..o*'],'laser'),
  nap('Tiny Hunter','Change the dot before she passes the junction.',['@#c::*','##::.:','#*.o:*'],'laser'),
  nap('Zero Key','Lead her up from the lowest row, then across.',['@#*..o*','##:##..','##:.#..','##:..#.','##c.:..'],'laser'),
  nap('Diagonal Wish','Neither cat nor dot can cut diagonally.',['@#*..o*','###.#.:','##..#.:','##.##.:','##c:::*'],'laser'),
  nap('Dot Slide','A chase can carry her over mint keys.',['@#c~.*','##..#.','#*..o*'],'laser'),
  nap('Arithmetic','Thread the narrow passages on both sides.',['@#c...*','######:','##*...*','###.###','###*.o*'],'laser'),
 ],[
  nap('Type a Z','Walk the cat onto Z before settling on the moon.',['@coZ.','.....'],'word',{word:'Z'}),
  nap('Two Zs','Leave Z and land on it again.',['@...','cZ.o','....'],'word',{word:'ZZ'}),
  nap('Nap Time','The ribbon reads from left to right.',['@...o','..c.A','.#N..','.....'],'word',{word:'NA'}),
  nap('Correction','A wrong letter can become the start of a new draft.',['@...#','Nc.Z.','..#.A','....o'],'word',{word:'NA'}),
  nap('Long Word','Walk her past the tempting letter in the middle.',['...o.','NA#..','..c..','P@.Z.'],'word',{word:'NAP'}),
  nap('Two Ways Home','Two keys carry the same letter. Pick an exit.',['@A..#','..cN.','.#A.o','...P.'],'word',{word:'NAP'}),
  nap('Ink on Ice','She types the landing letter, never the slick cap she crosses.',['@.o..','c~A.#','.#.N.','Z....'],'word',{word:'AN'}),
  nap('Sleep Draft','Write the whole word, then close the lid.',['@....','.Z#N.','..c..','A.#P.','...o.'],'word',{word:'NAP'}),
 ],[
  nap('Eyes Away','Turn away and listen. She can see her moon from here.',['@::c.o','###.##'],'autonomous',{face:1}),
  nap('Sneak a Peek','She holds the note while you watch her.',['@c::o','#.#..'],'autonomous',{face:1}),
  nap('Black Keys','The raised black key blocks your sight line.',['@#...o','..#:#.','.c:..*','..#*.#'],'autonomous',{face:1}),
  nap('Duet Bench','Walk around the bench while she takes her turns.',['.@.##..','.o#..##','.#..#..','..c~..*','..:...*','..*....'],'autonomous',{face:1}),
  nap('Silent Dot','Place her lure before you look away.',['@::c::*','####.#:','##*...*','##.o##.','##.*...'],'autonomous',{face:1}),
  nap('Soft Pedal','Stop the slide before the moon comes into sight.',['@::c~.*','######:','##*...*','##:##.#','##*.o.*'],'autonomous',{face:1}),
  nap('Lullaby','Two letters, two pawsteps, then a held moon note.',['@.A..','.#c.N','..#..','..o..'],'autonomous',{word:'AN',face:0}),
  nap('Goodnight Chord','Set a dot, look away and let the last note ring.',['@o.#.','.cA.*','.#.~.','*..N.','.....'],'autonomous',{word:'AN',face:1}),
 ],
];
const extras=[
 nap('Night Shift','The last clean listening lane runs up the right edge.',['.c...#','..#.o.','.#.#..','.##...','@.....'],'call'),
 nap('Switch Sampler','Five polished caps share two dry landings.',['....#.','c~~...','.#.~~.','..#.~~','..@.o.'],'slide'),
 nap('Decimal Point','Three dot marks make a route around the divider.',['@#c::*#','#####:#','##*::*#','##:####','##*.o.*'],'laser'),
 nap('Carbon Copy','Write the last two letters twice in the right order.',['.@...o','.Z.#A.','.#c...','A...Z.','..#...'],'word',{word:'ZAZ'}),
 nap('Last Train Lullaby','A soft key, a red dot and a quietly completed note.',['@.A..*','..#c..','.o.~N.','.*#...','......'],'autonomous',{word:'AN',face:2}),
];
export const SPECS=[...chapters.flatMap((volume,world)=>volume.map((p,n)=>({...p,world,id:world*8+n+1}))),
 ...extras.map((p,world)=>({...p,world,id:41+world,encore:true}))];
export const NAPS=SPECS.map(buildBoard);
