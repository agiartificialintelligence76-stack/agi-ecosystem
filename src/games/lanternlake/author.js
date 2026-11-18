// A broadcast fact has one named subject and a finite set of possible values.
// Printed statements, pressed details and both sides of a physical exhibit are
// authored separately. The rules compare their facts without storing answer keys.
export function exhibit(title, front, back = '', kind = 'paper', sound = 'paper') {
  return { title, front, back, kind, sound };
}
export function context(claim, press, subject, value, item) {
  return { claim, press, subject, value, item };
}
export function round(speaker, claim, press, corrected, subject, claimed, observed, item, reasons) {
  return { speaker, claim, press, corrected, subject, claimed, observed, item, reasons };
}
export function episode(id, title, night, callers, opening, ending, letter, aside, rounds) {
  const evidence = [
    ...rounds.map((r, i) => ({ ...r.item, id: 'ex' + i, subject: r.subject, value: r.observed })),
    { ...aside.item, id: 'context', subject: aside.subject, value: aside.value },
  ];
  return { id, title, night, callers, opening, ending, letter, aside, rounds, evidence };
}
