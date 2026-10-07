// AGI-1's live show (2026-10-07, the owner, after a preview of her trips: "the agi1 trip preview i just watched is so bad",
// then everything picked as the worst part, and "Painted art"): the pictures of her set, painted by Google's image AI
// (Gemini's image models on Vertex AI / Agent Platform, with the Google Cloud key already on the owner's server for her
// voice) instead of drawn in code: her 20 places, her 7 rooms, the inside of each of her 12 vehicles, the 21 people she
// meets (on a green background, cut out afterwards), and the 32 things she wears on her head or around her neck.
//
//   sh tools/live/live.sh --art                 makes every picture not made yet (2 of each backdrop and person, 1 of each
//                                               accessory), into /opt/agi1-live/out/art (about 20 minutes, about $5–10 on
//                                               the Google Cloud card, like her voice). Run again: it carries on.
//   sh tools/live/live.sh --art-only paris,omar one more of these
//
// Claude looks at every picture, picks one of each, cuts out the people and accessories and makes them small
// (tools/live/page/art/): nothing here goes on stream by itself. Never a real person, a logo, text or anyone's artwork:
// every prompt says so, and the pictures are checked before they're used.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serviceAccount, accessToken, forgetToken } from './voice.js';
import { PLACES, PLACE_IDS } from './page/places.js';
import { VEHICLE_IDS } from './page/vehicles.js';
import { PEOPLE_IDS } from './page/people.js';

// ---------- what each picture is ----------
const BG_STYLE = 'A hand-painted anime background illustration with the quality of a Japanese anime film background: clean painterly detail, soft cel shading, gentle light and atmosphere, rich but soft colors that suit a cute pastel livestream.';
const BG_RULES = 'No people, no characters, no animals up close, no text, no letters, no numbers, no logos, no signs with writing, no watermark, no frame or border.';
const BG_LAYOUT = 'It is the backdrop of a VTuber livestream: a character will stand in front of the right half of the picture, so keep the right third calm and simple, and put the main subject in the left half, fully visible, its top in the upper half of the picture. Eye-level camera.';
const ROOM_LAYOUT = 'It is the backdrop of a VTuber livestream: a character will stand in front of the right half of the picture, so keep the right half simple. Eye-level camera.';
const INSIDE_LAYOUT = 'It is the backdrop of a VTuber livestream: the viewer looks at the seats from the front, and a character will sit or stand in front of the right half of the picture, so keep the right half simple. Eye-level camera.';
const GREEN = 'On a plain, flat, pure bright green background (#00FF00) with nothing else on it: no shadow, no gradient, no floor, no frame, no text.';
const PERSON_STYLE = 'An anime character illustration in the style of a VTuber model: clean line art, soft cel shading, big expressive eyes, a warm friendly smile, cute and wholesome, modern everyday clothes.';
const PERSON_LAYOUT = 'Waist-up: the whole head and hair inside the picture with a little space above it, cut off at the waist by the bottom edge. Standing, the body turned slightly to the right, toward someone standing there, looking at the viewer. One person only, an original made-up character (not anyone real).';
const PERSON_REF = 'The attached picture only shows the art style to match: its line art, coloring, shading and eyes. Draw a completely different person, not the girl in the picture, and nothing else from it.';
const ACC_STYLE = 'Anime illustration style: clean line art, soft cel shading, cute pastel colors. Centered, filling most of the picture.';

