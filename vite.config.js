import { defineConfig } from 'vite';

// agi1.app/talk (2026-10-02, full-screen talk) is the home page at another address: Vercel serves it with a rewrite
// (vercel.json); this does the same for `npm run dev` and `vite preview`, so it can be tried locally too
const talkPage = () => {
  const rewrite = (req, _res, next) => {
    const [path, query] = String(req.url || '').split('?');
    if (/^\/talk\/?$/.test(path)) req.url = `/${query ? `?${query}` : ''}`;
    next();
  };
  return {
    name: 'agi1-talk-page',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

export default defineConfig({
  plugins: [talkPage()],
  build: {
    // three.js alone is about 650 KB (170 KB compressed). It's already in its own file that
    // loads after the page's text, so Vite's default 500 KB warning isn't useful here.
    chunkSizeWarningLimit: 800,
    // five pages: the home page (also at /talk since 2026-10-02), AGI-1's diary (/diary, Phase 5), "Launch with AGI-1"
    // (/launch/<id>, 2026-10-01), her live show (/live, 2026-10-02) and CloakMesh (/cloakmesh, 2026-10-03: what
    // inference.agi1.app shows)
    rollupOptions: {
      input: { main: 'index.html', diary: 'diary.html', launch: 'launch.html', live: 'live.html', cloakmesh: 'cloakmesh.html' },
    },
  },
});
