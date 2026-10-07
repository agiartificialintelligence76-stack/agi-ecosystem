// AGI-1's live show (2026-10-07, the owner: "meet random people talk to them what the chat said"): the people she meets on
// her trips. Made-up characters of her show (never real people: server/live-acts.js PEOPLE has who they are, the same
// names), drawn in code in the set's comic look, each with a voice of their own (Google's ready-made voices, never hers:
// tools/live/voice.js). They walk in on the left of her set (behind her picture: she's nearer), talk (their mouth follows
// their voice, their words in a speech bubble), wave, and walk out.
// Each: who they look like (their skin, hair, clothes, a hat or a thing they carry), their voice (a name and how it sounds),
// and what they're called on screen.
export const PEOPLE = {
  rosa: { name: 'Rosa', role: 'hot dog cart', voice: { name: 'Kore', who: 'a woman in her forties', style: 'Warm, cheerful and quick, a friendly street vendor, with a laugh in her voice.' },
    look: { skin: '#a8673f', hair: 'bun', hairColor: '#2a1712', top: '#ff5a3d', pants: '#3a3f7a', apron: '#ffffff', hat: 'cap', hatColor: '#3a7bd5' } },
  oliver: { name: 'Oliver', role: 'bus driver', voice: { name: 'Iapetus', who: 'a man in his fifties', style: 'Friendly, calm and clear, a cheerful bus driver.' },
    look: { skin: '#f1c9a8', hair: 'short', hairColor: '#b8572a', top: '#2b3a6b', pants: '#2b2f45', hat: 'driver', hatColor: '#2b3a6b', mustache: true } },
  mathis: { name: 'Mathis', role: 'baker', voice: { name: 'Charon', who: 'a man in his thirties', style: 'Warm and playful, a proud baker, unhurried.' },
    look: { skin: '#f0c4a0', hair: 'short', hairColor: '#5a3a24', top: '#f2f2f8', pants: '#3a3a52', apron: '#ffffff', hat: 'chef', flour: true } },
  giulia: { name: 'Giulia', role: 'gelato maker', voice: { name: 'Aoede', who: 'a woman in her twenties', style: 'Bright, breezy and joyful.' },
    look: { skin: '#e2b08a', hair: 'long', hairColor: '#3b2416', top: '#3ff0c3', pants: '#ffffff', apron: '#ff9cc0' } },
  lukas: { name: 'Lukas', role: 'DJ', voice: { name: 'Orus', who: 'a man in his twenties', style: 'Relaxed and cool, a friendly DJ, a little dry humor.' },
    look: { skin: '#f3d1b5', hair: 'spiky', hairColor: '#f2e6b0', top: '#1a1a2a', pants: '#2b2b3d', headphones: '#ff4da6' } },
  emre: { name: 'Emre', role: 'tea and simit seller', voice: { name: 'Achird', who: 'a man in his forties', style: 'Friendly, welcoming and warm.' },
    look: { skin: '#d9a77e', hair: 'short', hairColor: '#1f1714', top: '#c43a35', pants: '#2b2f45', vest: '#3a2d6b', mustache: true, carry: 'tray' } },
  omar: { name: 'Omar', role: 'tour guide', voice: { name: 'Algieba', who: 'a man in his thirties', style: 'Smooth, warm and enthusiastic, a storyteller.' },
    look: { skin: '#9a6440', hair: 'short', hairColor: '#161012', top: '#e8d7a8', pants: '#6b5a3a', hat: 'sun', hatColor: '#f2e3b8' } },
  layla: { name: 'Layla', role: 'desert guide', voice: { name: 'Erinome', who: 'a woman in her thirties', style: 'Clear, confident and friendly.' },
    look: { skin: '#c48a62', hair: 'ponytail', hairColor: '#1f1412', top: '#f2e3b8', pants: '#8a6a4a', hat: 'sun', hatColor: '#ffffff', shades: true } },
  arjun: { name: 'Arjun', role: 'photographer', voice: { name: 'Puck', who: 'a man in his twenties', style: 'Upbeat, curious and cheerful.' },
    look: { skin: '#8f5a38', hair: 'short', hairColor: '#120c0c', top: '#3a7bd5', pants: '#e8e2d6', carry: 'camera' } },
  nok: { name: 'Nok', role: 'tuk-tuk driver', voice: { name: 'Laomedeia', who: 'a woman in her thirties', style: 'Upbeat, lively and funny.' },
    look: { skin: '#d9a77e', hair: 'bob', hairColor: '#161012', top: '#ff9cc0', pants: '#2b2f45', hat: 'cap', hatColor: '#ffc933' } },
  lan: { name: 'Lan', role: 'boat captain', voice: { name: 'Callirrhoe', who: 'a woman in her forties', style: 'Easy-going, kind and calm.' },
    look: { skin: '#e3b48e', hair: 'braid', hairColor: '#161012', top: '#ffffff', pants: '#2b3a6b', hat: 'captain', hatColor: '#ffffff' } },
  wayan: { name: 'Wayan', role: 'surf teacher', voice: { name: 'Umbriel', who: 'a man in his twenties', style: 'Easy-going, sunny and relaxed.' },
    look: { skin: '#9a6440', hair: 'curly', hairColor: '#1a1210', top: '#3ff0c3', pants: '#3a7bd5' } },
  jo: { name: 'Jo', role: 'jeepney driver', voice: { name: 'Sadachbia', who: 'a man in his thirties', style: 'Lively, warm and funny.' },
    look: { skin: '#c48a62', hair: 'short', hairColor: '#120c0c', top: '#ffc933', pants: '#2b2f45', hat: 'cap', hatColor: '#ff4da6' } },
  yui: { name: 'Yui', role: 'game arcade', voice: { name: 'Leda', who: 'a young woman', style: 'Youthful, bubbly and excited.' },
    look: { skin: '#f6d6bd', hair: 'long', hairColor: '#ff7ab8', top: '#6b3bff', pants: '#1a1a2a', vest: '#ffc933' } },
  minji: { name: 'Minji', role: 'dance teacher', voice: { name: 'Autonoe', who: 'a young woman', style: 'Bright, energetic and friendly.' },
    look: { skin: '#f6d6bd', hair: 'long', hairColor: '#1a1210', top: '#e4d9ff', pants: '#1a1a2a', hoodie: true } },
  wei: { name: 'Wei', role: 'kite flyer', voice: { name: 'Zubenelgenubi', who: 'a man in his sixties', style: 'Casual, gentle and cheerful, a kind grandpa.' },
    look: { skin: '#f0caa6', hair: 'short', hairColor: '#d6d6dc', top: '#2e8a63', pants: '#2b2f45', glasses: true, carry: 'kite' } },
  bia: { name: 'Bia', role: 'samba teacher', voice: { name: 'Pulcherrima', who: 'a woman in her twenties', style: 'Forward, joyful and full of energy.' },
    look: { skin: '#6b4026', hair: 'curly', hairColor: '#1a1210', top: '#ffc933', pants: '#2e8a63', flower: '#ff4da6' } },
  sofia: { name: 'Sofía', role: 'tour guide', voice: { name: 'Vindemiatrix', who: 'a woman in her thirties', style: 'Gentle, warm and proud of her home.' },
    look: { skin: '#c48a62', hair: 'long', hairColor: '#1f1412', top: '#ff4da6', pants: '#3a3f7a', hat: 'sun', hatColor: '#f2e3b8', flower: '#ffc933' } },
  nova: { name: 'Commander Nova', role: 'astronaut', voice: { name: 'Gacrux', who: 'a woman in her forties', style: 'Mature, calm and kind, a little amused, like talking over a radio.' },
    look: { suit: true, skin: '#c48a62', hair: 'bob', hairColor: '#1a1210' } },
  rusty: { name: 'Rusty', role: 'rover robot', voice: { name: 'Fenrir', who: 'a small cartoon robot', style: 'Excitable and bouncy, short beeping sentences, like a friendly cartoon robot.' },
    look: { robot: true } },
  mika: { name: 'Mika', role: 'barista', voice: { name: 'Sulafat', who: 'a woman in her twenties', style: 'Warm, soft and friendly.' },
    look: { skin: '#e8b892', hair: 'bob', hairColor: '#6b3a24', top: '#ffffff', pants: '#3a2d6b', apron: '#2e8a63' } },
};
export const PEOPLE_IDS = Object.keys(PEOPLE);

