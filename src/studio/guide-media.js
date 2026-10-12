// AGI Studio's guide videos (made by tools/studio/guide-record.mjs from the real app: don't edit; run it again after the app
// changes). Each step's video twice: a computer's (d) and a phone's (p), a soundless MP4 (H.264) and its WebP poster, in
// src/studio/guide/ (Vite gives each its own address, kept a year by browsers). The guide (src/studio/guide.js) shows the one
// for the screen it's on; Learn (src/studio/views/learn.js) plays a lesson's one after the other.
export const CLIPS = {
  'explore-start': {
    d: { mp4: new URL('./guide/explore-start-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-start-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.13 },
    p: { mp4: new URL('./guide/explore-start-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-start-p.webp', import.meta.url).href, w: 624, h: 390, s: 5.13 },
  },
  'explore-trends': {
    d: { mp4: new URL('./guide/explore-trends-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-trends-d.webp', import.meta.url).href, w: 672, h: 420, s: 13.08 },
    p: { mp4: new URL('./guide/explore-trends-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-trends-p.webp', import.meta.url).href, w: 624, h: 390, s: 8.13 },
  },
  'explore-wallet': {
    d: { mp4: new URL('./guide/explore-wallet-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-wallet-d.webp', import.meta.url).href, w: 672, h: 420, s: 11.17 },
    p: { mp4: new URL('./guide/explore-wallet-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-wallet-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.04 },
  },
  'explore-credits': {
    d: { mp4: new URL('./guide/explore-credits-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-credits-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.25 },
    p: { mp4: new URL('./guide/explore-credits-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-credits-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.04 },
  },
  'explore-nav': {
    d: { mp4: new URL('./guide/explore-nav-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-nav-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.58 },
    p: { mp4: new URL('./guide/explore-nav-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-nav-p.webp', import.meta.url).href, w: 624, h: 390, s: 5 },
  },
  'explore-again': {
    d: { mp4: new URL('./guide/explore-again-d.mp4', import.meta.url).href, poster: new URL('./guide/explore-again-d.webp', import.meta.url).href, w: 672, h: 420, s: 13.17 },
    p: { mp4: new URL('./guide/explore-again-p.mp4', import.meta.url).href, poster: new URL('./guide/explore-again-p.webp', import.meta.url).href, w: 624, h: 390, s: 9.88 },
  },
  'create-mode': {
    d: { mp4: new URL('./guide/create-mode-d.mp4', import.meta.url).href, poster: new URL('./guide/create-mode-d.webp', import.meta.url).href, w: 672, h: 420, s: 6.79 },
    p: { mp4: new URL('./guide/create-mode-p.mp4', import.meta.url).href, poster: new URL('./guide/create-mode-p.webp', import.meta.url).href, w: 624, h: 390, s: 4.54 },
  },
  'create-look': {
    d: { mp4: new URL('./guide/create-look-d.mp4', import.meta.url).href, poster: new URL('./guide/create-look-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.42 },
    p: { mp4: new URL('./guide/create-look-p.mp4', import.meta.url).href, poster: new URL('./guide/create-look-p.webp', import.meta.url).href, w: 624, h: 390, s: 8.25 },
  },
  'create-photo': {
    d: { mp4: new URL('./guide/create-photo-d.mp4', import.meta.url).href, poster: new URL('./guide/create-photo-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.42 },
    p: { mp4: new URL('./guide/create-photo-p.mp4', import.meta.url).href, poster: new URL('./guide/create-photo-p.webp', import.meta.url).href, w: 624, h: 390, s: 5.83 },
  },
  'create-way': {
    d: { mp4: new URL('./guide/create-way-d.mp4', import.meta.url).href, poster: new URL('./guide/create-way-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.83 },
    p: { mp4: new URL('./guide/create-way-p.mp4', import.meta.url).href, poster: new URL('./guide/create-way-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.17 },
  },
  'create-style': {
    d: { mp4: new URL('./guide/create-style-d.mp4', import.meta.url).href, poster: new URL('./guide/create-style-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.04 },
    p: { mp4: new URL('./guide/create-style-p.mp4', import.meta.url).href, poster: new URL('./guide/create-style-p.webp', import.meta.url).href, w: 624, h: 390, s: 8.92 },
  },
  'create-name': {
    d: { mp4: new URL('./guide/create-name-d.mp4', import.meta.url).href, poster: new URL('./guide/create-name-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.79 },
    p: { mp4: new URL('./guide/create-name-p.mp4', import.meta.url).href, poster: new URL('./guide/create-name-p.webp', import.meta.url).href, w: 624, h: 390, s: 5.79 },
  },
  'create-go': {
    d: { mp4: new URL('./guide/create-go-d.mp4', import.meta.url).href, poster: new URL('./guide/create-go-d.webp', import.meta.url).href, w: 672, h: 420, s: 9.33 },
    p: { mp4: new URL('./guide/create-go-p.mp4', import.meta.url).href, poster: new URL('./guide/create-go-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.17 },
  },
  'pick-look': {
    d: { mp4: new URL('./guide/pick-look-d.mp4', import.meta.url).href, poster: new URL('./guide/pick-look-d.webp', import.meta.url).href, w: 672, h: 420, s: 9.67 },
    p: { mp4: new URL('./guide/pick-look-p.mp4', import.meta.url).href, poster: new URL('./guide/pick-look-p.webp', import.meta.url).href, w: 624, h: 390, s: 8.71 },
  },
  'pick-reroll': {
    d: { mp4: new URL('./guide/pick-reroll-d.mp4', import.meta.url).href, poster: new URL('./guide/pick-reroll-d.webp', import.meta.url).href, w: 672, h: 420, s: 8.42 },
    p: { mp4: new URL('./guide/pick-reroll-p.mp4', import.meta.url).href, poster: new URL('./guide/pick-reroll-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.83 },
  },
  'make-tools': {
    d: { mp4: new URL('./guide/make-tools-d.mp4', import.meta.url).href, poster: new URL('./guide/make-tools-d.webp', import.meta.url).href, w: 672, h: 420, s: 9.13 },
    p: { mp4: new URL('./guide/make-tools-p.mp4', import.meta.url).href, poster: new URL('./guide/make-tools-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.58 },
  },
  'make-scene': {
    d: { mp4: new URL('./guide/make-scene-d.mp4', import.meta.url).href, poster: new URL('./guide/make-scene-d.webp', import.meta.url).href, w: 672, h: 420, s: 9.96 },
    p: { mp4: new URL('./guide/make-scene-p.mp4', import.meta.url).href, poster: new URL('./guide/make-scene-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.63 },
  },
  'make-models': {
    d: { mp4: new URL('./guide/make-models-d.mp4', import.meta.url).href, poster: new URL('./guide/make-models-d.webp', import.meta.url).href, w: 672, h: 420, s: 7.33 },
    p: { mp4: new URL('./guide/make-models-p.mp4', import.meta.url).href, poster: new URL('./guide/make-models-p.webp', import.meta.url).href, w: 624, h: 390, s: 6.29 },
  },
  'make-go': {
    d: { mp4: new URL('./guide/make-go-d.mp4', import.meta.url).href, poster: new URL('./guide/make-go-d.webp', import.meta.url).href, w: 672, h: 420, s: 8.54 },
    p: { mp4: new URL('./guide/make-go-p.mp4', import.meta.url).href, poster: new URL('./guide/make-go-p.webp', import.meta.url).href, w: 624, h: 390, s: 8.79 },
  },
  'make-instant': {
    d: { mp4: new URL('./guide/make-instant-d.mp4', import.meta.url).href, poster: new URL('./guide/make-instant-d.webp', import.meta.url).href, w: 672, h: 420, s: 11.13 },
    p: { mp4: new URL('./guide/make-instant-p.mp4', import.meta.url).href, poster: new URL('./guide/make-instant-p.webp', import.meta.url).href, w: 624, h: 390, s: 12.33 },
  },
  'make-pfp': {
    d: { mp4: new URL('./guide/make-pfp-d.mp4', import.meta.url).href, poster: new URL('./guide/make-pfp-d.webp', import.meta.url).href, w: 672, h: 420, s: 13.21 },
    p: { mp4: new URL('./guide/make-pfp-p.mp4', import.meta.url).href, poster: new URL('./guide/make-pfp-p.webp', import.meta.url).href, w: 624, h: 390, s: 10 },
  },
  'make-creations': {
    d: { mp4: new URL('./guide/make-creations-d.mp4', import.meta.url).href, poster: new URL('./guide/make-creations-d.webp', import.meta.url).href, w: 672, h: 420, s: 10.75 },
    p: { mp4: new URL('./guide/make-creations-p.mp4', import.meta.url).href, poster: new URL('./guide/make-creations-p.webp', import.meta.url).href, w: 624, h: 390, s: 9.29 },
  },
  'me-credits': {
    d: { mp4: new URL('./guide/me-credits-d.mp4', import.meta.url).href, poster: new URL('./guide/me-credits-d.webp', import.meta.url).href, w: 672, h: 420, s: 8.96 },
    p: { mp4: new URL('./guide/me-credits-p.mp4', import.meta.url).href, poster: new URL('./guide/me-credits-p.webp', import.meta.url).href, w: 624, h: 390, s: 6.83 },
  },
  'me-infs': {
    d: { mp4: new URL('./guide/me-infs-d.mp4', import.meta.url).href, poster: new URL('./guide/me-infs-d.webp', import.meta.url).href, w: 672, h: 420, s: 5.42 },
    p: { mp4: new URL('./guide/me-infs-p.mp4', import.meta.url).href, poster: new URL('./guide/me-infs-p.webp', import.meta.url).href, w: 624, h: 390, s: 4.63 },
  },
  'me-gifts': {
    d: { mp4: new URL('./guide/me-gifts-d.mp4', import.meta.url).href, poster: new URL('./guide/me-gifts-d.webp', import.meta.url).href, w: 672, h: 420, s: 10.92 },
    p: { mp4: new URL('./guide/me-gifts-p.mp4', import.meta.url).href, poster: new URL('./guide/me-gifts-p.webp', import.meta.url).href, w: 624, h: 390, s: 7.75 },
  },
  'me-help': {
    d: { mp4: new URL('./guide/me-help-d.mp4', import.meta.url).href, poster: new URL('./guide/me-help-d.webp', import.meta.url).href, w: 672, h: 420, s: 8 },
    p: { mp4: new URL('./guide/me-help-p.mp4', import.meta.url).href, poster: new URL('./guide/me-help-p.webp', import.meta.url).href, w: 624, h: 390, s: 6.71 },
  },
  'make-trend': {
    d: { mp4: new URL('./guide/make-trend-d.mp4', import.meta.url).href, poster: new URL('./guide/make-trend-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.33 },
    p: { mp4: new URL('./guide/make-trend-p.mp4', import.meta.url).href, poster: new URL('./guide/make-trend-p.webp', import.meta.url).href, w: 624, h: 390, s: 12.13 },
  },
  'make-video': {
    d: { mp4: new URL('./guide/make-video-d.mp4', import.meta.url).href, poster: new URL('./guide/make-video-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.58 },
    p: { mp4: new URL('./guide/make-video-p.mp4', import.meta.url).href, poster: new URL('./guide/make-video-p.webp', import.meta.url).href, w: 624, h: 390, s: 12.67 },
  },
  'make-editor': {
    d: { mp4: new URL('./guide/make-editor-d.mp4', import.meta.url).href, poster: new URL('./guide/make-editor-d.webp', import.meta.url).href, w: 672, h: 420, s: 12.88 },
    p: { mp4: new URL('./guide/make-editor-p.mp4', import.meta.url).href, poster: new URL('./guide/make-editor-p.webp', import.meta.url).href, w: 624, h: 390, s: 12.13 },
  },
  'make-cut': {
    d: { mp4: new URL('./guide/make-cut-d.mp4', import.meta.url).href, poster: new URL('./guide/make-cut-d.webp', import.meta.url).href, w: 672, h: 420, s: 14 },
    p: { mp4: new URL('./guide/make-cut-p.mp4', import.meta.url).href, poster: new URL('./guide/make-cut-p.webp', import.meta.url).href, w: 624, h: 390, s: 13.5 },
  },
};
