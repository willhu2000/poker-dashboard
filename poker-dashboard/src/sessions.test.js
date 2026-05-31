import { describe, it, expect } from 'vitest';
import { analyseLog } from './stats.js';
import { mergeSessions } from './sessions.js';
import { SPLIT_AND_SOLO } from './testFixtures.js';

function makeSession(id = 's1') {
  const stats = analyseLog(SPLIT_AND_SOLO);
  return {
    id,
    fileName: 'fixture',
    gameDate: '2026-02-11',
    uploadedAt: '2026-02-11T20:00:00.000Z',
    handCount: stats.handCount,
    playerNames: Object.keys(stats.players),
    viewerName: 'Alice',
    schemaVersion: 3,
    stats,
  };
}

describe('mergeSessions — single session', () => {
  const merged = mergeSessions([makeSession('s1')], null);
  const alice = merged.players['Alice'];

  it('tags hands with session id/date', () => {
    const h1 = alice.handsHistory.find(h => h.num === 1);
    expect(h1.sessionId).toBe('s1');
    expect(h1.sessionDate).toBe('2026-02-11');
  });

  it('re-keys action logs under ${sessionId}_${num}', () => {
    expect(merged.handActionLogs['s1_1']).toBeTruthy();
    expect(merged.handActionLogs['s1_2']).toBeTruthy();
  });
});

describe('mergeSessions — split back-fill for legacy data', () => {
  it('reconstructs isSplit / take-home from stored action logs', () => {
    // Simulate a pre-split-tracking save: strip the split fields but keep the
    // action logs (which still carry the `collect` actions).
    const session = makeSession('legacy');
    for (const p of Object.values(session.stats.players)) {
      delete p.handsSplit;
      for (const h of p.handsHistory) {
        delete h.isSplit;
        delete h.splitWith;
      }
    }

    const merged = mergeSessions([session], null);
    const alice = merged.players['Alice'];
    const h1 = alice.handsHistory.find(h => h.num === 1);

    expect(h1.isSplit).toBe(true);
    expect(h1.splitWith).toEqual(['Bob']);
    expect(h1.wonAmount).toBe(10);
    expect(alice.handsSplit).toBe(1);
  });
});