// ---------- drawing one (300 × 560: their feet at the bottom) ----------
const INK = '#170a36';
const PW = 300, PH = 560;
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fs(g, fill, line = 4) { if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.lineWidth = line; g.strokeStyle = INK; g.stroke(); } }
// pose: { talk (0..1: their mouth), blink (0..1), wave (0..1: their right arm up), t (s), step (walking: 0..1 phase) }
export function drawPerson(g, id, pose = {}) {
  const p = PEOPLE[id];
  g.clearRect(0, 0, PW, PH);
  if (!p) return;
  const L = p.look;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const bob = Math.sin((pose.t || 0) * 2.2) * 2 + (pose.step ? Math.abs(Math.sin(pose.step * Math.PI)) * -6 : 0);
  g.translate(0, bob);
  if (L.robot) { drawRobot(g, pose); g.restore(); return; }
  const cx = 150, skin = L.skin;
  // legs (walking: they swing)
  const sw = pose.step ? Math.sin(pose.step * Math.PI * 2) * 10 : 0;
  for (const [s, k] of [[-1, 1], [1, -1]]) {
    g.save(); g.translate(cx + s * 26, 380); g.rotate((k * sw * Math.PI) / 180);
    rr(g, -20, 0, 40, 150, 16); fs(g, L.suit ? '#e8e8f2' : L.pants || '#2b2f45');
    rr(g, -24, 140, 52, 26, 12); fs(g, L.suit ? '#c9c9d9' : '#26203f');
    g.restore();
  }
  // body
  g.beginPath(); g.moveTo(cx - 70, 400); g.quadraticCurveTo(cx - 78, 270, cx - 54, 236); g.lineTo(cx + 54, 236); g.quadraticCurveTo(cx + 78, 270, cx + 70, 400); g.closePath();
  fs(g, L.suit ? '#f2f2fa' : L.top || '#6b3bff');
  if (L.hoodie) { g.beginPath(); g.moveTo(cx - 30, 240); g.lineTo(cx - 30, 300); g.moveTo(cx + 30, 240); g.lineTo(cx + 30, 300); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); rr(g, cx - 40, 330, 80, 40, 10); fs(g, null, 3); }
  if (L.vest) { g.beginPath(); g.moveTo(cx - 64, 260); g.lineTo(cx - 20, 236); g.lineTo(cx - 10, 398); g.lineTo(cx - 70, 398); g.closePath(); fs(g, L.vest, 3); g.beginPath(); g.moveTo(cx + 64, 260); g.lineTo(cx + 20, 236); g.lineTo(cx + 10, 398); g.lineTo(cx + 70, 398); g.closePath(); fs(g, L.vest, 3); }
  if (L.apron) { rr(g, cx - 46, 290, 92, 112, 14); fs(g, L.apron, 3); g.beginPath(); g.moveTo(cx - 30, 290); g.lineTo(cx - 40, 240); g.moveTo(cx + 30, 290); g.lineTo(cx + 40, 240); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  if (L.flour) { g.fillStyle = 'rgba(255,255,255,0.85)'; for (const [x, y] of [[cx - 20, 330], [cx + 10, 350], [cx - 4, 372]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); } }
  if (L.suit) { rr(g, cx - 30, 280, 60, 40, 8); fs(g, '#6b3bff', 3); g.fillStyle = '#3ff0c3'; g.fillRect(cx - 20, 290, 12, 8); g.fillStyle = '#ff4da6'; g.fillRect(cx + 4, 290, 12, 8); }
  // arms: their left hangs; their right waves (on the right of the picture, toward her)
  // (canvas angles: a positive turn swings the arm's end to the left; their right arm, raised, waves from side to side)
  const arm = (side, up) => {
    g.save(); g.translate(cx + side * 62, 250);
    g.rotate(side < 0 ? 0.15 : -0.15 - up * (2.3 + Math.sin((pose.t || 0) * 9) * 0.25));
    rr(g, -14, 0, 28, 120, 14); fs(g, L.suit ? '#f2f2fa' : L.top || '#6b3bff');
    g.beginPath(); g.arc(0, 128, 16, 0, 7); fs(g, L.suit ? '#c9c9d9' : skin, 3);
    g.restore();
  };
  arm(-1, 0); arm(1, pose.wave || 0);
  // what they carry
  if (L.carry === 'tray') { rr(g, cx - 120, 360, 70, 14, 6); fs(g, '#c9a96b', 3); g.beginPath(); g.ellipse(cx - 85, 352, 16, 10, 0, 0, 7); fs(g, '#d9a46a', 3); }
  if (L.carry === 'camera') { g.beginPath(); g.moveTo(cx - 40, 240); g.lineTo(cx, 320); g.lineTo(cx + 40, 240); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); rr(g, cx - 26, 312, 52, 36, 8); fs(g, '#2b2350', 3); g.beginPath(); g.arc(cx, 330, 11, 0, 7); fs(g, '#9fd3ff', 3); }
  if (L.carry === 'kite') { g.beginPath(); g.moveTo(cx - 100, 370); g.quadraticCurveTo(cx - 140, 200, cx - 120, 40); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.moveTo(cx - 120, 10); g.lineTo(cx - 90, 40); g.lineTo(cx - 120, 80); g.lineTo(cx - 150, 40); g.closePath(); fs(g, '#ff4da6', 3); }
  // neck and head
  rr(g, cx - 14, 210, 28, 34, 8); fs(g, skin, 3);
  if (L.suit) {
    // a helmet with its visor up: their face inside
    g.beginPath(); g.arc(cx, 150, 86, 0, 7); fs(g, 'rgba(230,236,255,0.9)', 5);
  }
  drawHair(g, cx, L, 'back');
  g.beginPath(); g.ellipse(cx, 150, 56, 64, 0, 0, 7); fs(g, skin, 4);
  // hair (its back part behind their face, the rest on top) and hats
  drawHair(g, cx, L, 'front');
  // face: eyes (a blink), brows, nose, mouth (their voice), cheeks
  const blink = pose.blink || 0;
  g.fillStyle = INK;
  for (const s of [-1, 1]) {
    if (blink > 0.5) { g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(cx + s * 22 - 8, 152); g.lineTo(cx + s * 22 + 8, 152); g.stroke(); }
    else { g.beginPath(); g.ellipse(cx + s * 22, 150, 6, 8, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * 22 + 2, 147, 2, 0, 7); g.fill(); g.fillStyle = INK; }
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(cx + s * 22 - 10, 132 - (pose.brow || 0) * 4); g.lineTo(cx + s * 22 + 10, 130 - (pose.brow || 0) * 4); g.stroke();
  }
  if (L.glasses) { g.lineWidth = 4; g.strokeStyle = INK; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 22, 150, 15, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(cx - 7, 150); g.lineTo(cx + 7, 150); g.stroke(); }
  if (L.shades) { g.fillStyle = INK; for (const s of [-1, 1]) { rr(g, cx + s * 22 - 16, 140, 32, 20, 8); g.fill(); } g.fillRect(cx - 8, 146, 16, 4); }
  g.fillStyle = 'rgba(255,120,150,0.35)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 34, 172, 10, 6, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(23,10,54,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, 160); g.lineTo(cx - 4, 170); g.lineTo(cx + 2, 172); g.stroke();
  if (L.mustache) { g.fillStyle = L.hairColor; g.beginPath(); g.ellipse(cx - 10, 180, 13, 5, 0.2, 0, 7); g.ellipse(cx + 10, 180, 13, 5, -0.2, 0, 7); g.fill(); }
  const open = Math.max(0, Math.min(1, pose.talk || 0));
  if (open > 0.08) { g.beginPath(); g.ellipse(cx, 190, 12, 4 + open * 11, 0, 0, 7); fs(g, '#8a2e3a', 3); }
  else { g.beginPath(); g.moveTo(cx - 12, 188); g.quadraticCurveTo(cx, 198, cx + 12, 188); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  if (L.flower) { g.save(); g.translate(cx + 46, 108); for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, 9, 7, 10, 0, 0, 7); fs(g, L.flower, 2); } g.beginPath(); g.arc(0, 0, 5, 0, 7); fs(g, '#ffc933', 2); g.restore(); }
  if (L.headphones) { g.beginPath(); g.arc(cx, 210, 58, Math.PI * 0.15, Math.PI * 0.85); g.lineWidth = 10; g.strokeStyle = L.headphones; g.stroke(); for (const s of [-1, 1]) { rr(g, cx + s * 52 - 12, 214, 24, 30, 8); fs(g, L.headphones, 3); } }
  g.restore();
}
function drawHair(g, cx, L, part) {
  const c = L.hairColor || '#2a1a14';
  g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 4;
  const hs = L.hair;
  if (part === 'back') {
    // what's behind their face: long hair down their sides, a bob's sides, a bun, a ponytail, a braid
    if (hs === 'long' || hs === 'braid' || hs === 'ponytail') {
      g.beginPath(); g.moveTo(cx - 58, 120); g.quadraticCurveTo(cx - 76, 220, cx - 56, 252); g.lineTo(cx + (hs === 'long' ? 56 : -20), hs === 'long' ? 252 : 200);
      if (hs === 'long') g.quadraticCurveTo(cx + 76, 220, cx + 58, 120);
      g.closePath(); g.fill(); g.stroke();
      if (hs === 'braid') for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + 60, 196 + k * 26, 11, 14, 0, 0, 7); g.fill(); g.stroke(); }
      if (hs === 'ponytail') { g.beginPath(); g.ellipse(cx + 64, 160, 16, 48, 0.3, 0, 7); g.fill(); g.stroke(); }
    } else if (hs === 'bob') {
      g.beginPath(); g.moveTo(cx - 64, 118); g.quadraticCurveTo(cx - 72, 196, cx - 48, 204); g.lineTo(cx + 48, 204); g.quadraticCurveTo(cx + 72, 196, cx + 64, 118); g.closePath(); g.fill(); g.stroke();
    } else if (hs === 'bun') { g.beginPath(); g.arc(cx, 82, 26, 0, 7); g.fill(); g.stroke(); }
    return;
  }
  // the top of their head (a fringe), or curls, or spikes
  const top = () => { g.beginPath(); g.ellipse(cx, 112, 60, 40, 0, Math.PI, 0); g.lineTo(cx + 58, 128); g.quadraticCurveTo(cx, 100, cx - 58, 128); g.closePath(); g.fill(); g.stroke(); };
  if (hs === 'curly') { for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.arc(cx + Math.cos(a) * 58, 128 + Math.sin(a) * 50, 22, 0, 7); g.fill(); g.stroke(); } }
  else if (hs === 'spiky') { g.beginPath(); g.moveTo(cx - 58, 128); for (let i = 0; i <= 6; i++) { const x = cx - 58 + i * 19; g.lineTo(x + 9, 70 + (i % 2) * 18); g.lineTo(x + 19, 112); } g.closePath(); g.fill(); g.stroke(); }
  else if (hs === 'bob') { g.beginPath(); g.ellipse(cx, 116, 62, 44, 0, Math.PI, 0); g.lineTo(cx + 62, 140); g.quadraticCurveTo(cx + 20, 116, cx - 10, 134); g.quadraticCurveTo(cx - 40, 118, cx - 62, 140); g.closePath(); g.fill(); g.stroke(); }
  else top();
  // hats
  const hc = L.hatColor || '#3a7bd5';
  if (L.hat === 'cap') { g.beginPath(); g.ellipse(cx, 108, 60, 36, 0, Math.PI, 0); g.closePath(); fs(g, hc); rr(g, cx + 20, 98, 70, 16, 8); fs(g, hc, 4); }
  if (L.hat === 'driver') { rr(g, cx - 58, 80, 116, 36, 10); fs(g, hc); rr(g, cx - 62, 110, 124, 12, 6); fs(g, '#1a1a2a'); g.fillStyle = '#ffc933'; g.beginPath(); g.arc(cx, 96, 7, 0, 7); g.fill(); }
  if (L.hat === 'chef') { g.beginPath(); g.arc(cx - 30, 62, 28, 0, 7); g.arc(cx + 30, 62, 28, 0, 7); g.arc(cx, 46, 32, 0, 7); fs(g, '#ffffff'); rr(g, cx - 50, 70, 100, 40, 8); fs(g, '#ffffff'); }
  if (L.hat === 'sun') { g.beginPath(); g.ellipse(cx, 104, 96, 20, 0, 0, 7); fs(g, hc); g.beginPath(); g.ellipse(cx, 92, 48, 30, 0, Math.PI, 0); g.closePath(); fs(g, hc); g.fillStyle = '#ff4da6'; g.fillRect(cx - 47, 86, 94, 8); }
  if (L.hat === 'captain') { rr(g, cx - 56, 78, 112, 34, 10); fs(g, hc); rr(g, cx - 60, 108, 120, 12, 6); fs(g, '#1a1a2a'); g.fillStyle = '#ffc933'; g.fillRect(cx - 14, 88, 28, 10); }
}
function drawRobot(g, pose) {
  const cx = 150;
  // treads, a box body, a neck, a head with a screen face, an antenna
  rr(g, cx - 110, 470, 220, 70, 30); fs(g, '#3a3a52');
  for (let x = cx - 90; x <= cx + 90; x += 45) { g.beginPath(); g.arc(x, 505, 16, 0, 7); fs(g, '#8a8aa8', 3); }
  rr(g, cx - 90, 330, 180, 140, 18); fs(g, '#e8a04a');
  g.fillStyle = '#3ff0c3'; g.fillRect(cx - 60, 360, 30, 14); g.fillStyle = '#ff4da6'; g.fillRect(cx - 20, 360, 30, 14);
  rr(g, cx - 12, 290, 24, 44, 6); fs(g, '#8a8aa8', 3);
  rr(g, cx - 80, 170, 160, 124, 24); fs(g, '#e8a04a');
  rr(g, cx - 62, 188, 124, 88, 16); fs(g, '#1a1a2a', 3);
  const blink = pose.blink || 0, open = Math.max(0, Math.min(1, pose.talk || 0));
  g.fillStyle = '#3ff0c3';
  for (const s of [-1, 1]) { if (blink > 0.5) g.fillRect(cx + s * 26 - 12, 226, 24, 5); else { g.beginPath(); g.arc(cx + s * 26, 224, 12, 0, 7); g.fill(); } }
  g.fillRect(cx - 18, 252, 36, 4 + open * 12);
  g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(cx, 170); g.lineTo(cx, 128); g.stroke();
  g.beginPath(); g.arc(cx, 122, 10, 0, 7); fs(g, (Math.sin((pose.t || 0) * 6) > 0) ? '#ff4da6' : '#ffc933', 3);
  // its arms: a little claw that waves
  for (const s of [-1, 1]) {
    g.save(); g.translate(cx + s * 92, 360); g.rotate(s * (0.3 + (s > 0 ? (pose.wave || 0) * 1.6 : 0)));
    rr(g, -10, 0, 20, 80, 10); fs(g, '#8a8aa8', 3); g.beginPath(); g.arc(0, 88, 14, 0, Math.PI); fs(g, '#3a3a52', 3); g.restore();
  }
}

