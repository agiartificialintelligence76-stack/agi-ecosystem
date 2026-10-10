// An MP4's (or a MOV's) own header, read without any package (2026-10-10, AGI Studio): its length, its video's size and its
// frames a second. Pure, light to load: the uploads (server/inf-uploads.js), the jobs (server/inf-jobs.js) and the clock's
// share mark (server/inf-mark.js) read it.
// What its header says (the movie's "moov" box, wherever it is in the file): its length in seconds ("mvhd"), and its video
// track's size in pixels ("tkhd": 16.16 fixed-point numbers) and frames a second (its samples ("stts") over its own length
// ("mdhd"): unknown, null, for a fragmented file, whose samples aren't in its header). → { seconds, width, height, fps } (any
// of them null when it can't be read), or null when it isn't an MP4
export function mp4Info(b) {
  if (!Buffer.isBuffer(b) || b.length < 16 || b.toString('latin1', 4, 8) !== 'ftyp') return null;
  const boxes = (start, end) => {
    const out = [];
    let i = start;
    while (i + 8 <= end) {
      let size = b.readUInt32BE(i);
      const type = b.toString('latin1', i + 4, i + 8);
      let head = 8;
      if (size === 1) {
        if (i + 16 > end) break;
        size = Number(b.readBigUInt64BE(i + 8));
        head = 16;
      } else if (size === 0) size = end - i;
      if (!Number.isSafeInteger(size) || size < head || i + size > end) break;
      out.push({ type, start: i + head, end: i + size });
      i += size;
    }
    return out;
  };
  const child = (box, type) => (box ? boxes(box.start, box.end).find((x) => x.type === type) || null : null);
  const moov = boxes(0, b.length).find((x) => x.type === 'moov');
  if (!moov) return null;
  const info = { seconds: null, width: null, height: null, fps: null };
  const mvhd = child(moov, 'mvhd');
  if (mvhd) {
    const v1 = b[mvhd.start] === 1;
    if (mvhd.start + (v1 ? 32 : 20) <= mvhd.end) {
      const scale = b.readUInt32BE(mvhd.start + (v1 ? 20 : 12));
      const length = v1 ? Number(b.readBigUInt64BE(mvhd.start + 24)) : b.readUInt32BE(mvhd.start + 16);
      if (scale && Number.isFinite(length)) info.seconds = length / scale;
    }
  }
  for (const trak of boxes(moov.start, moov.end).filter((x) => x.type === 'trak')) {
    const mdia = child(trak, 'mdia');
    const hdlr = child(mdia, 'hdlr');
    if (!hdlr || hdlr.start + 12 > hdlr.end || b.toString('latin1', hdlr.start + 8, hdlr.start + 12) !== 'vide') continue;
    const tkhd = child(trak, 'tkhd');
    if (tkhd) {
      const at = tkhd.start + (b[tkhd.start] === 1 ? 88 : 76);
      if (at + 8 <= tkhd.end) {
        info.width = Math.round(b.readUInt32BE(at) / 65536);
        info.height = Math.round(b.readUInt32BE(at + 4) / 65536);
      }
    }
    const mdhd = child(mdia, 'mdhd');
    const stts = child(child(child(mdia, 'minf'), 'stbl'), 'stts');
    if (mdhd && stts && stts.start + 8 <= stts.end) {
      const v1 = b[mdhd.start] === 1;
      if (mdhd.start + (v1 ? 32 : 20) <= mdhd.end) {
        const scale = b.readUInt32BE(mdhd.start + (v1 ? 20 : 12));
        const length = v1 ? Number(b.readBigUInt64BE(mdhd.start + 24)) : b.readUInt32BE(mdhd.start + 16);
        const entries = b.readUInt32BE(stts.start + 4);
        let samples = 0;
        for (let e = 0; e < entries && stts.start + 8 + e * 8 + 8 <= stts.end; e++) samples += b.readUInt32BE(stts.start + 8 + e * 8);
        if (scale && length && samples) info.fps = Math.round((samples / (length / scale)) * 100) / 100;
      }
    }
    break;
  }
  return info;
}
// Its length in seconds alone (mp4Info's), or null
export const mp4Seconds = (b) => mp4Info(b)?.seconds ?? null;
