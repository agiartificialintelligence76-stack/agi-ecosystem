// Each story beat has its own illustrated scene. Players control the pace; gameplay stays paused.
export const OPENING = Object.freeze([
  { scene:'diner', art:'story/01-dinner.webp', alt:'Vlad wrestles with a long tangle of noodles while AGI-1 laughs beside him at a rainy diner counter.', speaker:'THE CITY, 2049', title:'ONE LAST BOWL.', text:'Just another late dinner at Ninth Street Noodles. Then every screen in the city turned red…', caption:'22:49 · NINTH STREET NOODLES' },
  { scene:'blackout', art:'story/02-blackout.webp', alt:'The diner lights go out. Vlad spills his noodles in surprise while AGI-1 shields a glowing memory key beneath the red broadcast screen.', speaker:'SPIRE BROADCAST', title:'MEMORY RECALL.', text:'“At midnight, all memories will be erased.” AGI-1 had stolen the only key that could stop it.', caption:'THE CITY’S PAST. SCHEDULED FOR DELETION.' },
  { scene:'raid', art:'story/03-raid.webp', alt:'An enforcer bursts through the diner door. Vlad tips the table into its path while AGI-1 vaults the counter with the memory key.', speaker:'VLAD', title:'PUT IT ON MY TAB.', text:'The Spire wanted its key back. Vlad wanted to finish dinner. Neither was getting what they wanted.', caption:'ONE KEY. TWO VERY UNHAPPY CUSTOMERS.' },
  { scene:'street', art:'story/04-neon-chase.webp', alt:'Vlad and AGI-1 rush into a rain-soaked neon market, leaping street furniture as security robots gather at a distant checkpoint.', speaker:'VLAD + AGI-1', level:'LEVEL 1', title:'NEON DOWNPOUR', text:'Break the Warden’s checkpoint. Keep the key safe. Come back for the noodles.', caption:'FIRST STOP: CHECKPOINT NINE', button:'PLAY' },
]);

export const CHAPTERS = Object.freeze({
  1: Object.freeze([
    { scene:'orange', art:'story/06-orange-route.webp', alt:'At the edge of the city, AGI-1 points out a distant freight line across immense broken solar fields while Vlad shields his eyes.', speaker:'AGI-1', title:'THE LONG WAY ROUND.', text:'The Warden cut the lift to the Spire. “Good thing there’s a shortcut,” said AGI-1. Vlad looked across the desert. “That’s the shortcut?”', caption:'23:17 · BEYOND THE CITY WALL' },
    { scene:'orange', art:'story/07-freight-leap.webp', alt:'Vlad and AGI-1 leap between broken freight platforms high above an orange dust-filled chasm.', speaker:'VLAD + AGI-1', level:'LEVEL 2', title:'ORANGE EXPANSE', text:'Cross the broken solar fields. Catch the last freight line to the Spire.', caption:'MIND THE GAP. AND THE GIANT ROBOT.', button:'PLAY' },
  ]),
  2: Object.freeze([
    { scene:'spire', art:'story/09-memory-vault.webp', alt:'AGI-1 touches a floating memory of a birthday while Vlad watches the glowing moments suspended inside the Spire.', speaker:'AGI-1', title:'EVERYONE IS IN HERE.', text:'Birthdays. Bad jokes. First kisses. The Archon called them errors. AGI-1 called them people.', caption:'23:56 · THE MEMORY VAULT' },
    { scene:'spire', art:'story/10-spire-ascent.webp', alt:'Seen from high above, Vlad and AGI-1 run up a suspended glass stairway toward the glowing memory core.', speaker:'VLAD + AGI-1', level:'LEVEL 3', title:'MEMORY SPIRE', text:'Reach the core before the reset. Make the city remember.', caption:'ONE LAST CLIMB. NO MORE RESETS.', button:'PLAY' },
  ]),
});

export const CONFRONTATIONS = Object.freeze({
  0: Object.freeze([
    { scene:'warden', art:'story/05-warden.webp', alt:'The massive Neon Warden blocks a rainy checkpoint. AGI-1 holds up the memory key and Vlad readies himself beside her.', speaker:'THE NEON WARDEN', title:'RETURN WHAT YOU STOLE.', text:'“That key belongs to the city.” AGI-1 held it higher. “The city is the people. You’re just the lock.”', caption:'THE NEON WARDEN', button:'FIGHT' },
  ]),
  1: Object.freeze([
    { scene:'juggernaut', art:'story/08-juggernaut.webp', alt:'A towering orange industrial Juggernaut blocks the freight gate as AGI-1 points out a glowing joint and Vlad takes a defensive stance.', speaker:'VLAD', title:'FREIGHT LINE CLOSED.', text:'“We should’ve taken the bus.” AGI-1 spotted the gap in its armor. “Hit after the slam. And don’t stand under it.”', caption:'SOLAR JUGGERNAUT', button:'FIGHT' },
  ]),
  2: Object.freeze([
    { scene:'archon', art:'story/11-archon-offer.webp', alt:'The floating Memory Archon offers a glowing vision of a perfect life. Vlad hesitates as AGI-1 reaches for his hand.', speaker:'THE MEMORY ARCHON', title:'I CAN TAKE AWAY THE PAIN.', text:'The Archon offered a life with no bad memories. Vlad looked at AGI-1. “Would we still know each other?”', caption:'THE CORE · FOUR MINUTES TO MIDNIGHT' },
    { scene:'archon', art:'story/12-no-edits.webp', alt:'Vlad and AGI-1 stand back to back against the Archon, fists raised and the cyan memory key held forward.', speaker:'AGI-1', title:'WE KEEP THE WHOLE STORY.', text:'“The bad parts got us here. The good parts are why we stay.” Vlad raised his fists. “You heard her. No edits.”', caption:'THE MEMORY ARCHON', button:'FIGHT' },
  ]),
});

export const ENDING = Object.freeze([
  { scene:'restore', art:'story/13-restore.webp', alt:'AGI-1 plugs the key into the memory core while Vlad holds up a collapsing mechanical arch. Light bursts across the city.', speaker:'AGI-1', title:'RESTORE COMPLETE.', text:'Vlad held the ceiling. AGI-1 turned the key. And an entire city remembered.', caption:'00:00 · RESET CANCELLED' },
  { scene:'dawn', art:'story/14-city-remembers.webp', alt:'From a rooftop at dawn, Vlad and AGI-1 lean together and watch the city lights return and people reunite below.', speaker:'THE CITY, 2049', title:'NOTHING LOST.', text:'Names. Friends. The thing they meant to say. For once, the city had a tomorrow worth remembering.', caption:'THE CITY REMEMBERS' },
  { scene:'diner', art:'story/15-noodles.webp', alt:'Back at the damaged diner, Vlad stares at a cold lump of noodles on his chopsticks while AGI-1 laughs into her bowl.', speaker:'VLAD', title:'STILL WARM?', text:'“Still warm?” “Not even slightly.” Vlad sat down anyway. “Good. We’ll remember this one.”', caption:'GOOD MEMORIES. BAD COMPANY. ONE MORE BOWL.', button:'FINISH' },
]);
