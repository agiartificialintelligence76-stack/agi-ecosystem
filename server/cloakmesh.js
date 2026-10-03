// CloakMesh's waitlist (inference.agi1.app, 2026-10-03): the owner's private-AI project gets a landing page and a free
// waitlist on this site (cloakmesh.html, src/cloakmesh/). This is the server's side of the waitlist: the database calls
// (supabase/cloakmesh.sql); what counts as an email address is shared with the page (src/cloakmesh/email.js).
// api/cloakmesh.js answers the page. No email is ever sent from here (that would need an email service: the owner's
// decision); the page shows each person their own leave link instead.
import { rpc } from './limits.js';

export { checkEmail } from '../src/cloakmesh/email.js';

// what someone would mostly like to do with CloakMesh (the form's three choices)
export const ROLES = ['use', 'build', 'node'];
// sign-ups a day (every try counts): one visitor (a daily code of their internet address), and the whole site
export const WAITLIST = { PERSON_DAILY: 5, SITE_DAILY: 2000 };
// a leave link's code (made by the database: 64 hex characters)
export const LEAVE_TOKEN = /^[0-9a-f]{64}$/;

// The waitlist needs the database, the human check and PASS_SECRET (the daily visitor code and the 2-hour pass)
export const cloakmeshReady = (cfg) => Boolean(cfg.supabaseUrl && cfg.supabaseKey && cfg.turnstileSecret && cfg.passSecret.length >= 32);

// The database (supabase/cloakmesh.sql). Each throws on a database error (err.code PGRST202: the file wasn't run).
export const cloakmeshDb = {
  ready: (cfg) => rpc(cfg, 'cloakmesh_ready', {}, 'waitlist'),
  join: (cfg, { email, role, who }) => rpc(cfg, 'cloakmesh_join', {
    p_email: email, p_role: role, p_who: who, p_person_daily: WAITLIST.PERSON_DAILY, p_site_daily: WAITLIST.SITE_DAILY,
  }, 'waitlist'),
  leave: (cfg, token) => rpc(cfg, 'cloakmesh_leave', { p_token: token }, 'waitlist'),
};
