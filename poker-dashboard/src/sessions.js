const KEY = 'poker-sessions';

// Bump when the shape of the saved `stats` payload changes in a way that affects
// derived numbers users see. We use this to flag stale localStorage sessions and
// prompt re-upload rather than silently mutating historical numbers.
//   v1: original (broken Net Chips when player still seated at log end)
//   v2: tracks lastSeenStack / lastBuyInOrder / lastQuitOrder and effectiveCashOut
export const STATS_SCHEMA_VERSION = 2;

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function hasOutdatedSessions() {
  return loadSessions().some(s => (s.schemaVersion || 1) < STATS_SCHEMA_VERSION);
}

export function clearAllSessions() {
  localStorage.removeItem(KEY);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function isDuplicate(contentHash) {
  return loadSessions().some(s => s.contentHash === contentHash);
}

export function saveSession(fileName, stats, gameDate = null, contentHash = null, viewerName = null) {
  const sessions = loadSessions();
  const id = genId();
  sessions.unshift({
    id,
    fileName,
    gameDate: gameDate ? new Date(gameDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    uploadedAt: new Date().toISOString(),
    handCount: stats.handCount,
    playerNames: Object.keys(stats.players),
    viewerName,
    contentHash,
    schemaVersion: STATS_SCHEMA_VERSION,
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
  if (sessions.length === 1) {
    const session = sessions[0];
    const stats = session.stats;
    // Tag hands with session metadata for single session too (for consistency)
    for (const player of Object.values(stats.players)) {
      player.handsHistory.forEach(h => {
        h.sessionId = session.id;
        h.sessionDate = session.gameDate || session.uploadedAt?.split('T')[0];
      });
      player.badBeats.forEach(bb => {
        bb.sessionId = session.id;
        bb.sessionDate = session.gameDate || session.uploadedAt?.split('T')[0];
      });
      player.suckOuts.forEach(so => {
        so.sessionId = session.id;
        so.sessionDate = session.gameDate || session.uploadedAt?.split('T')[0];
      });
    }
    return stats;
  }

  const players = {};
  let handCount = 0;

  for (const session of sessions) {
    const sessionDate = session.gameDate || session.uploadedAt?.split('T')[0];
    const sessionId = session.id;
    handCount += session.handCount;
    for (const [name, sp] of Object.entries(session.stats.players)) {
      if (!players[name]) {
        players[name] = {
          name,
          handsDealt: 0, vpipHands: 0, pfrHands: 0, preflopFolds: 0,
          totalBetsRaises: 0, totalCalls: 0, totalChecks: 0,
          shownHands: [], handCategories: {},
          netChips: 0, buyIns: 0, cashOut: 0, effectiveCashOut: 0,
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
      // effectiveCashOut from each session already includes that session's
      // still-seated final-stack fallback; just sum it. Fall back to cashOut for
      // pre-v2 stats payloads (handled separately by the outdated-session banner).
      p.effectiveCashOut += (sp.effectiveCashOut != null ? sp.effectiveCashOut : sp.cashOut) || 0;
      p.shownHands    = p.shownHands.concat(sp.shownHands || []);
      p.rangeHands    = p.rangeHands.concat(sp.rangeHands || []);
      // Tag hands with session metadata as we concat
      const taggedHistory = (sp.handsHistory || []).map(h => ({ ...h, sessionId, sessionDate }));
      const taggedBadBeats = (sp.badBeats || []).map(bb => ({ ...bb, sessionId, sessionDate }));
      const taggedSuckOuts = (sp.suckOuts || []).map(so => ({ ...so, sessionId, sessionDate }));
      p.handsHistory  = p.handsHistory.concat(taggedHistory);
      p.badBeats      = p.badBeats.concat(taggedBadBeats);
      p.suckOuts      = p.suckOuts.concat(taggedSuckOuts);
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
    p.netChips  = p.effectiveCashOut - p.buyIns;
    p.luckiness = p.allHandsShown > 0
      ? +(p.premiumHandsShown / p.allHandsShown * 100).toFixed(1)
      : 0;
    p.tightness = Math.max(0, Math.min(100, Math.round(100 - p.vpip)));
  }

  return { players, handCount };
}