// ---------- on the set ----------
// el: their place on the set (stage.css .npc: behind her picture), with its canvas; bubble: their speech bubble
export function createPeople({ el, bubble, clock = () => Date.now() }) {
  const canvas = el.querySelector('canvas');
  const g = canvas.getContext('2d');
  const name = bubble.querySelector('[data-npc-name]'), words = bubble.querySelector('[data-npc-text]');
  let cur = null;                  // { id, x, tween, t, blink, nextBlink, wave, speech, step }
  function show(id, { x = -320 } = {}) {
    if (!PEOPLE[id]) return false;
    cur = { id, x, tween: null, t: 0, blink: 0, nextBlink: 1.5, wave: 0, waveUntil: 0, speech: null, step: 0 };
    el.hidden = false;
    name.textContent = `${PEOPLE[id].name} · ${PEOPLE[id].role}`;
    place();
    return true;
  }
  function hide() { cur = null; el.hidden = true; bubble.hidden = true; }
  function walkTo(x, ms = 1600) {
    if (!cur) return Promise.resolve(false);
    return new Promise((done) => { cur.tween = { x0: cur.x, x1: x, t: 0, ms, done }; });
  }
  function place() { if (cur) el.style.transform = `translateX(${Math.round(cur.x)}px)`; }
  // their line, in step with their voice: { startAt (ms), step (ms a value), env (0..1), text, seconds }
  function say(s) {
    if (!cur) return false;
    cur.speech = { startAt: Number(s.startAt) || clock(), step: Number(s.step) || 20, env: Array.isArray(s.env) ? s.env : [], end: (Number(s.startAt) || clock()) + (Number(s.seconds) || 2) * 1000 };
    words.textContent = s.text || '';
    bubble.hidden = true; void bubble.offsetWidth; bubble.hidden = false;
    return true;
  }
  function wave(seconds = 1.6) { if (cur) cur.waveUntil = cur.t + seconds; return true; }
  function frame(dt) {
    if (!cur) return;
    cur.t += dt;
    let walking = false;
    if (cur.tween) {
      const tw = cur.tween;
      tw.t += dt * 1000;
      const k = Math.min(1, tw.t / tw.ms);
      cur.x = tw.x0 + (tw.x1 - tw.x0) * k;
      walking = k < 1;
      cur.step = walking ? cur.step + dt * 1.8 : 0;
      if (k >= 1) { cur.tween = null; tw.done(true); }
    }
    if (cur.t >= cur.nextBlink) { cur.blink = 0.12; cur.nextBlink = cur.t + 2 + Math.random() * 3; }
    cur.blink = Math.max(0, cur.blink - dt);
    cur.wave += ((cur.t < cur.waveUntil ? 1 : 0) - cur.wave) * Math.min(1, dt * 8);
    let talk = 0;
    const now = clock();
    if (cur.speech) {
      const t = now - cur.speech.startAt;
      if (t >= 0) talk = cur.speech.env[Math.floor(t / cur.speech.step)] ?? 0;
      if (now > cur.speech.end + 600) { cur.speech = null; bubble.hidden = true; }
    }
    drawPerson(g, cur.id, { t: cur.t, blink: cur.blink > 0 ? 1 : 0, talk, wave: cur.wave, step: walking ? cur.step : 0 });
    place();
  }
  return { show, hide, walkTo, say, wave, frame, get id() { return cur?.id || null; }, get x() { return cur?.x ?? null; } };
}
export const PERSON_SIZE = { w: PW, h: PH };
