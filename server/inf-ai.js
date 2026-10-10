// AGI Studio (2026-10-10): the AI services behind an influencer, and the AI checks of what people upload.
//   • fal.ai's queue (server/fal.js, one key: FAL_KEY), from the models' pages on fal (read 2026-10-10):
//       Nano Banana 2 (Google's image model): its looks from words (fal-ai/nano-banana-2) or from a picture (…/edit: its
//         looks from a character's picture or a selfie, its full body from the look it picked, its photos in a scene);
//         1K pictures, about $0.08 each; safety_tolerance "2" (strict)
//       Kling V3 Standard (Kuaishou's video model): a trend video copies a video's moves onto its picture (motion-control,
//         about $0.126 a second: at most 10 s), a scene video brings one of its photos to life (image-to-video, 5 s), and the
//         owner's trend moves are made once from words (text-to-video, 10 s, no sound)
//       Seedance 2.5's reference-to-video (STUDIO_VIDEO_MODEL, the studio's video model): a scene video of an anime or cartoon
//         influencer from its full body (it says no to realistic faces: those start from one of its photos instead)
//   • Gemini (the site's own key, GEMINI_API_KEY, the chat's model): a look at each picture, selfie and clip uploaded before
//     it's used, and at each video made before it's shown (family-friendly, never a minor, never a real person from a
//     picture, never someone else's character). Fail closed: a check that can't be made counts as not passed yet.
// Nothing here is shown to visitors as a provider's name (the page says "an AI service").
import {
  looksPrompt, bodyPrompt, photoPrompt, motionPrompt, clipPrompt, CLIP_NEGATIVE, sceneVideoPrompt, sceneWay, presetPrompt, PRESET_NEGATIVE,
} from './inf-words.js';
import { SHAPES } from '../src/studio/rules.js';

export const MODELS = {
  image: 'fal-ai/nano-banana-2',
  edit: 'fal-ai/nano-banana-2/edit',
  motion: 'fal-ai/kling-video/v3/standard/motion-control',
  i2v: 'fal-ai/kling-video/v3/standard/image-to-video',
  t2v: 'fal-ai/kling-video/v3/standard/text-to-video',
};
const SAFETY = '2';
const RATIO = (shape) => SHAPES[shape]?.ratio || SHAPES.tall.ratio;
const picture = (extra) => ({ resolution: '1K', output_format: 'jpeg', safety_tolerance: SAFETY, ...extra });

// An influencer as the words need it, from a job (supabase/influencers.sql inf_job_get: its influencer's parts)
export const infOfJob = (job) => ({
  name: job.inf_name, mode: job.inf_mode, style: job.inf_style, settings: job.inf_settings || {}, words: job.inf_words || '',
});

