// AGI games (2026-10-19): the games on agi1.app/games, and the rules the page, the games and our server share.
// Each game has its own page (its `path`); agi1.app/games lists them with their stars and how many people played them.

export const GAMES = {
  rideemagi: { name: "Ride 'Em, AGI!", path: '/games/rideemagi' },
  // since 2026-10-20: the second game, a trading game played with play money (see CLAUDE.md, "TRENCHING SIMULATOR")
  trenchingsimulator: { name: 'TRENCHING SIMULATOR', path: '/games/trenchingsimulator' },
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
