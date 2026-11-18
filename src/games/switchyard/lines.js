export const voiceBank = {
  start: ['broth on platform one. that’s my kind of railway.', 'grab the little engine. i’ll guard the noodles.'],
  couple: ['heard that click? we’re together.', 'hold onto my buffer. dinner’s about to move.'],
  uncouple: ['stay right there, little scallion.', 'i’m leaving this one on the siding.'],
  reverse: ['watch my tail lights.', 'backing up with dignity. mostly.'],
  points: ['there goes the fork.', 'that tiny lever just changed dinner.'],
  occupied: ['there’s still a wheel on it.', 'clear the linkage and i can work the lever.'],
  served: ['first ingredient in. smell that?', 'i heard a little bell from the noodle window.'],
  wrong: ['the kitchen’s waiting for the other car.', 'lovely ingredient. slightly early.'],
  bridge: ['one quarter turn, very fancy.', 'roundhouse doing its little dance.'],
  short: ['my tail’s sticking out.', 'one wagon fits. two is ambitious.'],
  twin: ['two windows, two little tickets.', 'look for the letters on the bowls.'],
  buffer: ['that buffer saved our supper.', 'one click closer than i planned.'],
  undo: ['let me wind the wheels back.', 'i saved our spot by the stove.'],
  reset: ['same dinner, fresh approach.', 'back to the top of the ticket.'],
  par: ['every clank counted 💜', 'that was an express service.'],
  daily: ['today’s special came with extra switches.', 'fresh ticket. first train is ours.'],
  line: ['a whole line fed. sit with me?', 'i punched the last square on your pass.'],
  complete: ['one hot bowl, and one stamp for your pass.', 'i saved the nicest egg for you.'],
  hint: ['i drew our next move in chalk.', 'try the little arrow on my dispatch slip.'],
  replay: ['my favorite little yard. shall we go again?', 'we might save a shunt this time.'],
  select: ['pick a station on my pass.', 'there’s room for another station stamp.'],
  refuse: ['those stripes are just for our engine.', 'the wagon needs its own berth.']
};
export function dialogue() {
  const count = {};
  return which => {
    const bank = voiceBank[which] || voiceBank.start,
      i = count[which] ?? 0;
    count[which] = i + 1;
    return bank[i % bank.length];
  };
}