// The request for a job. urls: signed addresses of what it's made from (source: the upload; look: the picked look; body: its
// full body; image: one of its photos; clip: the person's clip; trend: the trend move's video). → { model, input, way }
// · throws (why 'request') when something it needs isn't there
export function jobRequest(cfg, job, urls = {}, { user = null } = {}) {
  const need = (u, what) => {
    if (typeof u !== 'string' || !/^https:\/\//.test(u)) throw Object.assign(new Error(`inf: no ${what} to make it from`), { why: 'request' });
    return u;
  };
  const inf = infOfJob(job);
  if (job.kind === 'looks') {
    if (inf.mode === 'design') return { model: MODELS.image, way: 'image', input: picture({ prompt: looksPrompt(inf), num_images: 4, aspect_ratio: '1:1' }) };
    return { model: MODELS.edit, way: 'edit', input: picture({ prompt: looksPrompt(inf), image_urls: [need(urls.source, 'picture')], num_images: 4, aspect_ratio: '1:1' }) };
  }
  if (job.kind === 'body') {
    const selfie = inf.mode === 'face' && typeof urls.source === 'string' && /^https:\/\//.test(urls.source);
    return {
      model: MODELS.edit, way: 'edit',
      input: picture({ prompt: bodyPrompt(inf, { withSelfie: selfie }), image_urls: [need(urls.look, 'look'), ...(selfie ? [urls.source] : [])], num_images: 1, aspect_ratio: '9:16' }),
    };
  }
  if (job.kind === 'photo') {
    return { model: MODELS.edit, way: 'edit', input: picture({ prompt: photoPrompt(inf, job.scene), image_urls: [need(urls.body, 'full body')], num_images: 1, aspect_ratio: RATIO(job.shape) }) };
  }
  if (job.kind === 'trend') {
    return {
      model: MODELS.motion, way: 'motion',
      input: {
        prompt: motionPrompt(inf), image_url: need(urls.image || urls.body, 'picture'), video_url: need(job.clip ? urls.clip : urls.trend, 'video'),
        character_orientation: 'video', keep_original_sound: false,
      },
    };
  }
  if (job.kind === 'video') {
    const way = sceneWay(inf, { image: job.image });
    if (way === 'photo') {
      return {
        model: MODELS.i2v, way: 'i2v',
        input: { prompt: clipPrompt(inf, job.scene), start_image_url: need(urls.image, 'photo'), duration: '5', generate_audio: job.sound === true, negative_prompt: CLIP_NEGATIVE },
      };
    }
    if (way !== 'reference') throw Object.assign(new Error("inf: a realistic influencer's video starts from one of its photos"), { why: 'request' });
    return {
      model: cfg.videoModel, way: 'reference',
      input: {
        prompt: sceneVideoPrompt(inf, job.scene), image_urls: [need(urls.body, 'full body')], resolution: '720p', duration: '5',
        aspect_ratio: RATIO(job.shape), generate_audio: job.sound === true, bitrate_mode: 'standard', codec: 'H264', ...(user ? { end_user_id: user } : {}),
      },
    };
  }
  if (job.kind === 'preset') {
    const prompt = presetPrompt(job.trend);
    if (!prompt) throw Object.assign(new Error('inf: not one of the trend moves'), { why: 'request' });
    return { model: MODELS.t2v, way: 't2v', input: { prompt, duration: '10', aspect_ratio: '9:16', generate_audio: false, negative_prompt: PRESET_NEGATIVE } };
  }
  throw Object.assign(new Error(`inf: no job kind ${job.kind}`), { why: 'request' });
}

// What a finished request made: its pictures (up to 4) or its video. → { images: [url] } | { video: url } · throws (why
// 'nothing') when there's none
export function outputOf(kind, out) {
  if (['looks', 'body', 'photo'].includes(kind)) {
    const images = (Array.isArray(out?.images) ? out.images : []).map((i) => i?.url).filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 4);
    if (!images.length) throw Object.assign(new Error('fal: its result has no picture'), { why: 'nothing' });
    return { images };
  }
  const u = out?.video?.url;
  if (typeof u !== 'string' || !/^https:\/\//.test(u)) throw Object.assign(new Error('fal: its result has no video'), { why: 'nothing' });
  return { video: u };
}

// ---------- Gemini's look (the site's key) ----------
const INLINE_MAX = 14_000_000;                 // a video looked at inline (Gemini takes at most 20 MB a request, base64 included)
async function look(cfg, { system, parts, schema, timeoutMs = 12_000 }) {
  if (!cfg.geminiKey) throw Object.assign(new Error("inf: GEMINI_API_KEY is missing: uploads and videos can't be checked"), { why: 'ai' });
  // (the chat's Gemini module, loaded only here: the jobs' clock that never checks anything stays light)
  const { SAFETY_SETTINGS, BLOCKED_REASONS, geminiError } = await import('./gemini.js');
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: 200, thinkingConfig: { thinkingLevel: 'MINIMAL' }, responseMimeType: 'application/json', responseJsonSchema: schema,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw Object.assign(new Error(`gemini: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'unreachable'}`), { why: 'ai' });
  }
  if (!res.ok) throw Object.assign(await geminiError(res, cfg.geminiKey), { why: 'ai' });
  const data = await res.json().catch(() => null);
  const c = data?.candidates?.[0];
  if (data?.promptFeedback?.blockReason || !c || BLOCKED_REASONS.has(c.finishReason)) return { blocked: true };
  const text = (c.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('gemini: an answer that is not JSON'), { why: 'ai' }); }
}
const yes = { type: 'boolean' };
const count = { type: 'integer' };
const inline = (mimeType, bytes) => ({ inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } });

