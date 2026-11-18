export const SHIFTS = [
  { title: 'Bedroom signal', host: 'pixelpotato', count: 6, bars: 5, teaches: 'Hit the bright one.', place: 'Bedroom FM', stamps: ['Pillow radio','Bedroom operator'], note: 'An open microphone and one neighbor listening.' },
  { title: 'Last bus', host: 'night_bus', count: 7, bars: 7, teaches: 'Match the energy dots.', place: 'Bus loop', stamps: ['Bus transfer','Night driver'], note: 'Passengers request a lift as their bus climbs the hill.' },
  { title: 'Rain on tape', host: 'umbrella_club', count: 7, bars: 8, teaches: 'Pick the rise or the ease.', place: 'Rain booth', stamps: ['Paper umbrella','Rain collector'], note: 'Listeners send curves drawn on fogged windows.' },
  { title: 'Pajama hotline', host: 'softsignal', count: 8, bars: 8, teaches: 'The lead-in makes room.', place: 'Pillow fort', stamps: ['Moon patch','Soft signal'], note: 'A study group needs breathing room between hooks.' },
  { title: 'Matinee booth', host: 'credits_roll', count: 8, bars: 9, teaches: 'Save the next chorus.', place: 'Cinema roof', stamps: ['Balcony ticket','Matinee editor'], note: 'The curtain opens on a different scene each phrase.' },
  { title: 'Glass elevator', host: 'floor_eleven', count: 8, bars: 10, teaches: 'Ride the hand fader.', place: 'Lift shaft', stamps: ['Floor button','Lift operator'], note: 'Carry the room smoothly between the quiet and bright floors.' },
  { title: 'Ferry windows', host: 'ferry_cat', count: 9, bars: 10, teaches: 'Read the second request early.', place: 'Ferry deck', stamps: ['Ferry stub','Deck officer'], note: 'Evening boats trade listening cards across the harbor.' },
  { title: 'Sunrise relay', host: 'dawn_patrol', count: 10, bars: 10, teaches: 'Keep the whole arc together.', place: 'Dawn relay', stamps: ['Sun seal','Sunrise signature'], note: 'Regulars return for the last set before morning.' },
];

export const MOODS = ['','hushed','soft','warm','bright','electric'];
export const CURVES = { rise: 'rise', ease: 'ease', level: 'hold steady' };
export const LISTENERS = [
  ['night_bus','the last bus just hit the hill.'],['ferry_cat','someone opened the deck door.'],
  ['tape_mouse','my headphones are bigger than my head.'],['softsignal','we saved a corner of the room for you.'],
  ['lampfriend','there’s one light left in our building.'],['credits_roll','the credits rolled and we’re still here.'],
  ['rainpen','drawing little waves on the glass.'],['mint_tea','steeping the last cup of the night.'],
  ['moon_moth','my porch light has an audience.'],['quiet_quinn','showing this station to a friend.'],
  ['pillowfort','two blankets, one excellent antenna.'],['turnstile','the platform’s empty. fill it with a chorus.'],
  ['lil_latency','we’re listening from the stairwell.'],['dawn_patrol','there’s a yellow line under the blinds.'],
  ['kernel_cat','the cat has selected our speaker.'],['pixelpotato','one earbud each, both of us here.'],
];

export const CAPTIONS = [
  'for a slow walk home','while the city wakes up','for the window seat','for one earbud each',
  'for the closing credits','under the awning','while the kettle sings','for the last ferry',
  'for the empty platform','for a rooftop breakfast','from the blanket fort','as the lights go out',
];
