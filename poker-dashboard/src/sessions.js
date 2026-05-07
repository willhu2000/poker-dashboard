const KEY = 'poker-sessions';

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function saveSession(fileName, stats) {
  const sessions = loadSessions();
  const id = genId();
  sessions.unshift({
    id,
    fileName,
    uploadedAt: new Date().toISOString(),
    handCount: stats.handCount,
    playerNames: Object.keys(stats.players),
    stats,
  });
  localStorage.setItem(KEY, JSON.stringify(sessions));
  return id;
}

export function deleteSession(id) {
  const updated = loadSessions().filter(s => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function mergeSessions(sessions) {
  if (!sessions.length) return null;
  if (sessions.length === 1) return sessions[0].stats;

  const players = {};
  let handCount = 0;

  for (const session of sessions) {
    handCount += session.handCount;
    for (const [name, sp] of Object.entries(session.stats.players)) {
      if (!players[name]) {
        players[name] = {
          name,
          handsDealt: 0, vpipHands: 0, pfrHands: 0, preflopFolds: 0,
          totalBetsRaises: 0, totalCalls: 0, totalChecks: 0,
          shownHands: [], handCategories: {},
          netChips: 0, buyIns: 0, cashOut: 0,
          streetActions: { preflop: 0, flop: 0, turn: 0, river: 0 },
          premiumHandsShown: 0, allHandsShown: 0,
          handsWon: 0, potsWon: 0,
          rangeHands: [],
          handsHistory: [],
          badBeats: [],
          suckOuts: [],
        };
      }
      const p = players[name];
      p.handsDealt      += sp.handsDealt || 0;
      p.vpipHands       += sp.vpipHands || 0;
      p.pfrHands        += sp.pfrHands || 0;
      p.preflopFolds    += sp.preflopFolds || 0;
      p.totalBetsRaises += sp.totalBetsRaises || 0;
      p.totalCalls      += sp.totalCalls || 0;
      p.totalChecks     += sp.totalChecks || 0;
      p.allHandsShown   += sp.allHandsShown || 0;
      p.premiumHandsShown += sp.premiumHandsShown || 0;
      p.handsWon        += sp.handsWon || 0;
      p.buyIns          += sp.buyIns || 0;
      p.cashOut         += sp.cashOut || 0;
      p.shownHands    = p.shownHands.concat(sp.shownHands || []);
      p.rangeHands    = p.rangeHands.concat(sp.rangeHands || []);
      p.handsHistory  = p.handsHistory.concat(sp.handsHistory || []);
      p.badBeats      = p.badBeats.concat(sp.badBeats || []);
      p.suckOuts      = p.suckOuts.concat(sp.suckOuts || []);
      for (const [cat, cnt] of Object.entries(sp.handCategories || {})) {
        p.handCategories[cat] = (p.handCategories[cat] || 0) + cnt;
      }
      for (const s of ['preflop', 'flop', 'turn', 'river']) {
        p.streetActions[s] += sp.streetActions?.[s] || 0;
      }
    }
  }

  for (const p of Object.values(players)) {
    const h = p.handsDealt || 1;
    p.vpip           = +(p.vpipHands / h * 100).toFixed(1);
    p.pfr            = +(p.pfrHands / h * 100).toFixed(1);
    p.preflopFoldPct = +(p.preflopFolds / h * 100).toFixed(1);
    p.winRate        = +(p.handsWon / h * 100).toFixed(1);
    p.af = p.totalCalls > 0
      ? +(p.totalBetsRaises / p.totalCalls).toFixed(2)
      : p.totalBetsRaises > 0 ? 99 : 0;
    p.netChips  = p.cashOut - p.buyIns;
    p.luckiness = p.allHandsShown > 0
      ? +(p.premiumHandsShown / p.allHandsShown * 100).toFixed(1)
      : 0;
    p.tightness = Math.max(0, Math.min(100, Math.round(100 - p.vpip)));
  }

  return { players, handCount };
}
