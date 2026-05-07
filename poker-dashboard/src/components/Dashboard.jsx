import { useState, useRef, useCallback } from 'react';
import Leaderboard from './Leaderboard.jsx';
import PlayerDetail from './PlayerDetail.jsx';
import OverviewCharts from './OverviewCharts.jsx';

const GLOSSARY = [
  { abbr: 'VPIP', full: 'Voluntarily Put $ In Pot', desc: '% of hands where a player called or raised preflop. Blinds excluded. High = loose range.' },
  { abbr: 'PFR', full: 'Preflop Raise %', desc: '% of hands with a preflop raise. Always ≤ VPIP. High = aggressive preflop player.' },
  { abbr: 'AF', full: 'Aggression Factor', desc: '(Bets + Raises) ÷ Calls post-flop. >2 = aggressive, 1–2 = balanced, <1 = passive.' },
  { abbr: 'Win%', full: 'Win Rate', desc: '% of dealt hands where the player collected the pot.' },
  { abbr: 'Fold%', full: 'Preflop Fold %', desc: '% of hands folded before seeing the flop.' },
  { abbr: 'Luck†', full: 'Luckiness Proxy', desc: '% of observed hands that were premium (AA/KK/QQ/JJ/AK). Higher = ran hot.' },
  { abbr: 'Tight', full: 'Tight (VPIP < 20%)', desc: 'Plays only strong hands, folds most hands preflop.' },
  { abbr: 'Loose', full: 'Loose (VPIP > 50%)', desc: 'Plays the majority of dealt hands preflop.' },
  { abbr: 'Semi', full: 'Semi-Loose (VPIP 20–50%)', desc: 'Plays a moderate range, in between tight and loose.' },
  { abbr: 'Passive', full: 'Passive (AF < 1)', desc: 'Prefers calling over betting/raising. Check-call tendency.' },
  { abbr: 'Agg', full: 'Aggressive (AF > 2)', desc: 'Frequently bets and raises, putting pressure on opponents.' },
  { abbr: 'Net Chips', full: 'Net Profit/Loss', desc: 'Cash-out minus total buy-ins across all sessions loaded.' },
];

function GlossaryPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glossary-panel">
      <button className="glossary-toggle" onClick={() => setOpen(o => !o)}>
        📖 Glossary — what do these terms mean? {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="glossary-grid">
          {GLOSSARY.map(g => (
            <div key={g.abbr} className="glossary-item">
              <div className="g-abbr">{g.abbr}</div>
              <div className="g-full">{g.full}</div>
              <div className="g-desc">{g.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ data, fileName, isMerged, sessionCount, selectedIds = [], allSessions = [], onBack, onViewMerged, onUpdateSessions, onAddSession, error }) {
  const { players, handCount } = data;
  const playerList = Object.values(players).sort((a, b) => b.netChips - a.netChips);
  const [selectedPlayer, setSelectedPlayer] = useState(playerList[0]?.name || null);
  const [showSelectorMenu, setShowSelectorMenu] = useState(false);
  const addInputRef = useRef(null);

  const selected = players[selectedPlayer];

  const handleSessionToggle = (sessionId, checked) => {
    let newIds;
    if (checked) {
      newIds = [...selectedIds, sessionId];
    } else {
      newIds = selectedIds.filter(id => id !== sessionId);
    }
    if (newIds.length > 0) {
      onUpdateSessions(newIds);
    }
  };

  const handleAddFile = useCallback((e) => {
    const file = e.target.files[0];
    if (file) onAddSession(file);
    e.target.value = '';
  }, [onAddSession]);

  return (
    <>
      <div className="dashboard-header">
        <div>
          <button className="btn btn-ghost" style={{ marginBottom: 8, fontSize: '0.82rem', padding: '6px 14px' }} onClick={onBack}>
            ← Sessions
          </button>
          <h1>♠ Poker Dashboard</h1>
          <div className="meta">
            {fileName} · {handCount} hands · {playerList.length} players
            {isMerged && <span className="tag" style={{ marginLeft: 10 }}>Merged</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {isMerged && (
            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => setShowSelectorMenu(m => !m)}>
                📋 Viewing {selectedIds.length} of {allSessions.length} ▼
              </button>
              {showSelectorMenu && (
                <div className="session-selector-menu">
                  {allSessions.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={(e) => handleSessionToggle(s.id, e.target.checked)} style={{ marginRight: 8, cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.85rem' }}>{s.fileName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isMerged && sessionCount >= 2 && (
            <button className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={onViewMerged}>
              ⚡ View All {sessionCount} Sessions
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => addInputRef.current.click()}>
            + Add Session
          </button>
          <input ref={addInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleAddFile} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

      <GlossaryPanel />

      {/* Overview stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Hands Played</div>
          <div className="value">{handCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Players</div>
          <div className="value">{playerList.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Biggest Winner</div>
          <div className="value pos">
            {playerList[0] ? `${playerList[0].name.split(' ')[0]} +${playerList[0].netChips}` : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Biggest Loser</div>
          <div className="value neg">
            {(() => {
              const loser = [...playerList].sort((a, b) => a.netChips - b.netChips)[0];
              return loser ? `${loser.name.split(' ')[0]} ${loser.netChips}` : '—';
            })()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Most Aggressive</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            {(() => {
              const p = [...playerList].sort((a, b) => b.af - a.af)[0];
              return p ? `${p.name.split(' ')[0]} (AF ${p.af})` : '—';
            })()}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Tightest Player</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            {(() => {
              const p = [...playerList].filter(x => x.handsDealt >= 5).sort((a, b) => a.vpip - b.vpip)[0];
              return p ? `${p.name.split(' ')[0]} (${p.vpip}%)` : '—';
            })()}
          </div>
        </div>
      </div>

      {/* Overview charts */}
      <OverviewCharts players={playerList} />

      <hr className="divider" />

      {/* Player selector */}
      <div className="section-title">Player Deep Dive</div>
      <div className="player-tabs">
        {playerList.map(p => (
          <button
            key={p.name}
            className={`player-tab ${selectedPlayer === p.name ? 'active' : ''}`}
            onClick={() => setSelectedPlayer(p.name)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selected && <PlayerDetail player={selected} isMerged={isMerged} />}

      <hr className="divider" />

      {/* Leaderboard */}
      <div className="section-title">Leaderboard</div>
      <div className="chart-card">
        <Leaderboard players={playerList} onSelect={setSelectedPlayer} selected={selectedPlayer} />
      </div>
    </>
  );
}
