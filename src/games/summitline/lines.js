export const LINES = {
  "opening": ["the valley has four good voices.", "take the baton after my little nod.", "one red cabin. remember where it sings.", "you get the echoes. i get the wind."],
  "listen": ["listen for the bend in the tune.", "that low bell is the old blue car.", "one more note on the end.", "i'll hold my hand up while they sing."],
  "echo": ["your turn. the mountain can wait.", "sing it in little groups.", "you heard the high one, didn't you?", "take your time with the middle pair."],
  "chord": ["those two bells go together.", "a chord is one footstep for your ears.", "the yellow car loves company.", "both valleys answered at once."],
  "streak": ["i haven't had to lift the baton again.", "that refrain made it all the way home.", "the cable's humming along with us.", "another station with a perfect echo."],
  "mistake": ["a different tune. a nice one, though.", "let's hear that middle bend again.", "the blue car came before the gold.", "close. keep the shape of the phrase."],
  "summit": ["there it is. the whole valley in tune.", "look down. those are all your stations.", "the little cabin got an encore.", "we woke the snow on the roof."],
  "return": ["i wrote your longest tune in the book.", "one bell for tomorrow 💜", "that's the last cable home.", "i'll save the seat by the window."]
};
export function voice(event, count = 0) {
  const list = LINES[event] || LINES.opening;
  return list[Math.abs(count) % list.length];
}