// her places (places.js): the landmark and the light
const PLACE_PROMPTS = {
  newyork: 'New York City: the Brooklyn Bridge and the Manhattan skyline at golden hour, the East River sparkling, warm sky.',
  london: 'London: Big Ben and the Houses of Parliament across the River Thames, a red double-decker bus on Westminster Bridge, a soft sky with breaks of sunlight.',
  paris: 'Paris: the Eiffel Tower seen from the Trocadéro gardens on a sunny spring afternoon, cream stone buildings, blossoming trees.',
  rome: 'Rome: the Colosseum on a sunny afternoon, warm stone, umbrella pines and cypress trees, a cobbled street in front.',
  berlin: 'Berlin: the Brandenburg Gate at sunset, a wide square in front of it, a soft orange and pink sky.',
  istanbul: 'Istanbul: the Bosphorus at golden hour, a mosque with domes and minarets on the shore, ferries on the water, seagulls far away.',
  cairo: 'Giza, Egypt: the three Great Pyramids under a clear blue sky, golden sand dunes, a few palm trees at the edge.',
  dubai: 'Dubai: the Burj Khalifa and the modern skyline at dusk, warm desert light, sand dunes at the edge of the city.',
  agra: 'Agra, India: the Taj Mahal at sunrise, its long reflecting pool, gardens and cypress trees, a soft pink and gold sky.',
  bangkok: 'Bangkok, Thailand: the golden temple Wat Arun by the Chao Phraya river at sunset, long-tail boats on the water.',
  halong: 'Ha Long Bay, Vietnam: emerald water and tall limestone islands, a traditional junk boat with red sails, soft morning mist.',
  bali: 'Bali, Indonesia: bright green rice terraces with palm trees, a small stone temple gate, warm afternoon sun.',
  palawan: 'Palawan, the Philippines: a turquoise lagoon between tall limestone cliffs, a white sand beach, outrigger boats, a bright tropical sky.',
  tokyo: 'Tokyo: a quiet street lined with cherry blossom trees in full bloom, Tokyo Tower in the distance, a soft spring afternoon, petals in the air.',
  seoul: 'Seoul: Gyeongbokgung Palace with mountains behind it, trees in autumn colors, soft afternoon light.',
  beijing: 'The Great Wall of China winding over green mountains, a watchtower in the middle distance, a clear sky.',
  rio: 'Rio de Janeiro: Sugarloaf Mountain and Guanabara Bay at sunset, Copacabana beach, palm trees.',
  mexico: 'Chichén Itzá, Mexico: the El Castillo pyramid on green grass under a bright blue sky, jungle trees around it.',
  moon: 'On the surface of the Moon: grey craters and soft dust, the Earth rising above the horizon in a black starry sky, a small lunar lander far away.',
  mars: 'On Mars: a red rocky desert, a dusty orange-pink sky, distant mountains, a small rover far away, two tiny moons in the sky.',
};
// her rooms (rooms.js)
const ROOM_PROMPTS = {
  studio: 'A cozy streamer\'s room at night: a desk with a glowing computer and a microphone on an arm on the left, purple and pink LED strip lights, shelves with plushies and little figures, a window with city lights, posters with abstract shapes.',
  bedroom: 'A cute bedroom in the evening, pastel pink and lavender: a bed with plushies, fairy lights on the wall, a window with a soft sunset.',
  cafe: 'A cozy café in the afternoon: a wooden counter, a coffee machine, hanging plants, warm lamps, pastries in a glass case, big windows.',
  rooftop: 'A city rooftop at night: string lights, a railing, potted plants, the skyline with lit windows, a starry purple night sky with a full moon.',
  beach: 'A tropical beach at sunset: gentle waves, palm trees, a pink and orange sky with a few clouds, sparkling water.',
  gaming: 'A gamer\'s room at night: blue and purple RGB lights, a gaming PC with glowing fans, monitors with colorful abstract game screens, a gaming chair, glowing wall panels.',
  stage: 'A concert stage in an arena at night: big screens with abstract purple and pink visuals, spotlights and colorful light beams, haze, the crowd\'s glow sticks as tiny lights in the dark.',
};
// the inside of each of her vehicles (vehicles.js): her trips (she rides in it, in front of it)
const RIDE_PROMPTS = {
  robotaxi: 'The inside of a self-driving robotaxi at night: the empty back seat on the right, a side window with a neon city streaming past, soft cyan and purple interior lights, no driver and no steering wheel.',
  taxi: 'The inside of a yellow New York taxi: the empty back seat on the right, a side window with Manhattan streets and skyscrapers in the afternoon.',
  bus: 'The upper deck of a red London double-decker bus: an empty front seat on the right, the big front window with a London street of old buildings.',
  scooter: 'A sunny cobbled street in Rome seen from a moving scooter: pastel buildings on both sides, the scooter\'s handlebar and round mirror at the bottom right, a little motion blur at the edges.',
  balloon: 'Inside the basket of a hot-air balloon high above Paris at sunrise: the woven edge of the basket along the bottom, the colorful balloon above, the city and the Eiffel Tower far below, soft clouds.',
  train: 'The inside of a modern train: an empty window seat on the right, a big window with green countryside and mountains passing by, warm afternoon light.',
  boat: 'On the deck of a small boat: a white railing along the bottom, the sea and distant islands, seagulls, a bright sky.',
  tuktuk: 'The inside of a colorful tuk-tuk in Bangkok: an empty bench seat on the right, the open side with a busy evening street with lanterns and food stalls, a little motion blur.',
  jeepney: 'The inside of a colorful Filipino jeepney: long bench seats along the sides, shiny chrome and bright decorations, the open back with a sunny tropical road.',
  cablecar: 'The inside of a glass cable car cabin: big windows with Rio de Janeiro far below, the bay, Sugarloaf Mountain and the sea, a bright day.',
  plane: 'The inside of an airplane cabin: an empty window seat on the right, an oval window with fluffy white clouds and a blue sky, soft daylight.',
  rocket: 'The inside of a rocket\'s cockpit: control panels with glowing buttons along the bottom, a big round window with the Earth and stars, cool blue light.',
};
// the people she meets (people.js): made up, each as their voice sounds
const PERSON_PROMPTS = {
  rosa: 'Rosa, a cheerful woman in her forties who runs a hot dog cart in New York: dark hair in a bun, warm brown skin, an orange-red shirt with a white apron, a blue cap, holding a hot dog.',
  oliver: 'Oliver, a friendly man in his fifties who drives a London bus: short ginger hair and a ginger mustache, fair skin, a navy blue driver\'s jacket and cap.',
  mathis: 'Mathis, a playful baker in his thirties in Paris: short brown hair, a white baker\'s jacket and hat, a little flour on his cheek, holding a fresh baguette.',
  giulia: 'Giulia, a joyful woman in her twenties who makes gelato in Rome: long dark brown hair, a mint green top with a pink apron, holding a gelato cone.',
  lukas: 'Lukas, a relaxed DJ in his twenties in Berlin: messy platinum blond hair, a black t-shirt, pink headphones around his neck.',
  emre: 'Emre, a warm man in his forties who sells tea and simit in Istanbul: short black hair, a black mustache, a red shirt and a purple vest, holding a small tray with a glass of tea.',
  omar: 'Omar, an enthusiastic tour guide in his thirties at the pyramids of Giza: short black hair, brown skin, a light sand-colored linen shirt, a sun hat, a tour guide badge on a lanyard.',
  layla: 'Layla, a confident desert safari guide in her thirties in Dubai: dark hair in a ponytail, sunglasses pushed up on her head, a cream shirt, a white sun hat.',
  arjun: 'Arjun, an upbeat photographer in his twenties in Agra: short black hair, brown skin, a blue shirt, a camera on a strap around his neck.',
  nok: 'Nok, a lively tuk-tuk driver in her thirties in Bangkok: a black bob haircut, a pink t-shirt, a yellow cap.',
  lan: 'Lan, a kind boat captain in her forties in Ha Long Bay: black hair in a braid, a white shirt, a white captain\'s hat.',
  wayan: 'Wayan, a sunny surf teacher in his twenties in Bali: curly black hair, brown skin, a mint green rash guard, a surfboard behind his shoulder.',
  jo: 'Jo, a funny jeepney driver in his thirties in Palawan: short black hair, brown skin, a yellow t-shirt, a pink cap.',
  yui: 'Yui, a bubbly young woman who works at a game arcade in Tokyo: long pink hair, a purple jacket over a yellow vest, holding a small plush toy.',
  minji: 'Minji, an energetic young dance teacher in Seoul: long black hair, a lavender hoodie.',
  wei: 'Wei, a gentle grandpa in his sixties flying a kite at the Great Wall: short grey hair, round glasses, a green jacket, holding a colorful kite.',
  bia: 'Bia, a joyful samba teacher in her twenties in Rio de Janeiro: curly black hair with a pink flower in it, dark brown skin, a yellow top.',
  sofia: 'Sofía, a warm tour guide in her thirties at Chichén Itzá: long dark brown hair with a yellow flower in it, a pink blouse, a straw sun hat.',
  nova: 'Commander Nova, a calm astronaut in her forties: a white space suit and a round helmet with a big clear glass visor, her face and short black bob hair visible through it, a small smile.',
  rusty: 'Rusty, a small friendly rover robot on Mars: a cute boxy body, two big round camera eyes, little wheels, a small antenna, a bit of orange dust on it. The whole robot, not waist-up.',
  mika: 'Mika, a soft-spoken barista in her twenties: a brown bob haircut, a white shirt with a green apron, holding a cup of coffee with latte art.',
};
// what she wears on her head or around her neck (outfits.js): one of each, front view, alone
const ACCESSORY_PROMPTS = {
  'bow-pink': 'a big cute pink ribbon hair bow',
  'headphones-midnight': 'over-ear headphones: a black headband arch and two black ear cups with glowing pink rims',
  'headphones-gamer': 'gaming headphones: a black headband arch and two black ear cups with glowing mint-green lights',
  'catears-white': 'a pair of fluffy white cat ears with pink insides on a thin white headband',
  'catears-black': 'a pair of black cat ears with mint-green insides on a thin black headband',
  headset: 'a slim black headset microphone: a thin headband with a small round earpiece on one side and a thin microphone arm curving forward from it',
  glasses: 'a pair of thin round black glasses with clear see-through lenses',
  heartglasses: 'a pair of heart-shaped sunglasses with a white frame and pink lenses',
  'clips-mint': 'two small mint-green star-shaped hair clips side by side',
  'clips-honey': 'two small golden-yellow star-shaped hair clips side by side',
  'cap-blue': 'a blue baseball cap, its brim facing the viewer',
  'scarf-london': 'a cozy red knitted scarf with thin yellow stripes, wrapped once around a neck with its two ends hanging down in front (the neck itself not drawn)',
  'scarf-paris': 'a light red and white striped silk scarf tied loosely around a neck with a small knot at the side (the neck itself not drawn)',
  'scarf-istanbul': 'a light blue and white patterned scarf draped around a neck (the neck itself not drawn)',
  'beret-red': 'a red French beret, tilted a little to one side',
  'beret-lilac': 'a soft lilac beret, tilted a little to one side',
  'shades-dark': 'a pair of stylish sunglasses with dark lenses',
  'shades-gold': 'a pair of sunglasses with a thin gold frame and warm amber lenses',
  'shades-pink': 'a pair of sunglasses with a pink frame and pink tinted lenses',
  'beanie-yellow': 'a mustard yellow knitted beanie hat',
  'sunhat-pink': 'a wide-brimmed straw sun hat with a pink ribbon band',
  'sunhat-mint': 'a wide-brimmed straw sun hat with a mint-green ribbon band and a small yellow flower',
  garland: 'a garland of orange and yellow marigold flowers, as worn hanging around a neck (the neck itself not drawn)',
  'flower-orchid': 'a single purple orchid hair flower',
  'flower-frangipani': 'a single white frangipani hair flower with a yellow center',
  'flower-hibiscus': 'a single red hibiscus hair flower',
  'flower-pink': 'a single pink hibiscus hair flower',
  'flower-yellow': 'a single yellow hair flower',
  conical: 'a light straw conical hat, a wide shallow cone',
  sakura: 'a small hair clip with a sprig of pink cherry blossoms',
  'bucket-cream': 'a cream-colored bucket hat',
  helmet: 'a round white space helmet with a big clear glass visor (the visor is see-through: the background shows through it)',
};