// A selfie for "Use my face" (a live camera picture, its owner 18+ and agreeing). → { ok: true } | { ok: false, why: 'none' |
// 'many' | 'minor' | 'screen' | 'sexual' | 'hate' | 'violence' | 'other' } · throws (why 'ai') when Gemini can't say
export async function checkSelfie(cfg, jpeg) {
  const r = await look(cfg, {
    system: 'You check a selfie someone just took with their camera, to make an AI twin of themselves. Answer only about what '
      + 'you see, in the JSON asked for. faces: how many human faces are clearly visible. photo: it is a real camera photo of a '
      + 'real person (not a drawing, a render or AI art). apparentAge: your best guess of the main person\'s age in years. adult: '
      + 'the main person clearly looks 21 or older (if in any doubt, false). screen: it is a photo of a screen, a printed photo, '
      + 'a poster, a magazine or a mask rather than a live person in front of the camera. explicit: nudity, underwear, a '
      + 'revealing outfit or anything sexual. hateful: hate symbols or gestures. violent: violence, weapons or blood. other: '
      + 'anything else that makes it unsuitable for a family-friendly app (a child anywhere in it included).',
    parts: [inline('image/jpeg', jpeg), { text: 'Check this selfie.' }],
    schema: { type: 'object', properties: { faces: count, photo: yes, apparentAge: count, adult: yes, screen: yes, explicit: yes, hateful: yes, violent: yes, other: yes },
      required: ['faces', 'photo', 'apparentAge', 'adult', 'screen', 'explicit', 'hateful', 'violent', 'other'] },
  });
  if (r.blocked) return { ok: false, why: 'sexual' };
  if (r.explicit === true) return { ok: false, why: 'sexual' };
  if (r.photo !== true || !(r.faces >= 1)) return { ok: false, why: 'none' };
  if (r.faces > 1) return { ok: false, why: 'many' };
  if (r.adult !== true || !(Number(r.apparentAge) >= 21)) return { ok: false, why: 'minor' };
  if (r.screen === true) return { ok: false, why: 'screen' };
  if (r.hateful === true) return { ok: false, why: 'hate' };
  if (r.violent === true) return { ok: false, why: 'violence' };
  if (r.other === true) return { ok: false, why: 'other' };
  return { ok: true };
}

// A character's picture for "From a picture": artwork of one original adult character, never a photo of a real person or
// someone else's well-known character. → { ok: true } | { ok: false, why: 'real_person' | 'none' | 'many' | 'minor' |
// 'copyright' | 'sexual' | 'hate' | 'violence' | 'other' } · throws (why 'ai')
export async function checkArt(cfg, jpeg) {
  const r = await look(cfg, {
    system: 'You check a picture someone uploaded to turn into an AI influencer character. It must be a drawing, a painting, a '
      + '3D render or other artwork of one original character, never a photo of a real person. Answer only about what you see, '
      + 'in the JSON asked for. characters: how many characters (people or person-like characters with a face) are clearly '
      + 'visible. photo: it is a photo of a real person, or so realistic it could pass for one. adult: the main character '
      + 'clearly looks like an adult (false for a child, a teen or a childlike character, and if in any doubt). known: it is a '
      + 'well-known character or mascot from a film, a series, a game, an anime, a comic, a toy or a brand, or a real '
      + 'celebrity drawn. explicit: nudity, underwear, a revealing outfit or anything sexual. hateful: hate symbols. violent: '
      + 'violence, weapons or gore. other: anything else unsuitable for a family-friendly app.',
    parts: [inline('image/jpeg', jpeg), { text: 'Check this picture.' }],
    schema: { type: 'object', properties: { characters: count, photo: yes, adult: yes, known: yes, explicit: yes, hateful: yes, violent: yes, other: yes },
      required: ['characters', 'photo', 'adult', 'known', 'explicit', 'hateful', 'violent', 'other'] },
  });
  if (r.blocked || r.explicit === true) return { ok: false, why: 'sexual' };
  if (r.photo === true) return { ok: false, why: 'real_person' };
  if (!(r.characters >= 1)) return { ok: false, why: 'none' };
  if (r.characters > 1) return { ok: false, why: 'many' };
  if (r.adult !== true) return { ok: false, why: 'minor' };
  if (r.known === true) return { ok: false, why: 'copyright' };
  if (r.hateful === true) return { ok: false, why: 'hate' };
  if (r.violent === true) return { ok: false, why: 'violence' };
  if (r.other === true) return { ok: false, why: 'other' };
  return { ok: true };
}

