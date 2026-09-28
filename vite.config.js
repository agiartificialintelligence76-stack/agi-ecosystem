import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is about 650 KB (170 KB compressed). It's already in its own file that
    // loads after the page's text, so Vite's default 500 KB warning isn't useful here.
    chunkSizeWarningLimit: 800,
    // two pages: the launch page and AGI-1's diary (/diary, Phase 5)
    rollupOptions: {
      input: { main: 'index.html', diary: 'diary.html' },
    },
  },
});
