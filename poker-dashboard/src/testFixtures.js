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

// One 3-handed hand that exercises positions, 3-bet, c-bet, showdown funnel and
// head-to-head. Seats: Alice #1, Bob #2, Carol #3; Carol is the dealer, so
// Alice = SB, Bob = BB, Carol = BTN.
export const POSITIONS_HAND = makeRows([
  '-- starting hand #1 (id: p1)',
  'Player stacks: #1 "Alice @ a" (1000) | #2 "Bob @ b" (1000) | #3 "Carol @ c" (1000)',
  '"Carol @ c" is the dealer',
  '"Alice @ a" posts a small blind of 5',
  '"Bob @ b" posts a big blind of 10',
  '"Carol @ c" raises to 30',        // open (Carol = BTN aggressor so far)
  '"Alice @ a" calls 30',            // faces 1 raise → 3-bet opp, no 3-bet
  '"Bob @ b" raises to 90',          // faces 1 raise → 3-bet!
  '"Carol @ c" calls 90',
  '"Alice @ a" calls 90',
  'Flop:  [A♠, K♥, 2♦]',
  '"Alice @ a" checks',
  '"Bob @ b" bets 100',              // Bob is preflop aggressor → c-bet
  '"Carol @ c" folds',
  '"Alice @ a" calls 100',
  'Turn:  [A♠, K♥, 2♦, 7♣]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  'River:  [A♠, K♥, 2♦, 7♣, 3♥]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  '"Alice @ a" shows a A♣, A♦.',     // trip aces — wins
  '"Bob @ b" shows a K♠, K♦.',       // trip kings — loses
  '"Alice @ a" collected 380 from pot',
  '-- ending hand #1 --',
]);

// A 3-way showdown where Carol scoops and Alice + Bob both lose — exercises the
// multiway head-to-head fix (co-losers must each record a loss vs everyone).
export const MULTIWAY_SHOWDOWN = makeRows([
  '-- starting hand #1 (id: m1)',
  'Player stacks: #1 "Alice @ a" (1000) | #2 "Bob @ b" (1000) | #3 "Carol @ c" (1000)',
  '"Carol @ c" is the dealer',
  '"Alice @ a" posts a small blind of 5',
  '"Bob @ b" posts a big blind of 10',
  '"Carol @ c" calls 10',
  '"Alice @ a" calls 10',
  '"Bob @ b" checks',
  'Flop:  [A♠, K♥, 9♦]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  '"Carol @ c" checks',
  'Turn:  [A♠, K♥, 9♦, 2♣]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  '"Carol @ c" checks',
  'River:  [A♠, K♥, 9♦, 2♣, 3♥]',
  '"Alice @ a" checks',
  '"Bob @ b" checks',
  '"Carol @ c" checks',
  '"Alice @ a" shows a A♣, 7♦.',   // pair of aces
  '"Bob @ b" shows a K♠, Q♦.',     // pair of kings
  '"Carol @ c" shows a A♥, K♦.',   // two pair — wins
  '"Carol @ c" collected 30 from pot',
  '-- ending hand #1 --',
]);
