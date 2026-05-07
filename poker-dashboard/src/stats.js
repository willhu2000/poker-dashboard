import { extractName, normaliseCard, classifyHand } from './parser.js';
import { bestHand } from './handEval.js';

// ──────────────────────────────────────────────────────────────────────────────
// Hand-level state machine
// ──────────────────────────────────────────────────────────────────────────────

function emptyHand() {
  return {
    id: null,
    number: null,
    players: {},          // { displayName: { seat, stack } }
    preflopActions: {},   // { displayName: ['fold'|'call'|'raise'|'check'|'bet'] }
    street: 'preflop',
    shownCards: {},       // { displayName: [card1, card2] }
    winners: [],          // [{ name, amount }]
    board: [],            // up to 5 cards
    viewerCards: null,    // [card1, card2] for "Your hand is"
    pots: [],
    dealer: null,         // player name who is dealer
    sb: null,             // player name who is small blind
    bb: null,             // player name who is big blind
    actionLog: [],        // [{type:'action'|'street', street, player?, action?, amount?}, ...]
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main analyser
// ──────────────────────────────────────────────────────────────────────────────

export function analyseLog(rows) {
  const players = {};   // displayName → stats object
  let currentHand = null;
  let handCount = 0;

  function getPlayer(name) {
    if (!players[name]) {
      players[name] = {
        name,
        handsDealt: 0,
        // preflop
        vpipHands: 0,    // voluntarily put $ in preflop
        pfrHands: 0,     // preflop raise
        preflopFolds: 0,
        // aggression
        totalBetsRaises: 0,
        totalCalls: 0,
        totalChecks: 0,
        // showdown
        shownHands: [],          // [{c1,c2,won}] — kept for backwards compat
        handCategories: {},      // category → count
        // chip tracking
        netChips: 0,
        buyIns: 0,
        cashOut: 0,
        // street actions
        streetActions: { preflop: 0, flop: 0, turn: 0, river: 0 },
        // luck proxy: premium hands shown at showdown
        premiumHandsShown: 0,
        allHandsShown: 0,
        // wins
        handsWon: 0,
        potsWon: 0,
        // preflop range tracking (all observed hole cards)
        rangeHands: [],
        // full hand history (all dealt hands, showdown or not)
        handsHistory: [],
        // detected bad beats (hands where this player lost with a strong hand)
        badBeats: [],
        // suck-outs (hands where this player won against a strong hand)
        suckOuts: [],
      };
    }
    return players[name];
  }

  function commitHand(hand) {
    if (!hand || !hand.id) return;
    handCount++;

    const dealtNames = Object.keys(hand.players);
    const potSize = hand.winners.reduce((s, w) => s + w.amount, 0);
    const winnerSet = new Set(hand.winners.map(w => w.name));
    const viewerName = findViewerName(hand);

    // ── VPIP / PFR / fold tracking ────────────────────────────────────────────
    for (const name of dealtNames) {
      const p = getPlayer(name);
      p.handsDealt++;

      const actions = hand.preflopActions[name] || [];
      const firstVoluntary = actions.find(a => ['call', 'raise', 'bet'].includes(a));

      if (firstVoluntary) p.vpipHands++;
      if (actions.includes('raise') || actions.includes('bet')) p.pfrHands++;
      if (actions.includes('fold')) p.preflopFolds++;

      for (const a of actions) {
        if (a === 'raise' || a === 'bet') p.totalBetsRaises++;
        else if (a === 'call') p.totalCalls++;
        else if (a === 'check') p.totalChecks++;
      }
    }

    // ── Showdown cards ────────────────────────────────────────────────────────
    for (const [name, cards] of Object.entries(hand.shownCards)) {
      const p = getPlayer(name);
      const won = winnerSet.has(name);
      const [c1, c2] = cards;
      if (c1 && c2) {
        const cat = classifyHand(c1, c2);
        p.shownHands.push({ c1, c2, won, hand: hand.number });
        p.handCategories[cat] = (p.handCategories[cat] || 0) + 1;
        p.allHandsShown++;
        p.rangeHands.push({ c1, c2 });
        if (cat.startsWith('Premium') || cat.startsWith('Strong Pair') || cat === 'Strong Ace (AQs/AJs)') {
          p.premiumHandsShown++;
        }
      }
    }

    // ── Winners ───────────────────────────────────────────────────────────────
    for (const w of hand.winners) {
      getPlayer(w.name).handsWon++;
    }

    // ── Viewer cards (Will's hand — shown every hand) ─────────────────────────
    if (hand.viewerCards && viewerName) {
      const [c1, c2] = hand.viewerCards;
      if (c1 && c2) {
        const p = getPlayer(viewerName);
        const cat = classifyHand(c1, c2);
        if (!hand.shownCards[viewerName]) {
          p.allHandsShown++;
          p.handCategories[cat] = (p.handCategories[cat] || 0) + 1;
          p.rangeHands.push({ c1, c2 });
          if (cat.startsWith('Premium') || cat.startsWith('Strong Pair')) {
            p.premiumHandsShown++;
          }
        }
      }
    }

    // ── Bad beat detection ────────────────────────────────────────────────────
    // Requires both players to show cards and a board of ≥3 cards.
    const shownNames = Object.keys(hand.shownCards);
    if (shownNames.length >= 2 && hand.board.length >= 3) {
      for (const loserName of shownNames) {
        if (winnerSet.has(loserName)) continue;
        const lc = hand.shownCards[loserName];
        if (!lc || !lc[0] || !lc[1]) continue;

        const loserEval = bestHand(lc, hand.board);
        if (!loserEval || loserEval.rank < 2) continue; // Two Pair minimum

        for (const winnerName of winnerSet) {
          const wc = hand.shownCards[winnerName];
          if (!wc || !wc[0] || !wc[1]) continue;

          const winnerEval = bestHand(wc, hand.board);
          if (!winnerEval) continue;

          const entry = {
            num: hand.number,
            board: hand.board.slice(),
            potSize,
            actionLog: hand.actionLog.slice(),
          };

          // Record on the loser as a bad beat
          getPlayer(loserName).badBeats.push({
            ...entry,
            c1: lc[0], c2: lc[1],
            myHandName: loserEval.name,
            myHandRank: loserEval.rank,
            oppName: winnerName,
            oppC1: wc[0], oppC2: wc[1],
            oppHandName: winnerEval.name,
          });

          // Record on the winner as a suck-out
          getPlayer(winnerName).suckOuts.push({
            ...entry,
            c1: wc[0], c2: wc[1],
            myHandName: winnerEval.name,
            myHandRank: winnerEval.rank,
            oppName: loserName,
            oppC1: lc[0], oppC2: lc[1],
            oppHandName: loserEval.name,
            oppHandRank: loserEval.rank, // severity = what we beat
          });
        }
      }
    }

    // ── Hand history (all dealt hands, for the expandable table) ──────────────
    for (const name of dealtNames) {
      const p = getPlayer(name);
      const shownCards = hand.shownCards[name];

      let c1 = null, c2 = null;
      if (shownCards && shownCards[0] && shownCards[1]) {
        [c1, c2] = shownCards;
      } else if (name === viewerName && hand.viewerCards?.[0] && hand.viewerCards?.[1]) {
        [c1, c2] = hand.viewerCards;
      }

      const won = winnerSet.has(name);
      const wasShown = !!(shownCards && shownCards[0] && shownCards[1]);
      const wonAmount = won ? (hand.winners.find(w => w.name === name)?.amount ?? null) : null;
      const isBadBeat = p.badBeats.some(bb => bb.num === hand.number);
      const isSuckOut = p.suckOuts.some(so => so.num === hand.number);

      const opponents = Object.entries(hand.shownCards)
        .filter(([n]) => n !== name)
        .map(([n, cards]) => ({ name: n, c1: cards[0] ?? null, c2: cards[1] ?? null }));

      // Evaluate final hand names for showdown hands
      let myHandName = null;
      let winnerHandName = null;
      if (wasShown && c1 && c2 && hand.board.length >= 3) {
        const myEval = bestHand([c1, c2], hand.board);
        if (myEval) myHandName = myEval.name;
        if (!won) {
          for (const winnerName of winnerSet) {
            const wc = hand.shownCards[winnerName];
            if (wc && wc[0] && wc[1]) {
              const winnerEval = bestHand(wc, hand.board);
              if (winnerEval) { winnerHandName = winnerEval.name; break; }
            }
          }
        }
      }

      p.handsHistory.push({
        num: hand.number,
        c1, c2,
        won,
        wasShown,
        wonAmount,
        potSize,
        board: hand.board.slice(),
        opponents,
        isBadBeat,
        isSuckOut,
        myHandName,
        winnerHandName,
        dealer: hand.dealer,
        sb: hand.sb,
        bb: hand.bb,
        actionLog: hand.actionLog,
      });
    }
  }

  function findViewerName(hand) {
    return Object.keys(hand.players).find(n => n.toLowerCase().startsWith('will'));
  }

  // ── Process rows ──────────────────────────────────────────────────────────

  for (const row of rows) {
    const e = row.entry;

    // ── Hand start ──────────────────────────────────────────────────────────
    const handStart = e.match(/^-- starting hand #(\d+) \(id: ([^)]+)\)/);
    if (handStart) {
      if (currentHand) commitHand(currentHand);
      currentHand = emptyHand();
      currentHand.number = parseInt(handStart[1], 10);
      currentHand.id = handStart[2];
      continue;
    }

    // ── Hand end ────────────────────────────────────────────────────────────
    if (e.match(/^-- ending hand #\d+ --/)) {
      if (currentHand) commitHand(currentHand);
      currentHand = null;
      continue;
    }

    // ── Buy-ins / cash-outs (can happen between hands, so check before guard) ──
    const joinMatch = e.match(/^The player "(.+?)" joined the game with a stack of (\d+)/);
    if (joinMatch) {
      getPlayer(extractName(joinMatch[1])).buyIns += parseInt(joinMatch[2], 10);
      continue;
    }

    const quitMatch = e.match(/^The player "(.+?)" quits the game with a stack of (\d+)/);
    if (quitMatch) {
      getPlayer(extractName(quitMatch[1])).cashOut += parseInt(quitMatch[2], 10);
      continue;
    }

    // ── Dealer detection (before guard, per-hand metadata) ──────────────────
    const dealerMatch = e.match(/^"(.+?)" is the dealer$/);
    if (dealerMatch && currentHand) {
      currentHand.dealer = extractName(dealerMatch[1]);
      continue;
    }

    if (!currentHand) continue;

    // ── Player stacks ───────────────────────────────────────────────────────
    const stacksMatch = e.match(/^Player stacks: (.+)$/);
    if (stacksMatch) {
      const parts = stacksMatch[1].split(' | ');
      for (const part of parts) {
        const m = part.match(/^#\d+ "(.+)" \((\d+)\)$/);
        if (m) {
          const name = extractName(m[1]);
          currentHand.players[name] = { stack: parseInt(m[2], 10) };
        }
      }
      continue;
    }

    // ── Your hand is ────────────────────────────────────────────────────────
    const yourHand = e.match(/^Your hand is (.+)$/);
    if (yourHand) {
      const parts = yourHand[1].split(',').map(s => s.trim());
      currentHand.viewerCards = parts.map(normaliseCard);
      continue;
    }

    // ── Street changes + board card parsing ──────────────────────────────────
    const streetMatch = e.match(/^(Flop|Turn|River):/);
    if (streetMatch) {
      currentHand.street = streetMatch[1].toLowerCase();
      // Parse cards from bracket notation [A♠, K♥, ...] or bare list
      const bracket = e.match(/\[([^\]]+)\]/);
      const cardSrc = bracket
        ? bracket[1]
        : e.split(':').slice(1).join(':').split('(')[0];
      const cards = cardSrc.split(',')
        .map(s => normaliseCard(s.trim()))
        .filter(c => c && c.rank);
      // PokerNow has two formats:
      //   Cumulative: Turn shows all 4 cards → replace board
      //   Incremental: Turn shows only the 1 new card → append
      if (cards.length === 1 && currentHand.board.length >= 3) {
        currentHand.board.push(cards[0]);
      } else if (cards.length > 0) {
        currentHand.board = cards;
      }
      currentHand.actionLog.push({ type: 'street', street: currentHand.street, board: currentHand.board.slice() });
      continue;
    }

    // ── Player actions ───────────────────────────────────────────────────────
    const foldMatch = e.match(/^"(.+?)" folds$/);
    if (foldMatch) {
      const name = extractName(foldMatch[1]);
      if (currentHand.street === 'preflop') {
        currentHand.preflopActions[name] = currentHand.preflopActions[name] || [];
        currentHand.preflopActions[name].push('fold');
      }
      getPlayer(name).streetActions[currentHand.street]++;
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'fold' });
      continue;
    }

    const callMatch = e.match(/^"(.+?)" calls (\d+)/);
    if (callMatch) {
      const name = extractName(callMatch[1]);
      const amount = parseInt(callMatch[2], 10);
      if (currentHand.street === 'preflop') {
        currentHand.preflopActions[name] = currentHand.preflopActions[name] || [];
        currentHand.preflopActions[name].push('call');
      }
      const p = getPlayer(name);
      p.streetActions[currentHand.street]++;
      if (currentHand.street !== 'preflop') p.totalCalls++;
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'call', amount });
      continue;
    }

    const raiseMatch = e.match(/^"(.+?)" raises to (\d+)/);
    if (raiseMatch) {
      const name = extractName(raiseMatch[1]);
      const amount = parseInt(raiseMatch[2], 10);
      if (currentHand.street === 'preflop') {
        currentHand.preflopActions[name] = currentHand.preflopActions[name] || [];
        currentHand.preflopActions[name].push('raise');
      }
      const p = getPlayer(name);
      p.streetActions[currentHand.street]++;
      if (currentHand.street !== 'preflop') p.totalBetsRaises++;
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'raise', amount });
      continue;
    }

    const betMatch = e.match(/^"(.+?)" bets (\d+)/);
    if (betMatch) {
      const name = extractName(betMatch[1]);
      const amount = parseInt(betMatch[2], 10);
      if (currentHand.street === 'preflop') {
        currentHand.preflopActions[name] = currentHand.preflopActions[name] || [];
        currentHand.preflopActions[name].push('bet');
      }
      const p = getPlayer(name);
      p.streetActions[currentHand.street]++;
      if (currentHand.street !== 'preflop') p.totalBetsRaises++;
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'bet', amount });
      continue;
    }

    const checkMatch = e.match(/^"(.+?)" checks$/);
    if (checkMatch) {
      const name = extractName(checkMatch[1]);
      const p = getPlayer(name);
      p.streetActions[currentHand.street]++;
      if (currentHand.street !== 'preflop') p.totalChecks++;
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'check' });
      continue;
    }

    // ── Blinds (not voluntary) ───────────────────────────────────────────────
    const blindMatch = e.match(/^"(.+?)" posts a (small|big) blind of (\d+)/);
    if (blindMatch) {
      const name = extractName(blindMatch[1]);
      const isSmall = blindMatch[2] === 'small';
      const amount = parseInt(blindMatch[3], 10);
      currentHand.preflopActions[name] = currentHand.preflopActions[name] || [];
      currentHand.preflopActions[name].push('blind');
      if (isSmall) currentHand.sb = name; else currentHand.bb = name;
      currentHand.actionLog.push({ type: 'action', street: 'preflop', player: name, action: isSmall ? 'post-sb' : 'post-bb', amount });
      continue;
    }

    // ── Shows a hand ────────────────────────────────────────────────────────
    const showMatch = e.match(/^"(.+?)" shows a (.+)\.$/);
    if (showMatch) {
      const name = extractName(showMatch[1]);
      const parts = showMatch[2].split(',').map(s => s.trim());
      if (parts.length === 2) {
        currentHand.shownCards[name] = parts.map(normaliseCard);
      } else if (parts.length === 1) {
        if (!currentHand.shownCards[name]) currentHand.shownCards[name] = [];
        currentHand.shownCards[name].push(normaliseCard(parts[0]));
      }
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'show' });
      continue;
    }

    // ── Collected (winner) ──────────────────────────────────────────────────
    const collectedMatch = e.match(/^"(.+?)" collected (\d+) from pot/);
    if (collectedMatch) {
      const name = extractName(collectedMatch[1]);
      const amount = parseInt(collectedMatch[2], 10);
      currentHand.winners.push({ name, amount });
      currentHand.actionLog.push({ type: 'action', street: currentHand.street, player: name, action: 'collect', amount });
      continue;
    }
  }

  // Commit any open hand
  if (currentHand) commitHand(currentHand);

  // ── Compute derived metrics ───────────────────────────────────────────────
  for (const p of Object.values(players)) {
    const h = p.handsDealt || 1;
    p.vpip = +(p.vpipHands / h * 100).toFixed(1);
    p.pfr = +(p.pfrHands / h * 100).toFixed(1);
    p.preflopFoldPct = +(p.preflopFolds / h * 100).toFixed(1);
    p.winRate = +(p.handsWon / h * 100).toFixed(1);

    p.af = p.totalCalls > 0
      ? +((p.totalBetsRaises) / p.totalCalls).toFixed(2)
      : p.totalBetsRaises > 0 ? 99 : 0;

    p.netChips = p.cashOut - p.buyIns;

    p.luckiness = p.allHandsShown > 0
      ? +(p.premiumHandsShown / p.allHandsShown * 100).toFixed(1)
      : 0;

    p.tightness = Math.max(0, Math.min(100, Math.round(100 - p.vpip)));
  }

  return { players, handCount };
}
