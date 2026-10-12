// AGI Studio's hidden AI tag (2026-10-12, the owner: "can you put watermark when they download or export their vid,photos it
// will be removed if they hold $agi atleast 1000"; the owner's choices: "Our pill, as now", "Hidden AI tag"). Every photo and
// video downloaded says inside its file that it's AI-made, whether or not it carries our visible pill (a holder of 1,000+ $AGI
// downloads its own without the pill): XMP with the IPTC's "Digital Source Type" (trainedAlgorithmicMedia: the standard tag
// Instagram, Facebook and Google read for pictures). Pure: our server (server/inf-api.js, server/inf-jobs.js) and the
// browser (the photo editor's download) both use it; nothing here is Node's or a browser's own.
//   A JPEG: one APP1 segment of XMP right after its start (after a JFIF APP0, where there is one), as Adobe's XMP spec puts it.
//   An MP4: one top-level 'uuid' box of XMP (Adobe's XMP UUID) appended after everything else, so no offset in it moves.
export const DIGITAL_SOURCE = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
export const AI_WORDS = 'AI-generated with AGI Studio (studio.agi1.app)';
export const AI_XMP = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
 xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:xmp="http://ns.adobe.com/xap/1.0/"
 Iptc4xmpExt:DigitalSourceType="${DIGITAL_SOURCE}"
 xmp:CreatorTool="AGI Studio">
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${AI_WORDS}</rdf:li></rdf:Alt></dc:description>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>`;
const XMP_NS = 'http://ns.adobe.com/xap/1.0/\0';
// Adobe's UUID for XMP in an ISO media file (BE7ACFCB-97A9-42E8-9C71-999491E3AFAC)
export const XMP_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];
const TOKEN = 'trainedAlgorithmicMedia';

const encoder = new TextEncoder();
const u8 = (b) => (b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b) : null);
const ascii = (b, at, n) => { let s = ''; for (let k = 0; k < n && at + k < b.length; k++) s += String.fromCharCode(b[at + k]); return s; };
// whether bytes [from, to) hold our tag's token (latin-1 is enough: the token is ASCII)
const holds = (b, from, to) => ascii(b, from, Math.max(0, to - from)).includes(TOKEN);
const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];

// ---------- a JPEG ----------
export const isJpeg = (bytes) => { const b = u8(bytes); return Boolean(b && b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff); };
// its segments before its picture's data: [{ marker, at (where its FF is), end }] · null when they don't add up
function jpegSegments(b) {
  const out = [];
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker === 0xda || marker === 0xd9) break;                 // its picture's data (or its end): no more segments
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const len = (b[at + 2] << 8) | b[at + 3];
    if (len < 2 || at + 2 + len > b.length) return null;
    out.push({ marker, at, end: at + 2 + len });
    at += 2 + len;
  }
  return out;
}
const xmpSegment = (b, s) => s.marker === 0xe1 && ascii(b, s.at + 4, XMP_NS.length) === XMP_NS;
// A JPEG with our tag (as it is when it has it already) → Uint8Array · null when it isn't a JPEG we read
export function jpegWithXmp(bytes) {
  const b = u8(bytes);
  if (!isJpeg(b)) return null;
  const segs = jpegSegments(b);
  if (!segs) return null;
  if (segs.some((s) => xmpSegment(b, s) && holds(b, s.at, s.end))) return b;
  // (right after its start, or after its JFIF APP0 and Exif APP1 segments: the order Adobe's XMP spec and readers expect)
  let k = 0;
  while (k < segs.length && (segs[k].marker === 0xe0 || (segs[k].marker === 0xe1 && ascii(b, segs[k].at + 4, 6) === 'Exif\0\0'))) k++;
  const at = k ? segs[k - 1].end : 2;
  const head = encoder.encode(XMP_NS), body = encoder.encode(AI_XMP);
  const len = 2 + head.length + body.length;
  if (len > 0xffff) return null;
  const out = new Uint8Array(b.length + 2 + len);
  out.set(b.subarray(0, at), 0);
  out.set([0xff, 0xe1, len >> 8, len & 0xff], at);
  out.set(head, at + 4);
  out.set(body, at + 4 + head.length);
  out.set(b.subarray(at), at + 2 + len);
  return out;
}

// ---------- an MP4 ----------
// its top-level boxes: [{ type, at, end }] · null when they don't add up (or one runs to the end of the file: size 0)
function mp4Boxes(b) {
  const out = [];
  let at = 0;
  while (at + 8 <= b.length) {
    let size = u32(b, at);
    const type = ascii(b, at + 4, 4);
    let head = 8;
    if (size === 1) {
      if (at + 16 > b.length) return null;
      size = u32(b, at + 8) * 2 ** 32 + u32(b, at + 12);
      head = 16;
    }
    if (size === 0 || size < head || at + size > b.length) return null;
    out.push({ type, at, end: at + size, head });
    at += size;
  }
  return at === b.length ? out : null;
}
const isXmpBox = (b, x) => x.type === 'uuid' && XMP_UUID.every((v, k) => b[x.at + x.head + k] === v);
// An MP4 with our tag (as it is when it has it already) → Uint8Array · null when it isn't one we read
export function mp4WithXmp(bytes) {
  const b = u8(bytes);
  if (!b || b.length < 16 || ascii(b, 4, 4) !== 'ftyp') return null;
  const boxes = mp4Boxes(b);
  if (!boxes) return null;
  if (boxes.some((x) => isXmpBox(b, x) && holds(b, x.at, x.end))) return b;
  const body = encoder.encode(AI_XMP);
  const size = 8 + XMP_UUID.length + body.length;
  const out = new Uint8Array(b.length + size);
  out.set(b, 0);
  out.set([size >>> 24, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff, 0x75, 0x75, 0x69, 0x64], b.length);   // size, 'uuid'
  out.set(XMP_UUID, b.length + 8);
  out.set(body, b.length + 8 + XMP_UUID.length);
  return out;
}

// Whether a JPEG or an MP4 carries our tag
export function hasAiTag(bytes) {
  const b = u8(bytes);
  if (!b) return false;
  if (isJpeg(b)) return Boolean(jpegSegments(b)?.some((s) => xmpSegment(b, s) && holds(b, s.at, s.end)));
  if (b.length >= 16 && ascii(b, 4, 4) === 'ftyp') return Boolean(mp4Boxes(b)?.some((x) => isXmpBox(b, x) && holds(b, x.at, x.end)));
  return false;
}
// Either kind, by what it is → Uint8Array (with our tag) · null when it's neither one we read
export const withAiTag = (bytes) => (isJpeg(bytes) ? jpegWithXmp(bytes) : mp4WithXmp(bytes));
