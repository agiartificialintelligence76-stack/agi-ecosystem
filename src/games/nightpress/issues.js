// Paper cell rows double as die-cut tooling. E is an illustrated eye, O a true
// punched-through window. Film carries ink without hiding the ink underneath.
export const DECALS={
 agi:{name:'AGI cameo',motif:'face',color:'#ffc47d',rows:['EE','##','.#']},
 calico:{name:'Calico',motif:'cat',color:'#ed9b85',rows:['#.#','EE#','.##']},
 moon:{name:'Moon',motif:'moon',color:'#e9c660',rows:['##.','#..','###']},
 ticket:{name:'Admit one',motif:'ticket',color:'#8fbfc4',rows:['###','.##']},
 tape:{name:'Mix tape',motif:'tape',color:'#aa99c7',rows:['###','##.']},
 stamp:{name:'Air mail',motif:'stamp',color:'#82ba9e',rows:['##','#.']},
 ribbon:{name:'Ribbon',motif:'ribbon',color:'#e68ea7',rows:['##.','.##']},
 blossom:{name:'Cherry',motif:'bloom',color:'#eca7bb',rows:['.##','##.','.#.']},
 bolt:{name:'Spark',motif:'bolt',color:'#dbac53',rows:['.##','##.']},
 frame:{name:'Viewmaster',motif:'window',color:'#9dbca8',rows:['###','#O#','###']},
 arch:{name:'Porthole',motif:'portal',color:'#bd9abb',rows:['.##','###','#O#','###']},
 veil:{name:'Glass star',motif:'glass',color:'#70b9b4',film:true,rows:['.#.','###','.#.']},
 film:{name:'Celluloid',motif:'film',color:'#a58ec8',film:true,rows:['###','.#.']},
 foil:{name:'Gold seal',motif:'seal',color:'#dbae59',foil:true,rows:['#']},
 prism:{name:'Prism seal',motif:'prism',color:'#8aadca',foil:true,rows:['##']},
};
export const VOLUMES=[
 ['Margins','Warm cream','#f7e5b6','#e99291','#74536b'],
 ['Double Take','Salmon stock','#f6c6ae','#96b7af','#814c65'],
 ['Night Market','Pool blue','#b8d9d1','#f1a583','#3e666c'],
 ['Punch List','Sugar lilac','#dacbe1','#e6bd73','#6d5881'],
 ['Foldout','Garden mint','#d0dfb7','#9badc0','#587362'],
 ['Special Edition','Silver peach','#f1d0ba','#a49bb4','#685665'],
];
const byVolume=[
 [
 ['LUNCH BREAK','agi ticket',0,'',8,'Two stickers. Keep the masthead clear.'],
 ['AIR MAIL','stamp ribbon',1,'',6,'A little mail and a ribbon in the margins.'],
 ['GOOD HAIR DAY','agi blossom',2,'eyes',8,'Make room for her two bright eyes.'],
 ['MOON NOTES','moon tape',3,'border',8,'Leave the bottom edge bare for my note.'],
 ['DOMESTIC PRESS','calico ticket stamp',4,'eyes',13,'I need a cat with both eyes for the byline.'],
 ['DAY OFF','agi moon ribbon',5,'border eyes',11,'Save the bottom margin and my face.'],
 ],[
 ['DOUBLE TAKE','agi moon',0,'overlap',7,'Touch ink to ink. Let the papers overlap.'],
 ['CROP MARKS','ribbon ticket',1,'clip',6,'Slice a sticker at the trim edge.'],
 ['HALF TICKET','stamp tape',3,'clip overlap',5,'Clip one edge. Make a little overlap.'],
 ['SECOND BILLING','agi ribbon ticket',2,'eyes above',11,'Put my cameo over the ribbon, eyes clear.'],
 ['TWO MOONS','moon blossom stamp',4,'overlap border',11,'Overlap the shapes above a clear lower margin.'],
 ['CAT IN PRINT','calico tape ribbon',5,'clip overlap eyes',12,'Let a corner run off the edge of the photograph.'],
 ],[
 ['NIGHT MARKET','stamp ticket',0,'apart',7,'Different stalls. Leave a gap between shapes.'],
 ['CORNER SHOP','ribbon stamp',1,'corner',7,'A diagonal corner kiss. No shared sides.'],
 ['LOST CAT','calico stamp',3,'apart eyes',10,'Keep the cat away from the stamp counter.'],
 ['LAST TRAIN','tape ribbon',4,'corner',8,'Let a corner meet the cassette on the platform.'],
 ['MOON STALL','moon tape',2,'apart border',10,'Two quiet stalls, clear of the bottom edge.'],
 ['CHERRY CHANGE','blossom agi',5,'corner eyes',9,'A flower at my corner. Leave both eyes showing.'],
 ],[
 ['PEEP SHOW','agi frame',0,'window',9,'Layer the window over an illustrated sticker.'],
 ['MOON WINDOW','moon frame',1,'window',10,'Give the little window a slice of moon.'],
 ['CAT FLAP','calico frame ribbon',2,'window eyeWindow',13,'Show one cat eye through the cutout.'],
 ['FILM CAN','tape arch stamp',3,'window clip',13,'Crop the porthole or the tape at the trim.'],
 ['POSTAGE DUE','stamp frame ribbon',4,'window border',12,'Frame the tiny stamp without covering the footer.'],
 ['IRIS PRINT','agi arch stamp',5,'window eyeWindow clip',12,'Give the reader one eye through the porthole.'],
 ],[
 ['GATEFOLD','agi stamp',0,'gutter',7,'Keep the center fold free of glue.'],
 ['READ ME','stamp agi',1,'gutter order',7,'Mail on the left, cameo on the right.'],
 ['LAST POST','agi ticket stamp',3,'gutter order eyes',12,'Face, then admission. The fold is sacred.'],
 ['SLOW TAPE','tape ribbon stamp',4,'gutter order clip',10,'Cassette left, ribbon right, one cropped edge.'],
 ['SMALL ADS','stamp ticket',2,'gutter apart order',7,'Air mail before admission across the fold.'],
 ['LAST LEAF','agi ribbon stamp',5,'gutter order eyes',12,'My portrait opens. My ribbon gets the last word.'],
 ],[
 ['SUBSCRIPTION','agi veil foil',0,'film top',8,'A clear star and a gold seal to finish.'],
 ['GLASS EYES','calico film foil',1,'film eyes top',10,'Print transparent ink over the cat. Protect both eyes.'],
 ['GOLD STANDARD','agi veil prism',2,'film eyes top',9,'Overlap the glass. Keep the silver seal in front.'],
 ['AFTER HOURS','moon film foil',3,'film clip top',8,'Run one decal off the edge. Foil gets top billing.'],
 ['STAR SIGN','agi film prism',4,'film eyes border top',8,'Give my glass portrait a clean bottom margin.'],
 ['THE LAST EDIT','calico veil foil',5,'film eyes top clip',10,'A glass cat, two bright eyes and a final foil seal.'],
 ],
];
const HEAD=[[1,2],[0,1],[3,4],[2,3],[0,4],[1,3]];
export const ISSUES=byVolume.flatMap((v,volume)=>v.map(([title,stock,head,rules,coverage,note],slot)=>({
 id:volume*6+slot,volume,slot,title,pieces:stock.split(' '),head:HEAD[head],rules:rules?rules.split(' '):[],coverage,note,w:5,h:5,
})));
export const ruleLabels={
 trim:'Stay within trim',stock:'Use every sticker',head:'Masthead legible',coverage:'Cover enough paper',eyes:'Show both eyes',border:'Bottom margin clear',overlap:'Overlap two stickers',
 clip:'Crop a sticker edge',above:'Cameo above ribbon',apart:'No shared sides',corner:'Corners touch only',window:'Art through window',
 eyeWindow:'Eye through window',gutter:'Clear center fold',order:'Read left to right',film:'Glass over artwork',top:'Seal on top',
};
export const DAILY_POOL=ISSUES.map(q=>q.id);
export function issueFor(seed){return ISSUES[DAILY_POOL[((seed>>>0)*37+Math.floor((seed>>>0)/29))%DAILY_POOL.length]];}
