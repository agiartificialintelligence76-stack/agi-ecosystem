export const CASES = [
  {
    name: 'The midnight dedication', caller: 'June, the booth engineer', subject: 'A love song played after the station closed.',
    statements: [
      ['The song came from the record deck.', 'i heard the needle drop too. that part tracks.'],
      ['I was already on the last train at midnight.', 'she says the train left at eleven forty.'],
      ['Someone left violets on the mixing desk.', 'three violets. whoever left them counted.'],
    ],
    exhibits: [
      ['Rail ticket', 'Stamped at East Gate at 00:18. It is the only entrance to June’s train.'],
      ['Sleeve notes', 'The dedication opens with a needle scratch. No digital copy exists.'],
      ['Florist stub', 'Three violets, collected at 21:05 by a customer in a raincoat.'],
    ], answer: [1,0], reveal: 'June stayed to play the song herself. The flowers were for the night engineer on the next shift.',
    reply: 'she made the last train with two minutes to spare. romantic and extremely stressful.',
  },
  {
    name:'The borrowed encore',caller:'Vera, a touring drummer',subject:'A mysterious encore appeared on her live tape.',
    statements:[['We recorded the show outdoors.','the wind keeps clipping the little overhead mic.'],['The crowd joined in at the end.','i can hear someone singing a whole octave too high. relatable.'],['I played my own snare on the encore.','she remembers a red maple drum and a brass rim.']],
    exhibits:[['Weather slip','A warm crosswind blew through the roofless courtyard that night.'],['Repair docket','Vera’s red maple snare stayed locked at the repair shop until the following morning.'],['Crowd tape','Two hundred voices sing the last four words of the refrain.']],
    answer:[2,1],reveal:'Vera borrowed the stagehand’s snare. Tonight she finally gives him his first radio credit.',reply:'put the stagehand on the sleeve. in big letters.',
  },
  {
    name:'The empty hotel',caller:'Lin, the night porter',subject:'Someone played the closed ballroom piano.',
    statements:[['The ballroom was locked all night.','he says his key never left the front desk.'],['The music stopped during the blackout.','the emergency lights came on right at the last chord.'],['The sheet music was a waltz.','three beats. even i can waltz to three beats.']],
    exhibits:[['Folded score','A waltz in three, with two names written together above the last bar.'],['Power log','The lights went dark for seven minutes, starting at 01:12.'],['Door reader','The porter’s only key opened the ballroom at 01:04 and closed it at 01:21.']],
    answer:[0,2],reveal:'Lin was practicing the wedding waltz for his sister. The ballroom has its first booking in years.',reply:'i hope he plays it slowly. give her time to cry a little.',
  },
  {
    name:'Letter from the sea',caller:'Sol, the lighthouse keeper',subject:'A postcard reached a station with no street address.',
    statements:[['The envelope had my old blue seal.','a lighthouse and one very round wave.'],['It came in on the morning ferry.','he says the captain handed him the mailbag.'],['My friend wrote the letter in pencil.','apparently ink runs out faster on an island.']],
    exhibits:[['Harbor notice','Every morning crossing was cancelled. The first ferry left the mainland at 18:00.'],['Postmark','A blue wax crest carries the lighthouse keeper’s little wave.'],['Carbon slip','The pencil rubbed off onto the paper beneath, leaving a faint second letter.']],
    answer:[1,0],reveal:'Sol took his dinghy across for the postcard. The station reads his friend’s reply on air.',reply:'he paddled twelve miles for one sentence. read it again.',
  },
  {
    name:'The second moon',caller:'Em, projectionist',subject:'Two moons appeared in the final reel of a hometown film.',
    statements:[['We used the old silver screen.','silver paint leaves a shimmer in the dark shots.'],['The audience asked us to run it twice.','two moons in one night. i’d stay for another showing.'],['Only one projector ran that night.','she says the spare had no working bulb.']],
    exhibits:[['Lobby book','Four rows of signatures beneath the words “one more time”.'],['Booth meter','Both lamp circuits drew full power throughout the final reel.'],['Screen patch','A corner of silver cloth, repaired the morning after the showing.']],
    answer:[2,1],reveal:'Em lit the spare projector so her little brother’s handmade moon could share the last shot.',reply:'leave the second moon in the print. the sky can make room.',
  },
  {
    name:'One missing violet',caller:'Bee, a botanical artist',subject:'A pressed flower disappeared from a framed portrait.',
    statements:[['The frame stayed sealed all week.','she says the paper tape never came loose.'],['The flower was pressed in winter.','the date is written in her very small handwriting.'],['The glass was replaced last year.','it has that wavy edge from the old glass shop.']],
    exhibits:[['Glass invoice','One sheet of restoration glass fitted exactly twelve months ago.'],['Field book','A winter violet, pressed between the December pages.'],['Studio photo','Tuesday morning. The backing is off and Bee’s violet rests beside the open frame.']],
    answer:[0,2],reveal:'Bee tucked the real flower in a letter. She painted a new violet so its empty place could stay on the wall.',reply:'a flower can be in two places after all. goodnight, bee.',
  },
];
