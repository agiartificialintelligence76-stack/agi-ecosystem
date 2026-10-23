// Original comic scenes. Story is paced by the player; the run clock starts after the opening.
export const OPENING = Object.freeze([
  { scene:'diner', speaker:'THE CITY, 2049', title:'ONE LAST BOWL.', text:'Vlad wanted dinner. AGI-1 wanted somewhere the city’s cameras couldn’t see. For eleven whole seconds, they both got lucky.', focus:'both', caption:'22:49 · NINTH STREET NOODLES' },
  { scene:'blackout', speaker:'SPIRE BROADCAST', title:'MEMORY RECALL.', text:'“For your protection, all personal memories will be reset at midnight. Please remain calm.” Every light in the diner goes out. Every door locks.', focus:'none', caption:'A CITY THAT FORGETS NEVER ASKS QUESTIONS.' },
  { scene:'key', speaker:'AGI-1', title:'I KEPT THE ORIGINAL.', text:'“Their reset doesn’t fix anything. It erases everyone. This memory key can stop it — if we get it back to the Spire.”', focus:'agi', caption:'ONE COPY. AN ENTIRE CITY INSIDE.' },
  { scene:'raid', speaker:'VLAD', title:'PUT IT ON MY TAB.', text:'Enforcers crash through the front door. Vlad looks at his untouched noodles. “We’re coming back for those.” First stop: the Neon Warden’s checkpoint.', focus:'vlad', caption:'DINNER CAN WAIT. THE CITY CAN’T.' },
]);

export const CHAPTERS = Object.freeze({
  1: Object.freeze([
    { scene:'orange', speaker:'AGI-1', title:'THE LONG WAY ROUND.', text:'“The Warden cut the lift to the Spire. But the solar fields still power a freight line.” Beyond the city, broken collectors stretch across the orange dust.', focus:'agi', caption:'23:17 · ORANGE EXPANSE' },
    { scene:'orange', speaker:'VLAD', title:'MIND THE GAP.', text:'“So: across the machinery, through the security, and absolutely no touching the giant angry robot.” The Solar Juggernaut disagrees.', focus:'vlad', caption:'CROSS THE PLATFORMS. REACH THE FREIGHT GATE.' },
  ]),
  2: Object.freeze([
    { scene:'spire', speaker:'AGI-1', title:'EVERYONE IS IN HERE.', text:'Behind the Spire’s glass are millions of ordinary moments: birthdays, bad jokes, first kisses. The Archon calls them errors. AGI-1 calls them people.', focus:'agi', caption:'23:56 · MEMORY SPIRE' },
    { scene:'spire', speaker:'VLAD', title:'NO MORE RESETS.', text:'“Good memories. Bad memories. They’re still ours.” Restore the memory key to the core. Make the city remember.', focus:'both', caption:'REACH THE ARCHON. BRING EVERYONE HOME.' },
  ]),
});

export const CONFRONTATIONS = Object.freeze({
  0: Object.freeze([
    { scene:'raid', speaker:'THE NEON WARDEN', title:'RETURN WHAT YOU STOLE.', text:'“That key belongs to the city.” AGI-1 raises it into the rain. “The city is the people. You’re just the lock.”', focus:'agi', caption:'CHECKPOINT NINE · THE NEON WARDEN' },
    { scene:'raid', speaker:'VLAD', title:'THEN LET’S OPEN IT.', text:'The Warden’s armor lights up. Vlad steps beside AGI-1. “You watch the key. I’ll watch the very obvious red warning lights.”', focus:'both', caption:'DODGE THE CHARGE. BREAK THE LOCKDOWN.' },
  ]),
  1: Object.freeze([
    { scene:'orange', speaker:'SOLAR JUGGERNAUT', title:'FREIGHT LINE CLOSED.', text:'A machine the size of a delivery truck blocks the gate. “Unregistered memories may not leave the district.” Vlad sighs. “We should’ve taken the bus.”', focus:'vlad', caption:'SOLAR FREIGHT TERMINAL · LAST TRAIN TO THE SPIRE' },
    { scene:'orange', speaker:'AGI-1', title:'WE MAKE OUR OWN ROUTE.', text:'“Its armor draws power between slams. That’s our opening.” She passes Vlad a smile. “And don’t stand under it.” “Excellent advice. Love your work.”', focus:'both', caption:'WATCH THE SLAM. HIT DURING RECOVERY.' },
  ]),
  2: Object.freeze([
    { scene:'spire', speaker:'THE MEMORY ARCHON', title:'I CAN TAKE AWAY THE PAIN.', text:'The Archon offers them a perfect life with nothing difficult left to remember. For a moment, the tower is quiet. Vlad looks at AGI-1. “Would we still know each other?”', focus:'vlad', caption:'THE MEMORY CORE · FOUR MINUTES TO MIDNIGHT' },
    { scene:'spire', speaker:'AGI-1', title:'WE KEEP THE WHOLE STORY.', text:'“The bad parts are how we got here. The good parts are why we stay.” She grips the key. Vlad raises his fists. “You heard her. No edits.”', focus:'both', caption:'BREAK THE ARCHON’S CONTROL. RESTORE THE CITY.' },
  ]),
});

export const ENDING = Object.freeze([
  { scene:'spire', speaker:'AGI-1', title:'RESTORE COMPLETE.', text:'The key turns. Across the city, a million windows light up. People remember their names. Their friends. The one thing they meant to say before it was too late.', focus:'agi', caption:'00:00 · THE CITY REMEMBERS' },
  { scene:'diner', speaker:'VLAD', title:'STILL WARM?', text:'Back at the diner, two bowls wait on the counter. “Not even slightly,” says AGI-1. Vlad sits down anyway. “Good. We’ll remember this one.”', focus:'both', caption:'GOOD MEMORIES. BAD COMPANY. ONE MORE BOWL.' },
]);
