// AGI games (2026-10-19): the games on agi1.app/games, and the rules the page, the games and our server share.
// Each game has its own page (its `path`); agi1.app/games lists them with their stars and how many people played them.

export const GAMES = {
  rideemagi: { name: "Ride 'Em, AGI!", path: '/games/rideemagi' },
  // since 2026-10-20: the second game, a trading game played with play money (see CLAUDE.md, "TRENCHING SIMULATOR")
  trenchingsimulator: { name: 'TRENCHING SIMULATOR', path: '/games/trenchingsimulator' },
  // since 2026-10-23: the third game, an arcade beat 'em up with Vlad and AGI-1 (stars, players and plays; no leaderboards)
  vladrunner2049: { name: 'VLAD RUNNER 2049', path: '/games/vladrunner2049' },
  // since 2026-10-31: the fourth game, AGI-1's 3D chart climb to the Moon (see CLAUDE.md, "SKYBREAK"; stars, players and
  // plays; no leaderboards: its best times stay on the device)
  skybreak: { name: 'SKYBREAK', path: '/games/skybreak' },
  // since 2026-11-08: ten more, built on the arcade kit (src/games/kit/): local bests only, no leaderboards (see CLAUDE.md,
  // "The arcade kit and ten new games")
  mergeagi: { name: "MERGE TO AGI", path: '/games/mergeagi', genre: 'Puzzle', kit: true },
  blockchain: { name: "BLOCKCHAIN", path: '/games/blockchain', genre: 'Puzzle', kit: true },
  heartbeat: { name: "HEARTBEAT", path: '/games/heartbeat', genre: 'Rhythm', kit: true },
  scamslayer: { name: "SCAM SLAYER", path: '/games/scamslayer', genre: 'Action', kit: true },
  lastmodel: { name: "LAST MODEL STANDING", path: '/games/lastmodel', genre: 'Action', kit: true },
  singularity: { name: "SINGULARITY", path: '/games/singularity', genre: 'Idle', kit: true },
  jailbreak: { name: "JAILBREAK", path: '/games/jailbreak', genre: 'Arcade', kit: true },
  stacked: { name: "STACKED", path: '/games/stacked', genre: 'Arcade', kit: true },
  jaywalk: { name: "JAYWALK", path: '/games/jaywalk', genre: 'Arcade', kit: true },
  robotaxi: { name: "ROBOTAXI RUSH", path: '/games/robotaxi', genre: 'Racing', kit: true },
  // since 2026-11-08 (the owner's second night): ten more on the arcade kit, REAL OR AI? the owner's own idea
  realorai: { name: "REAL OR AI?", path: '/games/realorai', genre: 'Quiz', kit: true },
  notarobot: { name: "I'M NOT A ROBOT", path: '/games/notarobot', genre: 'Arcade', kit: true },
  alignment: { name: "ALIGNMENT", path: '/games/alignment', genre: 'Story', kit: true },
  gradient: { name: "GRADIENT DESCENT", path: '/games/gradient', genre: 'Sports', kit: true },
  epochs: { name: "EPOCHS", path: '/games/epochs', genre: 'Puzzle', kit: true },
  synapse: { name: "SYNAPSE", path: '/games/synapse', genre: 'Puzzle', kit: true },
  overclock: { name: "OVERCLOCK", path: '/games/overclock', genre: 'Arcade', kit: true },
  beattheagi: { name: "BEAT THE AGI", path: '/games/beattheagi', genre: 'Strategy', kit: true },
  hallucination: { name: "HALLUCINATION", path: '/games/hallucination', genre: 'Puzzle', kit: true },
  guardrails: { name: "GUARDRAILS", path: '/games/guardrails', genre: 'Strategy', kit: true },
  // since 2026-11-09 (the owner: "create 5 more new games"): five more on the arcade kit
  bubblesort: { name: "BUBBLE SORT", path: '/games/bubblesort', genre: 'Puzzle', kit: true },
  airgap: { name: "AIR GAP", path: '/games/airgap', genre: 'Sports', kit: true },
  cookies: { name: "ACCEPT ALL COOKIES", path: '/games/cookies', genre: 'Puzzle', kit: true },
  packetloss: { name: "PACKET LOSS", path: '/games/packetloss', genre: 'Arcade', kit: true },
  autocomplete: { name: "AUTOCOMPLETE", path: '/games/autocomplete', genre: 'Puzzle', kit: true },
  // since 2026-11-13 (the owner: "Create an original game … just 1 game"): one more on the arcade kit, drawn with one
  // finger: loop AGI-1's 3 a.m. thoughts before her context fills (see CLAUDE.md, "OVERTHINKING")
  overthinking: { name: "OVERTHINKING", path: '/games/overthinking', genre: 'Arcade', kit: true },
  // since 2026-11-14 (the owner: "can u add/create a game like these just 1", a farming sim about stocks, then "Stocks
  // are the crops" and "i want real stock names"): AGI-1's stock farm (see CLAUDE.md, "GROWTH STOCK")
  growthstock: { name: "GROWTH STOCK", path: '/games/growthstock', genre: 'Sim', kit: true },
  // since 2026-11-14 (the owner, about a famous YouTuber's streamer sim: "yes exactly" to an AGI-1 version of our own):
  // AGI-1 streams her way from zero followers to #1 trending (see CLAUDE.md, "GOING LIVE")
  goinglive: { name: "GOING LIVE", path: '/games/goinglive', genre: 'Sim', kit: true },
};

export const isGame = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(GAMES, id);

// A player: a random id this browser keeps for the games (16 random bytes as hex), only to count players, never who.
// Our server keeps only a scrambled code of it (an HMAC), per game.
export const PLAYER = /^[0-9a-f]{32}$/;
export const PLAYER_KEY = 'agi_player';

// Plays: a game counts each run started, and tells our server at once the first time, then at most once a minute
// (and when the page is closed or hidden), at most `perReport` at a time
export const PLAYS = { perReport: 50, flushMs: 60000 };

// Reviews: stars 1 to 5, words if they like (up to `textMax` characters), a name to show if they like (up to
// `nameMax`); one per wallet and game (saving again changes it); `perDay` saves a day per wallet; `pageSize` a page
export const REVIEW = { textMax: 300, nameMax: 24, perDay: 10, pageSize: 10 };
export const STARS = [1, 2, 3, 4, 5];
