// Shared synthetic-log builders for tests. Rows mimic parsed PokerNow output
// ({ entry, order, at }) in chronological order so analyseLog can run on them.
export function makeRows(entries) {
  return entries.map((entry, i) => ({
    entry,
    order: i + 1,
    at: '2026-02-11T20:00:00.000Z',
  }));
}

// Hand #1: Alice and Bob split a 20 pot. Hand #2: Alice wins 50 solo.
export const SPLIT_AND_SOLO = makeRows([
  '-- starting hand #1 (id: h1)',
  'Player stacks: #1 "Alice @ a" (1000) | #2 "Bob @ b" (1000)',
  '"Alice @ a" posts a small blind of 5',
  '"Bob @ b" posts a big blind of 10',
  '"Alice @ a" calls 10',
  '"Bob @ b" checks',
  'Flop:  [A♠, K♥, 2♦]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  'Turn:  [A♠, K♥, 2♦, 7♣]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  'River:  [A♠, K♥, 2♦, 7♣, 3♥]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  '"Alice @ a" shows a A♣, A♦.',
  '"Bob @ b" shows a A♥, A♠.',
  '"Alice @ a" collected 10 from pot',
  '"Bob @ b" collected 10 from pot',
  '-- ending hand #1 --',
  '-- starting hand #2 (id: h2)',
  'Player stacks: #1 "Alice @ a" (1000) | #2 "Bob @ b" (1000)',
  '"Alice @ a" posts a small blind of 5',
  '"Bob @ b" posts a big blind of 10',
  '"Alice @ a" raises to 30',
  '"Bob @ b" folds',
  '"Alice @ a" collected 50 from pot',
  '-- ending hand #2 --',
]);
