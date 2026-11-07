// LAST MODEL STANDING: a dev server for screenshots that never reloads by itself (the shared one reloads whenever any
// file in the tree changes, and ten games are being built in it at once). The site's own config, without hot reload
// or file watching, so it keeps serving the files as they were when it started: restart it after an edit.
// Run: npx vite --config tools/games/lastmodel/vite.qa.mjs --port 5467 --strictPort --host 127.0.0.1
import base from '../../../vite.config.js';

export default { ...base, root: new URL('../../../', import.meta.url).pathname, server: { ...(base.server || {}), hmr: false, watch: null } };
