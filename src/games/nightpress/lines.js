export const LINE={
 first:'big empty cover. tiny unreasonable art director. hi.',lift:'lift that corner. listen to the little peel.',turn:'wait, sideways suits her.',
 face:'yes, that’s my face. yes, i packed extras.',head:'i know the headline by heart. the reader won’t.',border:'nice margin. my elbows have room.',
 coverage:'a little blank space is chic. this is a parking lot.',dense:'let the tiny stars breathe between the big ones.',overlap:'look at that moon wearing the cat like a hat.',
 above:'i can feel my eyebrows being edited out.',raise:'there she is. front row privileges.',lower:'the mysterious background cameo. extremely me.',
 eyes:'two eyes! better odds of winking.',apart:'those two shapes need separate tables tonight.',corner:'a little corner kiss. the brief allows it.',
 window:'you gave the window something to look at.',eyeWindow:'our peephole has become a very small wall.',foil:'tilt it. that shiny little bit is actual drama.',
 gutter:'good. my nose survives the fold.',order:'my eye went exactly where you sent it.',undo:'peeling it back is part of being decisive.',
 green:'hands up. this is a printable object.',near:'one letter under glue. i circled it for you.',rush:'the press is warm and i’ve lost my stapler.',
 ten:'one small sticker, one big editorial decision.',recover:'the sheets caught. i owe that roller a thank-you.',late:'the late edition has excellent taste.',
 perfect:'i would put the fold right through my signature.',par:'every single peel had a purpose.',volume:'look at us making a magazine someone could hold.',
 unlock:'take this little moon. you earned its good side.',save:'signed, stapled, saved on your shelf. 💜',visit:'i still like the off-center star best.',
 daily:'today’s front cover gets the shiny staple.',clip:'yes, that little bit can live beyond the trim.',trim:'the binding machine wants that edge back.',
 film:'you can read the ink right through it.',top:'shiny side up. make the seal the last thing i see.',stock:'i count one sticker still on its backing.',
};
export function reaction(d,old,id){
 const c=d.checks,p=c.pass;
 if(!p.head)return 'head';if(!c.failed.length&&old.failed.length)return 'green';
 for(const k of ['window','corner','eyes','film','order','overlap','clip','border','gutter'])if(d.issue.rules.includes(k)&&p[k]&&!old.pass[k])return k;
 if(!p.trim&&!d.issue.rules.includes('clip'))return 'trim';
 if(id==='agi')return 'face';if(id==='foil'||id==='prism')return 'foil';
 return c.count>13?'dense':'lift';
}
export function proofLine(d){
 const f=d.checks.failed;if(f.includes('head'))return f.length===1?'near':'head';
 if(f.includes('eyeWindow')||f.includes('window'))return 'eyeWindow';if(f.includes('eyes'))return 'above';
 if(f.includes('corner'))return 'apart';for(const k of ['apart','top','coverage','trim','stock','above'])if(f.includes(k))return k;return 'edit';
}