// every picture: { id, group, file stem, prompt, aspect, ref (her picture as the style to match), variants }
export function artList() {
  const out = [];
  for (const id of PLACE_IDS) out.push({ id, group: 'places', aspect: '16:9', variants: 2,
    prompt: `${BG_STYLE} ${PLACE_PROMPTS[id]} ${BG_LAYOUT} ${BG_RULES}` });
  for (const [id, p] of Object.entries(ROOM_PROMPTS)) out.push({ id, group: 'rooms', aspect: '16:9', variants: 2, prompt: `${BG_STYLE} ${p} ${ROOM_LAYOUT} ${BG_RULES}` });
  for (const id of VEHICLE_IDS) out.push({ id, group: 'rides', aspect: '16:9', variants: 2, prompt: `${BG_STYLE} ${RIDE_PROMPTS[id]} ${INSIDE_LAYOUT} ${BG_RULES}` });
  for (const id of PEOPLE_IDS) out.push({ id, group: 'people', aspect: '3:4', variants: 2, refOn: [2],
    prompt: `${PERSON_STYLE} ${PERSON_PROMPTS[id]} ${PERSON_LAYOUT} ${GREEN}` });
  for (const [id, p] of Object.entries(ACCESSORY_PROMPTS)) out.push({ id, group: 'accessories', aspect: '1:1', variants: 1,
    prompt: `A single item, alone, with no person and no head: ${p}. Seen straight from the front, as it would look worn by a girl facing the viewer. ${ACC_STYLE} ${GREEN}` });
  return out;
}
export const ART_GROUPS = ['places', 'rooms', 'rides', 'people', 'accessories'];
export const PROMPTS = { places: PLACE_PROMPTS, rooms: ROOM_PROMPTS, rides: RIDE_PROMPTS, people: PERSON_PROMPTS, accessories: ACCESSORY_PROMPTS };
// what's on a green background (cut out afterwards): kept without JPEG's blur; the rest as JPEG
export const extOf = (group) => (group === 'people' || group === 'accessories' ? 'webp' : 'jpg');

