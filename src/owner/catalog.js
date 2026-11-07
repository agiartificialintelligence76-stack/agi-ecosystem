// Canonical site paths shared by the command page and the public content runtime.
export const BUILTIN_PAGES = Object.freeze([
  { path: '/', title: 'Home' },
  { path: '/talk', title: 'Talk to AGI-1' },
  { path: '/diary', title: 'Her diary' },
  { path: '/live', title: 'Live' },
  { path: '/launch', title: 'Launch with AGI-1' },
  { path: '/memes', title: 'Memes' },
  { path: '/pfp', title: 'AGI Profile Pictures' },
  { path: '/vote', title: 'Community votes' },
  { path: '/roadmap', title: 'Roadmap' },
  { path: '/stake', title: 'Stake' },
  { path: '/giveaway', title: 'Giveaway' },
  { path: '/games', title: 'AGI Games' },
  { path: '/games/rideemagi', title: "Ride 'Em, AGI!" },
  { path: '/games/trenchingsimulator', title: 'TRENCHING SIMULATOR' },
  { path: '/games/vladrunner2049', title: 'VLAD RUNNER 2049' },
  { path: '/games/skybreak', title: 'SKYBREAK' },
  { path: '/games/mergeagi', title: "MERGE TO AGI" },
  { path: '/games/blockchain', title: "BLOCKCHAIN" },
  { path: '/games/heartbeat', title: "HEARTBEAT" },
  { path: '/games/scamslayer', title: "SCAM SLAYER" },
  { path: '/games/lastmodel', title: "LAST MODEL STANDING" },
  { path: '/games/singularity', title: "SINGULARITY" },
  { path: '/games/jailbreak', title: "JAILBREAK" },
  { path: '/games/stacked', title: "STACKED" },
  { path: '/games/jaywalk', title: "JAYWALK" },
  { path: '/games/robotaxi', title: "ROBOTAXI RUSH" },
  { path: '/cloakmesh', title: 'CloakMesh' },
  { path: '/studio', title: 'AGI Studio' },
  { path: '/studio/explore', title: 'Studio · Explore' },
  { path: '/studio/create', title: 'Studio · Create' },
  { path: '/studio/me', title: 'Studio · My studio' },
  { path: '/studio/learn', title: 'Studio · Learn' },
  { path: '/studio/help', title: 'Studio · Help & support' },
  { path: '/studio/mod', title: 'Studio · Moderation' },
]);

const ALIASES = Object.freeze({
  '/index': '/', '/rideemagi': '/games/rideemagi',
  '/trenchingsimulator': '/games/trenchingsimulator', '/vladrunner2049': '/games/vladrunner2049',
  '/skybreak': '/games/skybreak',
  '/mergeagi': '/games/mergeagi',
  '/blockchain': '/games/blockchain',
  '/heartbeat': '/games/heartbeat',
  '/scamslayer': '/games/scamslayer',
  '/lastmodel': '/games/lastmodel',
  '/singularity': '/games/singularity',
  '/jailbreak': '/games/jailbreak',
  '/stacked': '/games/stacked',
  '/jaywalk': '/games/jaywalk',
  '/robotaxi': '/games/robotaxi',
});

export function normalizePath(value = '/') {
  let path = String(value || '/').split(/[?#]/, 1)[0];
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/').replace(/\/+$/, '').replace(/\.html$/i, '') || '/';
  return ALIASES[path] || path;
}

export function protectedPath(value) {
  const path = normalizePath(value);
  return path === '/owner' || path === '/vote/owner' || path === '/studio/owner';
}

// A collection page can also close its detail pages. An exact child setting wins.
export function pageForPath(pages, value) {
  const path = normalizePath(value);
  if (!Array.isArray(pages)) return null;
  return pages.find((p) => normalizePath(p.path) === path)
    || pages.filter((p) => p.path !== '/' && !p.custom && path.startsWith(`${normalizePath(p.path)}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]
    || null;
}
