import { defineConfig } from 'vite';

// agi1.app/talk (2026-10-02, full-screen talk) is the home page at another address: Vercel serves it with a rewrite
// (vercel.json); this does the same for `npm run dev` and `vite preview`, so it can be tried locally too
// AGI Studio (2026-10-10): agi1.app/studio/<anything> is its one page (its views at their own addresses), and on its own
// host (studio.agi1.app; locally studio.localhost) every address that isn't a file is too (Vercel: files first, then the
// host's catch-all rewrite; here: an address with no file extension, outside /api and Vite's own)
// AGI games (2026-10-19): agi1.app/games/rideemagi is the game's own page (rideemagi.html), like Vercel's rewrite, and
// (2026-10-20) agi1.app/games/trenchingsimulator is TRENCHING SIMULATOR's (trenchingsimulator.html)
const STUDIO_HOST = /^studio\./i;
const STUDIO_VIEW = /^\/(?!api\/|@|src\/|node_modules\/)(?:[^.]*)$/;
const talkPage = () => {
  const rewrite = (req, _res, next) => {
    const [path, query] = String(req.url || '').split('?');
    const q = query ? `?${query}` : '';
    if (/^\/talk\/?$/.test(path)) req.url = `/${q}`;
    else if (/^\/games\/rideemagi\/?$/.test(path)) req.url = `/rideemagi.html${q}`;
    else if (/^\/games\/trenchingsimulator\/?$/.test(path)) req.url = `/trenchingsimulator.html${q}`;
    else if (/^\/games\/vladrunner2049\/?$/.test(path)) req.url = `/vladrunner2049.html${q}`;
    else if (/^\/vote\/owner\/?$/.test(path)) req.url = `/vote.html${q}`;   // (2026-10-24) the owner's votes page
    else if (/^\/discord\/verify\/?$/.test(path)) req.url = `/verify.html${q}`;   // (2026-10-29) her Discord holder roles' page
    else if (/^\/studio\/.+/.test(path)) req.url = `/studio.html${q}`;
    else if (STUDIO_HOST.test(String(req.headers.host || '')) && STUDIO_VIEW.test(path)) req.url = `/studio.html${q}`;
    else if (/^\/owner\/?$/.test(path)) req.url = `/owner-command.html${q}`;
    else if (/^\/p\/[a-z0-9][a-z0-9-]*\/?$/.test(path)) req.url = `/content.html${q}`;
    next();
  };
  return {
    name: 'agi1-talk-page',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

// One content runtime on every public HTML entry, including future pages. The owner's editor is isolated.
const ownerContent = () => ({
  name: 'agi-site-content',
  transformIndexHtml: {
    order: 'pre',
    handler(html, context) {
      if (context.filename?.replace(/\\/g, '/').endsWith('/owner-command.html')) return html;
      return [{ tag: 'script', attrs: { type: 'module', src: '/src/owner/runtime.js' }, injectTo: 'body' }];
    },
  },
});

export default defineConfig({
  plugins: [talkPage(), ownerContent()],
  // Preserve the splat decoder's relative worker URLs during local development.
  optimizeDeps: { exclude: ['@viggle/splat-engine'] },
  build: {
    // three.js alone is about 650 KB (170 KB compressed). It's already in its own file that
    // loads after the page's text, so Vite's default 500 KB warning isn't useful here.
    chunkSizeWarningLimit: 800,
    // (2026-10-22) the licenses of the packages bundled into the site's files, in dist/.vite/license.md: TradingView
    // Lightweight Charts™ (GNGM's chart, Apache-2.0) asks for its license to go with it, and the minified file drops its header
    license: true,
    // thirteen pages: the home page (also at /talk since 2026-10-02), AGI-1's diary (/diary, Phase 5), "Launch with AGI-1"
    // (/launch/<id>, 2026-10-01), her live show (/live, 2026-10-02), CloakMesh (/cloakmesh, 2026-10-03: what
    // inference.agi1.app shows), AGI Studio (/studio and /studio/<view>, and studio.agi1.app, 2026-10-10), (2026-10-14)
    // the roadmap (/roadmap) with its coming-soon pages (/stake, /games: AGI games since 2026-10-19, /giveaway), and
    // (2026-10-19) the owner's game, Ride 'Em, AGI! (/games/rideemagi), and (2026-10-20) TRENCHING SIMULATOR
    // (/games/trenchingsimulator), and VLAD RUNNER 2049 (/games/vladrunner2049), and (2026-10-23) the memes (/memes), and
    // (2026-10-24) the community votes (/vote), and (2026-10-29) AGI-1's Discord holder roles (/discord/verify)
    rollupOptions: {
      input: { main: 'index.html', diary: 'diary.html', launch: 'launch.html', live: 'live.html', cloakmesh: 'cloakmesh.html', studio: 'studio.html',
        roadmap: 'roadmap.html', stake: 'stake.html', games: 'games.html', giveaway: 'giveaway.html', rideemagi: 'rideemagi.html',
        trenchingsimulator: 'trenchingsimulator.html', vladrunner2049: 'vladrunner2049.html',
        memes: 'memes.html', vote: 'vote.html', owner: 'owner-command.html', content: 'content.html',
        // (2026-10-29) her Discord holder roles' page (agi1.app/discord/verify)
        verify: 'verify.html',
        // (2026-10-24) the 404 NOT_FOUND page: Vercel serves dist/404.html for any address with no page
        notfound: '404.html' },
    },
  },
});