// ---------- Google's image models (Vertex AI / Agent Platform) ----------
// tried in order until one answers (a model Google doesn't have for this project: 404, the next one); LIVE_ART_MODEL first.
// Their codes as ai.google.dev lists them (2026-10-07: Nano Banana 2.1, then Nano Banana 2, both stable; the legacy one last)
export const ART_MODELS = ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
// her picture as the art style to match (one of the two of each person): her 2D self, rendered from her Live2D model (the
// look she has on stream), never the 3D model or a render of it (the owner: "the 3d model is 18+"); cut above the "AGI" on
// her shirt (the letters must not end up on anyone else's), on white, as PNG
export const STYLE_REF = 'public/images/agi1-live-2d.webp';
export async function styleRef(sharp, file = new URL(`../../${STYLE_REF}`, import.meta.url)) {
  const img = sharp(readFileSync(file));
  const { width, height } = await img.metadata();
  return img.extract({ left: 0, top: 0, width, height: Math.round(height * 0.83) }).flatten({ background: '#ffffff' }).png().toBuffer();
}
export function artSettings(env = process.env) {
  const first = String(env.LIVE_ART_MODEL || '').trim();
  return {
    keyFile: String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
    project: String(env.LIVE_GCP_PROJECT || '').trim(),
    location: String(env.LIVE_VERTEX_LOCATION || 'global').trim() || 'global',
    models: [...new Set([...(first ? [first] : []), ...ART_MODELS])],
    outDir: join(String(env.LIVE_OUT_DIR || '').trim() || '.', 'art'),
    max: Math.min(400, Math.max(1, Number(env.LIVE_ART_MAX) || 220)),
  };
}
export function artRequest(s, model, item, { bearer, ref = null, size = true, imageOnly = true } = {}) {
  const host = s.location === 'global' ? 'aiplatform.googleapis.com' : `${s.location}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1beta1/projects/${encodeURIComponent(s.project)}/locations/${encodeURIComponent(s.location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  const parts = [...(ref ? [{ inlineData: { mimeType: 'image/png', data: ref.toString('base64') } }] : []), { text: ref ? `${item.prompt} ${PERSON_REF}` : item.prompt }];
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: imageOnly ? ['IMAGE'] : ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: item.aspect, ...(size ? { imageSize: '1K' } : {}) } },
      }),
      signal: AbortSignal.timeout(150_000),
    },
  };
}
// the picture in an answer (base64 → bytes), or null (a refusal: text only, or nothing)
export function imageFrom(data) {
  for (const c of Array.isArray(data?.candidates) ? data.candidates : []) {
    for (const p of Array.isArray(c?.content?.parts) ? c.content.parts : []) {
      const inline = p?.inlineData || p?.inline_data;
      if (inline && typeof inline.data === 'string' && inline.data && /^image\//.test(String(inline.mimeType || inline.mime_type || 'image/png'))) return Buffer.from(inline.data, 'base64');
    }
  }
  return null;
}
// the files to make: each picture's variants not made yet (or, with `only`, one more of each of those)
export function toMake(list, outDir, { only = [], exists = existsSync, files = (d) => { try { return readdirSync(d); } catch { return []; } } } = {}) {
  const jobs = [];
  for (const item of list) {
    const ext = extOf(item.group), dir = join(outDir, item.group);
    if (only.length) {
      if (!only.includes(item.id)) continue;
      const have = files(dir).filter((f) => f.startsWith(`${item.id}-`) && f.endsWith(`.${ext}`)).map((f) => Number(f.slice(item.id.length + 1, -ext.length - 1))).filter(Number.isFinite);
      const k = (have.length ? Math.max(...have) : 0) + 1;
      jobs.push({ item, k, file: join(dir, `${item.id}-${k}.${ext}`), ref: (item.refOn || []).includes(k % 2 === 0 ? 2 : 1) });
      continue;
    }
    for (let k = 1; k <= item.variants; k++) {
      const file = join(dir, `${item.id}-${k}.${ext}`);
      if (!exists(file)) jobs.push({ item, k, file, ref: (item.refOn || []).includes(k) });
    }
  }
  return jobs;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function googleError(status, text) {
  const err = new Error(`HTTP ${status} ${String(text).replace(/ya29\.[0-9A-Za-z._-]+/g, '[token]').slice(0, 400)}`);
  err.status = status;
  return err;
}

// make them: two at a time, at Google's pace (a "wait" waits and tries again), resuming where a run stopped
export async function makeArt({ env = process.env, only = [], log = console, fetchFn = fetch, refFile = null, sleepFn = sleep } = {}) {
  const s = artSettings(env);
  if (!s.keyFile) throw new Error('no GOOGLE_APPLICATION_CREDENTIALS key file (the same one as her voice: /opt/agi1-live/google-key.json)');
  const sa = serviceAccount(readFileSync(s.keyFile, 'utf8'));
  if (!s.project) s.project = sa.project;
  const list = artList();
  const unknown = only.filter((id) => !list.some((x) => x.id === id));
  if (unknown.length) throw new Error(`--art-only: no picture called ${unknown.join(', ')} (one of ${list.map((x) => x.id).join(', ')})`);
  const jobs = toMake(list, s.outDir, { only }).slice(0, s.max);
  if (!jobs.length) { log.log(`every picture is made already: ${s.outDir}`); return { made: 0, failed: 0 }; }
  log.log(`making ${jobs.length} picture(s) with Google's image AI into ${s.outDir} (about $${(jobs.length * 0.035).toFixed(2)}–$${(jobs.length * 0.07).toFixed(2)} on the Google Cloud card)…`);
  const sharp = (await import('sharp')).default;
  // her 2D picture, as the art style to match (one of the two of each person)
  let ref = null;
  try { ref = await styleRef(sharp, refFile || undefined); } catch { ref = null; }
  const manifestFile = join(s.outDir, 'manifest.json');
  let manifest = { made: [] };
  try { manifest = JSON.parse(readFileSync(manifestFile, 'utf8')); } catch { /* a first run */ }
  let model = null, made = 0, failed = 0, done = 0;
  // what the model takes, learned once for the whole run: the picture's size (imageSize), and asking for a picture only
  let size = true, imageOnly = true;
  const t0 = Date.now();

  async function one(job) {
    let models = model ? [model] : s.models;
    for (let attempt = 0; attempt < 6; attempt++) {
      const m = models[0];
      const bearer = await accessToken(sa, { fetchFn });
      // (what this request asks for: the other worker may learn something meanwhile)
      const sent = { size, imageOnly };
      const { url, init } = artRequest(s, m, job.item, { bearer, ref: job.ref ? ref : null, ...sent });
      let res;
      try { res = await fetchFn(url, init); } catch (err) { log.log(`  ${job.item.id}-${job.k}: ${err.name === 'TimeoutError' ? 'no answer in time' : err.message}: trying again`); await sleepFn(5000); continue; }
      if (res.ok) {
        model = m;
        const bytes = imageFrom(await res.json());
        if (!bytes) { log.log(`  ${job.item.id}-${job.k}: Google gave no picture (it refused it): skipped`); return false; }
        mkdirSync(join(s.outDir, job.item.group), { recursive: true });
        const img = sharp(bytes);
        const out = extOf(job.item.group) === 'jpg' ? await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer() : await img.webp({ quality: 95 }).toBuffer();
        writeFileSync(job.file, out);
        manifest.made.push({ file: job.file.slice(s.outDir.length + 1), id: job.item.id, group: job.item.group, k: job.k, model: m, ref: Boolean(job.ref && ref), prompt: job.item.prompt });
        writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
        return true;
      }
      const text = await res.text().catch(() => '');
      if (res.status === 401) { forgetToken(); continue; }
      if (res.status === 404 && models.length > 1 && !model) { log.log(`  (${m} isn't there for this project: trying ${models[1]})`); models = models.slice(1); attempt--; continue; }
      if (res.status === 400 && sent.size && /imageSize|image_size|size/i.test(text)) { size = false; attempt--; continue; }
      if (res.status === 400 && sent.imageOnly && /modalit/i.test(text)) { imageOnly = false; attempt--; continue; }
      if (res.status === 429 || res.status >= 500) { const wait = 15_000 * (attempt + 1); log.log(`  ${job.item.id}-${job.k}: Google said "wait" (${res.status}): ${wait / 1000} s`); await sleepFn(wait); continue; }
      if (res.status === 403) throw googleError(403, `${text} (enable the "Agent Platform API" and give the service account the "Agent Platform User" role, as for her voice)`);
      log.log(`  ${job.item.id}-${job.k}: ${googleError(res.status, text).message}: skipped`);
      return false;
    }
    log.log(`  ${job.item.id}-${job.k}: gave up after a few tries: skipped`);
    return false;
  }
  // two at a time
  const queue = jobs.slice();
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      const ok = await one(job);
      done += 1;
      if (ok) made += 1; else failed += 1;
      if (done % 5 === 0 || done === jobs.length) log.log(`  ${done} of ${jobs.length} (${made} made${failed ? `, ${failed} skipped` : ''}, ${Math.round((Date.now() - t0) / 1000)} s)`);
    }
  }
  // the first one alone (it finds the model), then two at a time
  if (queue.length) { const first = queue.shift(); const ok = await one(first); done += 1; if (ok) made += 1; else failed += 1; }
  if (!model) throw new Error(`no picture could be made (the models tried: ${s.models.join(', ')}): see the lines above`);
  await Promise.all([worker(), worker()]);
  log.log(`${made} picture(s) made with ${model || 'Google'} in ${Math.round((Date.now() - t0) / 1000)} s${failed ? `, ${failed} skipped (run it again for those)` : ''}: ${s.outDir}`);
  return { made, failed, model };
}
