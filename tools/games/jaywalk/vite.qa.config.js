// JAYWALK's QA server (2026-11-08): the site's own Vite config with hot reload off, so a long screenshot session isn't
// reloaded when another file in the tree changes. npx vite --config tools/games/jaywalk/vite.qa.config.js --port 5193
import base from '../../../vite.config.js';

export default { ...base, server: { ...(base.server || {}), hmr: false } };
