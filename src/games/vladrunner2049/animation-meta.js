// Anchors measured from the shipped transparent drawings, in source-cell pixels.
// The pelvis stays over the actor's world position; rows share a floor line.
// sourceHeight is anatomical scale, not each pose's bounding height: crouching
// and airborne drawings must keep their compression and lift.
const frames = (anchors, baselines, cols = 4) => anchors.map((anchorX, i) => ({
  anchorX, baseline: baselines.length === anchors.length ? baselines[i] : baselines[Math.floor(i / cols)],
}));

export const ANIMATION_META = {
  vlad: { cols: 4, rows: 2, sourceHeight: 455, height: 214, frames: [
    { anchorX: 190, baseline: 490 }, { anchorX: 242, baseline: 480 },
    { anchorX: 207, baseline: 480 }, { anchorX: 196, baseline: 480 },
    { anchorX: 149, baseline: 459 }, { anchorX: 225, baseline: 350 },
    { anchorX: 195, baseline: 455 }, { anchorX: 213, baseline: 444 },
  ] },
  agi: { cols: 4, rows: 2, sourceHeight: 460, height: 214, frames: [
    { anchorX: 176, baseline: 480 }, { anchorX: 181, baseline: 480 },
    { anchorX: 170, baseline: 480 }, { anchorX: 144, baseline: 470 },
    { anchorX: 170, baseline: 491 }, { anchorX: 220, baseline: 363 },
    { anchorX: 166, baseline: 450 }, { anchorX: 138, baseline: 466 },
  ] },
  agiLeft: { cols: 4, rows: 2, sourceHeight: 438, height: 214, frames: [
    { anchorX: 179, baseline: 488 }, { anchorX: 170, baseline: 489 },
    { anchorX: 166, baseline: 489 }, { anchorX: 223, baseline: 490 },
    { anchorX: 267, baseline: 480 }, { anchorX: 209, baseline: 374 },
    { anchorX: 134, baseline: 460 }, { anchorX: 211, baseline: 475 },
  ] },
  vladRun: { cols: 4, rows: 2, sourceHeight: 430, height: 214,
    frames: frames([238, 266, 243, 246, 240, 282, 223, 249], [438, 422.5]) },
  vladCombo: { cols: 4, rows: 3, sourceHeight: 338, height: 214,
    frames: frames([194, 195, 228, 210, 182, 198, 236, 204, 207, 164, 128, 194], [362, 353, 321.5]) },
  agiRun: { cols: 4, rows: 2, sourceHeight: 470, height: 214,
    frames: frames([198, 200, 153, 194, 217, 204, 174, 206], [489, 475]) },
  agiCombo: { cols: 4, rows: 3, sourceHeight: 342, height: 214,
    frames: frames([171, 177, 229, 217, 172, 193, 220, 209, 192, 222, 202, 214], [358, 353, 333]) },
  agiRunLeft: { cols: 4, rows: 2, sourceHeight: 470, height: 214,
    frames: frames([192, 206, 176, 160, 188, 208, 176, 186], [484, 480]) },
  agiComboLeft: { cols: 4, rows: 3, sourceHeight: 340, height: 214,
    frames: frames([191, 213, 239, 213, 176, 198, 225, 200, 171, 171, 203, 210], [352, 356, 352, 353, 348, 348, 350, 349, 326.5, 330.5, 333.5, 323.5]) },
  enforcerMotion: { cols: 4, rows: 3, sourceHeight: 345, height: 210,
    frames: frames([185, 185, 190, 190, 182, 195, 209, 193, 181, 188, 177, 205],
      [380, 380, 380, 380, 357, 357, 357, 360, 332, 333, 332, 334]) },
};
