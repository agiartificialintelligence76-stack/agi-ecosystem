import { episode as c, round as r, context as q, exhibit as e } from './author.js';
export default [
  c(
    3,
    'Lift Ticket',
    1,
    ['Niko, the night porter', 'Iris, the stair attendant'],
    'Niko arrived at the booth out of breath with a numbered music envelope. Its front says LIFT. His route up the building turns out to matter.',
    'One envelope rode a service lift later. Niko climbed four flights himself, humming a note on every landing.',
    'Iris has put a small treble clef beside step forty. She says it is exactly where everyone wants a rest.',
    q(
      'I entered the station building before midnight.',
      'The visitor printer gave me number 18 as I came in. I still have the stub.',
      'Niko entry',
      'before midnight',
      e(
        'Visitor stub',
        'Visitor 18 entered the station at 23:49. The machine at the outer door serves both stairs and lift.',
        '',
        'ticket'
      )
    ),
    [
      r(
        0,
        'I rode the passenger lift up between 23:50 and 23:54.',
        'The little passenger cage, not the envelope hoist. I thought I had not used the stairs at all.',
        'I signed at the front door and took the stairs. LIFT was a routing note for the envelope.',
        'passenger lift 23:50–54',
        'available',
        'closed',
        e(
          'Inspection seal',
          'The passenger cage was locked to its floor stop from 23:46 to 00:03. The maintenance strip records uninterrupted closure.',
          '',
          'clock'
        ),
        [
          'A stair receipt at 23:55 would still allow an earlier lift ride in a working cage.',
          'The visitor stub admits Niko to the building; both vertical routes begin inside it.',
        ]
      ),
      r(
        1,
        'Niko first received this envelope downstairs before he began climbing.',
        'I put it directly in his hands at the downstairs counter. I remember his numbered visitor ticket.',
        'I handed it to him at the fourth-floor stair gate after he climbed. I remembered the ticket and substituted my own counter.',
        'envelope 18 handoff location',
        'downstairs',
        'fourth stair gate',
        e(
          'Stair receipt',
          'Receipt E18 names Niko and Iris. Location is FOURTH-FLOOR STAIR GATE; time 23:55. Both signed for this envelope’s first handoff.',
          '',
          'ticket'
        ),
        [
          'A grounded lift helps explain the panting. It does not locate a particular envelope.',
          'The building stub records arrival at an outer door and says nothing about receiving an envelope.',
        ]
      ),
    ]
  ),
  c(
    4,
    'Paper Boat',
    1,
    ['Pip, the print-room runner', 'Ari, the bridge keeper'],
    'Two neighbors remember a little boat carrying lyrics down a rain channel. Pip has the folded newsletter as proof that it sailed on Monday.',
    'Ari floated a blank boat on Monday. Pip folded the printed one on Tuesday after the station asked for all the verses.',
    'Ari returns a much sturdier boat. Someone has penciled four notes along its keel.',
    q(
      'Both boats could float in the shallow rain channel.',
      'No river required. It was the narrow stone gutter beside the bridge.',
      'channel type',
      'shallow',
      e(
        'Channel drawing',
        'The bridge plan shows a level, water-filled gutter wide enough for either paper boat.',
        '',
        'boat'
      )
    ),
    [
      r(
        0,
        'This printed boat was already folded and afloat on Monday night.',
        'The hull in my hand is from the same printed run I say floated on Monday.',
        'Tuesday’s date is inside the crease. The boat I remember on Monday must have been another one.',
        'printed hull first possible date',
        'Monday or earlier',
        'Tuesday',
        e(
          'Printer’s colophon',
          'Unfold the stern until the run mark is visible.',
          'This numbered sheet was first printed at 07:10 Tuesday. It did not exist as a printed newsletter on Monday.',
          'boat'
        ),
        [
          'The bridge drawing records an earlier boat and cannot date the particular sheet in Pip’s hand.',
          'A suitable channel lets a boat float. It does not give paper an earlier printing date.',
        ]
      ),
      r(
        1,
        'The first boat I lifted out already had the four-note lyric printed on its keel.',
        'I mean Monday’s boat in my signed bridge sketch. Its entire keel was visible.',
        'The first keel was blank. I sang the lyric while drying it, then remembered my own voice as something I had read.',
        'Monday boat keel',
        'printed lyric',
        'blank',
        e(
          'Bridge contact print',
          'Ari’s signed Monday contact print shows the complete underside of the first recovered boat. Every panel of its white keel is blank.',
          '',
          'photo'
        ),
        [
          'Tuesday’s colophon dates a different physical boat. It cannot tell us what the first boat carried.',
          'The water channel looks the same under either hull.',
        ]
      ),
    ]
  ),
];
