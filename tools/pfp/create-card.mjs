import sharp from 'sharp';
const portrait=await sharp('public/pfp/v1/room.webp').resize(512,512,{kernel:'nearest'}).composite([{input:'public/pfp/v1/character-0.png'}]).png().toBuffer();
const hero=await sharp(portrait).resize(600,600,{kernel:'nearest'}).png().toBuffer();
const type=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <g font-family="Arial,sans-serif"><text x="650" y="92" fill="#bba0f7" font-size="20" font-weight="700" letter-spacing="5">AGI / PFP LAB</text>
  <text x="650" y="218" fill="#f2efe8" font-size="62" font-weight="700" letter-spacing="-3">Your AGI.</text>
  <text x="650" y="290" fill="#bba0f7" font-size="62" font-weight="700" letter-spacing="-3">Your energy.</text>
  <text x="650" y="369" fill="#ded7eb" font-size="24">48 looks. 60 worlds.</text>
  <text x="650" y="411" fill="#a9a0b4" font-size="22">Unlimited remixes. Free PNGs.</text>
  <text x="650" y="554" fill="#bba0f7" font-size="25" font-weight="700">agi1.app/pfp</text></g></svg>`);
await sharp({create:{width:1200,height:630,channels:3,background:'#111015'}}).composite([{input:hero,left:15,top:15},{input:type}]).jpeg({quality:88}).toFile('public/pfp/preview.jpg');
console.log('Created public/pfp/preview.jpg');
