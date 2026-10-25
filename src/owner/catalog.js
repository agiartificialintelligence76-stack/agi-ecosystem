// Canonical site paths shared by the command page and the public content runtime.
export const BUILTIN_PAGES = Object.freeze([
  { path: '/', title: 'Home' },
  { path: '/talk', title: 'Talk to AGI-1' },
  { path: '/diary', title: 'Her diary' },
  { path: '/live', title: 'Live' },
  { path: '/launch', title: 'Launch with AGI-1' },
  { path: '/memes', title: 'Memes' },
  { path: '/vote', title: 'Community votes' },
  { path: '/roadmap', title: 'Roadmap' },
  { path: '/stake', title: 'Stake' },
  { path: '/giveaway', title: 'Giveaway' },
  { path: '/games', title: 'AGI Games' },
  { path: '/games/rideemagi', title: "Ride 'Em, AGI!" },
  { path: '/games/trenchingsimulator', title: 'TRENCHING SIMULATOR' },
  { path: '/games/vladrunner2049', title: 'VLAD RUNNER 2049' },
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
