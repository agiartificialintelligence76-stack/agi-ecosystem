export const CABINS = [{
  note: 'do',
  shape: '●',
  tone: 1,
  color: '#ef736d'
}, {
  note: 'mi',
  shape: '◆',
  tone: 1.259921,
  color: '#f8c85d'
}, {
  note: 'sol',
  shape: '▲',
  tone: 1.498307,
  color: '#65d9c6'
}, {
  note: 'la',
  shape: '★',
  tone: 1.681793,
  color: '#b39beb'
}];
// Original four-voice scores. A digit is the responding cabin, not an index into a random-note generator.
export const STATIONS = [{
  name: 'Meadow Lift',
  root: 261.63,
  color: '#79c8b2',
  songs: [["Buttercup Bell", "0120 1030 2213 1200"], ["Little Blue Umbrella", "0120 3132 1003 2100"], ["Goat at the Gate", "0211 3201 0032 1210"]]
}, {
  name: 'Pine Lantern',
  root: 293.66,
  color: '#8ecb82',
  songs: [["Needles in Snow", "2101 2302 1331 2010"], ["Lark on the Cable", "1203 2120 3102 1000"], ["Lantern Waltz", "0031 1202 3110 2310"]]
}, {
  name: 'Clocktower',
  root: 246.94,
  color: '#e6ba6a',
  songs: [["Copper Steps", "1023 3102 0231 2010"], ["The Baker’s Rounds", "2121 0302 1133 2010"], ["Tin Roof Rain", "0323 1201 2321 3010"]]
}, {
  name: 'Twin Lakes',
  root: 311.13,
  color: '#65baca',
  songs: [["A Pair of Oars", "0123 2130 2301 1030"], ["Crossing Blue Water", "3202 1320 0332 2100"], ["Two Little Boats", "1132 0211 2320 1010"]]
}, {
  name: 'Cloud Needle',
  root: 277.18,
  color: '#aba4df',
  songs: [["The Updraft", "0213 1320 1132 2300"], ["Tassels on the Flag", "2130 0321 1232 3100"], ["Rook in the Cloud", "1032 1230 2021 3010"]]
}, {
  name: 'Snow Theater',
  root: 329.63,
  color: '#ddb2bf',
  songs: [["Velvet Balcony", "3122 0130 2203 1000"], ["Footlights in Ice", "1202 3130 0123 2100"], ["Red Curtain Waltz", "2010 3231 1302 3010"]]
}, {
  name: 'North Aurora',
  root: 293.66,
  color: '#8ac6c6',
  songs: [["A Ribbon of Light", "3201 2023 1130 2010"], ["The Quiet Compass", "1301 0223 2312 3000"], ["Four Windows Lit", "2013 0312 1022 3100"]]
}, {
  name: 'Roof of the World',
  root: 261.63,
  color: '#f4b884',
  songs: [["The Last Platform", "0132 2010 3213 2000"], ["A Seat for Tomorrow", "2230 1302 1231 0100"], ["A Mountain Answers", "1023 3211 2030 2100"]]
}];
export const REPERTOIRE = STATIONS.flatMap((station, index) => station.songs.map(([title, score], part) => ({
  id: index * 3 + part,
  station: index,
  part,
  title,
  tonic: station.root,
  notes: [...score.replaceAll(' ', '')].map(Number)
})));
export const bit = cabin => 1 << cabin;
export const voices = mask => [0, 1, 2, 3].filter(i => mask & bit(i));
export function phrase(piece, length, variation = 0, difficulty = piece.station) {
  const transpose = variation % 4,
    start = Math.floor(variation / 4) % 4 * 4;
  return Array.from({
    length
  }, (_, i) => {
    const n = (piece.notes[(start + i) % piece.notes.length] + transpose) % 4;
    const chord = difficulty >= 3 && (i + piece.part) % 5 === 3;
    return bit(n) | (chord ? bit((n + (difficulty >= 6 ? 1 : 2)) % 4) : 0);
  });
}
