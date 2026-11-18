import { episode as c, round as r, context as q, exhibit as e } from './author.js';
export default [
  c(
    1,
    'Loose Clapper',
    0,
    ['Mina, the coat checker', 'Jo, the night engineer'],
    'Mina heard four notes on her first night back at the station. The old ident reel is missing. The bell above the blue door would make a lovely explanation.',
    'Mina had turned around for a tiny song, not a visitor. Jo pockets the loose clapper. Nobody has to defend their hearing.',
    'Mina encloses the ribbon from her first coat ticket. “That fourth note got me through a very long Tuesday.”',
    q(
      'I had my hand on the blue door when the notes began.',
      'It was the first time that handle had taken my glove off. I picked the glove up before I went in.',
      'Mina at door',
      'present',
      e('Coat ticket', 'The door attendant signed Mina’s coat in at the blue entrance during the chime.')
    ),
    [
      r(
        0,
        'The brass bell on the blue door rang those four notes with its own clapper.',
        'I mean the little bell itself. Its own tongue hit the brass while I pushed the door.',
        'I heard notes as I opened it. The little bell never moved. They were coming through the doorway instead.',
        'doorbell clapper during chime',
        'installed',
        'removed',
        e(
          'Loose clapper',
          'The keeper sealed the blue bell’s only clapper in this pouch before Mina’s shift. The bell still hangs overhead without it.',
          '',
          'bell'
        ),
        [
          'The mute switch only describes the microphone. It cannot say whether the doorbell itself worked.',
          'A signed coat ticket puts Mina at the door. She could hear several sources from there.',
        ]
      ),
      r(
        1,
        'The booth mic carried our host singing all four notes live to the monitor while Mina opened the door.',
        'The desk monitor was fed only from the host’s live mic, I thought. That was what I meant by live.',
        'The mic was down. It was the ident playing through the desk monitor. I was listening at the wrong fader.',
        'host mic at chime',
        'live',
        'muted',
        e(
          'Fader strip',
          'The recorder printed the host mic position continuously. The strip reads MUTED through all four notes. The monitor feed stayed open.',
          '',
          'fader',
          'ident'
        ),
        [
          'The clapper excludes the physical doorbell. It cannot say whether a singer used the booth mic.',
          'The ticket dates Mina’s visit, without recording the position of any fader.',
        ]
      ),
    ]
  ),
  c(
    2,
    'Warm Window',
    0,
    ['Bea, the sign painter', 'Cal, the pane fitter'],
    'A chalk arrow led listeners to a warm side window after the rain. Bea remembers leaving the directions before the clouds came over.',
    'Cal never opened that pane. Bea chalked an arrow on the outside after the shower and passed a four-note request through the serving hatch.',
    'Cal sends a clean square of glass. In one corner Bea has drawn an arrow in exactly the right direction.',
    q(
      'The words faced somebody standing on the pavement.',
      'I copied them the way I saw them from under the awning. The writing read normally from the street.',
      'writing audience',
      'street',
      e(
        'Street sketch',
        'A pavement sketch and its caption preserve the lettering in the same orientation as the street photographer saw it.'
      )
    ),
    [
      r(
        0,
        'My new chalk line was already there when the shower marked this pane.',
        'It was this outside line. It was in place before those particular dried rain marks formed.',
        'I drew over the dried drops. I must have waited out the shower with the listeners.',
        'chalk order',
        'before rain marks',
        'after rain marks',
        e(
          'Chalk cross-section',
          'Close-up of the stop on the letter T.',
          'A lifted flake shows dried rain sediment against bare glass, with the new chalk over it. The sediment belongs to that shower.',
          'glass'
        ),
        [
          'A fixed sash cannot date a line on the outside of the glass.',
          'The street sketch gives the reading direction, independent of the rain.',
        ]
      ),
      r(
        1,
        'I opened this whole pane so Bea could hand me the request.',
        'I mean the upper sash carrying the arrow, not the small serving hatch below it.',
        'I took the request through the lower hatch. The upper pane stayed fixed. Her sleeve warmed the glass while we talked.',
        'upper sash at handoff',
        'opened',
        'fixed',
        e(
          'Sash seal',
          'The fitter’s dated paper strip bridges the upper sash and frame before and after the handoff. It is one continuous, untorn strip. The lower hatch has its own hinge.',
          '',
          'glass'
        ),
        [
          'The chalk layers date the drawing and leave both possible handoff openings available.',
          'The street-facing words can be read whether the upper sash moves or stays fixed.',
        ]
      ),
    ]
  ),
];