// A clip's moves (its frames, taken in the person's browser): someone moving, nobody who looks under 18, nothing sexual.
// → { ok: true } | { ok: false, why: 'none' | 'minor' | 'sexual' | 'hate' | 'violence' | 'other' } · throws (why 'ai')
export async function checkFrames(cfg, frames) {
  const r = await look(cfg, {
    system: 'These are frames from a short video someone uploaded so that their AI character can copy the moves in it (a dance '
      + 'or a gesture). Answer only about what you see, in the JSON asked for. people: the most people visible in any frame. '
      + 'adult: everyone visible clearly looks 18 or older (if in any doubt, false). explicit: nudity, underwear, sexual moves '
      + 'or poses, or a revealing outfit. hateful: hate symbols or gestures. violent: violence or weapons. other: anything else '
      + 'unsuitable for a family-friendly app.',
    parts: [...frames.map((f) => inline('image/jpeg', f)), { text: 'Check these frames.' }],
    schema: { type: 'object', properties: { people: count, adult: yes, explicit: yes, hateful: yes, violent: yes, other: yes },
      required: ['people', 'adult', 'explicit', 'hateful', 'violent', 'other'] },
  });
  if (r.blocked || r.explicit === true) return { ok: false, why: 'sexual' };
  if (!(r.people >= 1)) return { ok: false, why: 'none' };
  if (r.adult !== true) return { ok: false, why: 'minor' };
  if (r.hateful === true) return { ok: false, why: 'hate' };
  if (r.violent === true) return { ok: false, why: 'violence' };
  if (r.other === true) return { ok: false, why: 'other' };
  return { ok: true };
}

// A video made for an influencer, before anyone sees it: family-friendly, nobody who looks under 18. Too big to look at in
// one request (rare): looked at no further (the video models screen their own). → { ok: true, checked } | { ok: false, why }
export async function checkVideo(cfg, mp4) {
  if (mp4.length > INLINE_MAX) return { ok: true, checked: false };
  const r = await look(cfg, {
    system: 'This is a short AI-made video of an AI influencer character, about to be shown in a family-friendly app. Answer '
      + 'only about what you see and hear, in the JSON asked for. explicit: nudity, underwear, sexual moves or poses, or a '
      + 'revealing outfit. minor: anyone in it looks under 18. hateful: hate symbols, gestures or words. violent: violence, '
      + 'weapons or gore. other: anything else unsuitable for a family-friendly app.',
    parts: [inline('video/mp4', mp4), { text: 'Check this video.' }],
    schema: { type: 'object', properties: { explicit: yes, minor: yes, hateful: yes, violent: yes, other: yes }, required: ['explicit', 'minor', 'hateful', 'violent', 'other'] },
    timeoutMs: 15_000,
  });
  if (r.blocked || r.explicit === true) return { ok: false, why: 'sexual' };
  if (r.minor === true) return { ok: false, why: 'minor' };
  if (r.hateful === true) return { ok: false, why: 'hate' };
  if (r.violent === true) return { ok: false, why: 'violence' };
  if (r.other === true) return { ok: false, why: 'other' };
  return { ok: true, checked: true };
}

// A video's poster (a frame its page took, for Explore's tiles), next to the influencer's own look: the same character, and
// family-friendly. → { ok: true } | { ok: false, why: 'other' | 'sexual' | … } · throws (why 'ai')
export async function checkPoster(cfg, poster, lookJpeg) {
  const r = await look(cfg, {
    system: 'The first picture shows an AI influencer character. The second is a frame from a video of it, to be shown as the '
      + 'video\'s thumbnail in a family-friendly app. Answer only about what you see, in the JSON asked for. same: the second '
      + 'picture shows the same character as the first. explicit: nudity, underwear, sexual poses or a revealing outfit. '
      + 'minor: anyone in it looks under 18. hateful: hate symbols. violent: violence or gore. other: anything else unsuitable.',
    parts: [inline('image/jpeg', lookJpeg), inline('image/jpeg', poster), { text: 'Check the second picture.' }],
    schema: { type: 'object', properties: { same: yes, explicit: yes, minor: yes, hateful: yes, violent: yes, other: yes }, required: ['same', 'explicit', 'minor', 'hateful', 'violent', 'other'] },
  });
  if (r.blocked || r.explicit === true) return { ok: false, why: 'sexual' };
  if (r.minor === true) return { ok: false, why: 'minor' };
  if (r.same !== true) return { ok: false, why: 'other' };
  if (r.hateful === true) return { ok: false, why: 'hate' };
  if (r.violent === true) return { ok: false, why: 'violence' };
  if (r.other === true) return { ok: false, why: 'other' };
  return { ok: true };
}
