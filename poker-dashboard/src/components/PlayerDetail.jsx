import { useState, useEffect } from 'react';
import { classifyHand } from '../parser.js';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#a29bfe','#55efc4','#fdcb6e','#e17055','#74b9ff'];
const RANKS_DESC = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

// ── Hand category label ───────────────────────────────────────────────────────
function categoryLabel(c1, c2) {
  if (!c1 || !c2) return '—';
  const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const r1 = RANK_ORDER.indexOf(c1.rank);
  const r2 = RANK_ORDER.indexOf(c2.rank);
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  const suited = c1.suit === c2.suit && c1.suit !== '?';
  const paired = r1 === r2;
  const gap = hi - lo;
  if (paired) {
    if (hi >= 12) return 'Premium Pair (AA/KK)';
    if (hi >= 10) return 'Strong Pair (QQ/JJ)';
    if (hi >= 7)  return 'Medium Pair (TT-88)';
    if (hi >= 4)  return 'Small Pair (77-55)';
    return 'Micro Pair (44-22)';
  }
  if (hi === 12 && lo === 11) return suited ? 'Premium (AKs)' : 'Premium (AKo)';
  if (hi === 12 && lo >= 10)  return suited ? 'Strong Ace (AQs/AJs)' : 'Strong Ace (AQo/AJo)';
  if (hi === 12 && lo >= 7)   return suited ? 'Medium Ace suited' : 'Medium Ace offsuit';
  if (hi === 12)               return suited ? 'Weak Ace suited' : 'Weak Ace offsuit';
  if (hi >= 10 && gap <= 2)   return suited ? 'Broadway suited' : 'Broadway offsuit';
  if (gap === 1 && lo >= 5)   return suited ? 'Suited Connector' : 'One-Gap Connector';
  if (gap <= 2 && lo >= 4 && suited) return 'Suited Connector';
  return 'Speculative / Trash';
}

// ── Card badge ────────────────────────────────────────────────────────────────
function CardBadge({ card }) {
  if (!card) return null;
  const suitMap = { s: '♠', h: '♥', d: '♦', c: '♣', '?': '?' };
  return (
    <span className={`card-badge ${card.suit}`}>
      {card.rank}{suitMap[card.suit] || card.suit}
    </span>
  );
}

// ── Range grid ────────────────────────────────────────────────────────────────
function handKey(c1, c2) {
  const toR = r => r === '10' ? 'T' : r;
  const r1 = toR(c1.rank), r2 = toR(c2.rank);
  const i1 = RANKS_DESC.indexOf(r1), i2 = RANKS_DESC.indexOf(r2);
  if (i1 === i2) return r1 + r2;
  const suited = c1.suit === c2.suit && c1.suit !== '?';
  const [hi, lo] = i1 < i2 ? [r1, r2] : [r2, r1];
  return hi + lo + (suited ? 's' : 'o');
}

function cellBg(count, maxCount) {
  if (!count || !maxCount) return '#16192a';
  const t = Math.sqrt(count / maxCount);
  const hue = Math.round(260 + t * 100) % 360;
  return `hsl(${hue}, ${Math.round(45 + t * 50)}%, ${Math.round(22 + t * 38)}%)`;
}

function RangeGrid({ rangeHands }) {
  const freq = {};
  for (const { c1, c2 } of rangeHands) {
    if (!c1 || !c2) continue;
    const k = handKey(c1, c2);
    freq[k] = (freq[k] || 0) + 1;
  }
  const maxCount = Math.max(1, ...Object.values(freq));
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${RANKS_DESC.length}, 1fr)`, gap: 2, minWidth: 300, maxWidth: 520, margin: '0 auto' }}>
        {RANKS_DESC.map((rowR, i) => RANKS_DESC.map((colR, j) => {
          const key = i === j ? rowR + colR : i < j ? rowR + colR + 's' : colR + rowR + 'o';
          const count = freq[key] || 0;
          const label = i === j ? rowR + rowR : i < j ? rowR + colR + 's' : colR + rowR + 'o';
          return (
            <div key={key} title={`${label}: ${count} hand${count !== 1 ? 's' : ''}`}
              style={{ background: cellBg(count, maxCount), borderRadius: 2, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: count > 0 ? '#fff' : 'var(--muted)', fontWeight: count > 0 ? 600 : 400, opacity: count > 0 ? 1 : 0.45 }}>
              {label}
            </div>
          );
        }))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.7rem', textAlign: 'center', marginTop: 6 }}>
        Darker = played more · hover for count · suited upper-right · pairs diagonal
      </p>
    </div>
  );
}

// ── Radar info ────────────────────────────────────────────────────────────────
const RADAR_AXES = [
  { name: 'VPIP',       desc: 'How often you voluntarily put money in preflop (call or raise). Higher = looser hand selection.',                        scale: 'Direct %. 50% VPIP → 50 on chart.' },
  { name: 'PFR',        desc: 'How often you raise preflop. A PFR close to your VPIP means you rarely limp in.',                                       scale: 'Direct %. 30% PFR → 30 on chart.' },
  { name: 'Aggression', desc: 'Post-flop aggression factor: (Bets + Raises) ÷ Calls. Higher = more betting pressure, fewer passive calls.',            scale: 'AF × 20, capped at 100. An AF of 5 fills the axis.' },
  { name: 'Win Rate',   desc: 'Percentage of all dealt hands where you collected the pot.',                                                             scale: 'Direct %. 40% win rate → 40 on chart.' },
  { name: 'Tightness',  desc: 'Inverse of VPIP — how selectively you play hands. High score = tight range, low score = loose.',                        scale: '100 − VPIP. A 20% VPIP player scores 80.' },
  { name: 'Luckiness',  desc: '% of your observed hands that were premium (AA/KK/QQ/JJ/AK). Measures how often you\'ve been dealt strong cards.',      scale: '% × 2, capped at 100. 50% premium rate fills the axis.' },
];

// ── Style tags ────────────────────────────────────────────────────────────────
function styleTag(p) {
  const tags = [];
  if (p.vpip < 20) tags.push({ label: 'Tight', cls: 'tight' });
  else if (p.vpip > 50) tags.push({ label: 'Loose', cls: 'loose' });
  else tags.push({ label: 'Semi-Loose', cls: '' });
  if (p.af > 2) tags.push({ label: 'Aggressive', cls: 'agg' });
  else if (p.af < 1) tags.push({ label: 'Passive', cls: '' });
  else tags.push({ label: 'Balanced', cls: '' });
  return tags;
}

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{payload[0]?.name}</div>
      <div style={{ color: payload[0]?.payload?.fill || '#fff' }}>{payload[0]?.value} hands</div>
    </div>
  );
};

// ── Severity helpers ──────────────────────────────────────────────────────────
const BB_SEVERITY  = ['', '', '💔', '💔', '💔💔', '💔💔', '💔💔💔', '💔💔💔', '💔💔💔💔'];
const SO_SEVERITY  = ['', '', '🎲', '🎲', '🎲🎲', '🎲🎲', '🎲🎲🎲', '🎲🎲🎲', '🎲🎲🎲🎲'];

const OMINOUS = [
  'No bad beats on record. The poker gods smile upon you... for now.',
  'Zero bad beats. Either you run perfect or the real pain is still coming.',
  'Clean history. But variance always collects what it\'s owed.',
  'No suffering documented. The river has a long memory.',
  'Spotless record. In poker, there\'s no such thing as a free lunch.',
];
const SUCKOUT_NONE = [
  'No suck-outs on record. Your wins have been earned honestly.',
  'You haven\'t caught a lucky river yet. Pure skill, or just always ahead?',
  'No outdraws found. Either you\'re always ahead, or always behind.',
  'A clean conscience — you haven\'t stolen any pots from someone who deserved them.',
];

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayerDetail({ player: p, isMerged = false }) {
  const [showGrid, setShowGrid] = useState(false);
  const [showRadarInfo, setShowRadarInfo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [handFilter, setHandFilter] = useState('all');
  const [expandedHand, setExpandedHand] = useState(null);

  const tags = styleTag(p);

  const radarData = [
    { subject: 'VPIP',       value: Math.min(p.vpip, 100) },
    { subject: 'PFR',        value: Math.min(p.pfr, 100) },
    { subject: 'Aggression', value: Math.min(p.af * 20, 100) },
    { subject: 'Win Rate',   value: Math.min(p.winRate, 100) },
    { subject: 'Tightness',  value: p.tightness },
    { subject: 'Luckiness',  value: Math.min(p.luckiness * 2, 100) },
  ];

  const catData = Object.entries(p.handCategories)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const hasRange = (p.rangeHands || []).length > 0;

  // Category drill-down
  const handsHistory = p.handsHistory || [];
  const categoryHands = selectedCategory
    ? handsHistory.filter(h => h.c1 && h.c2 && categoryLabel(h.c1, h.c2) === selectedCategory)
    : [];

  function toggleCategory(name) {
    setSelectedCategory(prev => prev === name ? null : name);
  }

  // Bad beats & suck-outs
  const badBeats = [...(p.badBeats || [])].sort((a, b) => b.myHandRank - a.myHandRank);
  const suckOuts = [...(p.suckOuts || [])].sort((a, b) => b.oppHandRank - a.oppHandRank);
  const ominousMsg    = OMINOUS[   (p.name.charCodeAt(0) || 0) % OMINOUS.length];
  const suckOutEmpty  = SUCKOUT_NONE[(p.name.charCodeAt(0) || 0) % SUCKOUT_NONE.length];

  // Hand history filters
  const FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'showdowns', label: 'Showdowns' },
    { key: 'wins',      label: 'Wins' },
    { key: 'losses',    label: 'Losses' },
    { key: 'badbeats',  label: 'Bad Beats' },
    { key: 'suckouts',  label: 'Suck-Outs' },
  ];

  function filterCount(key) {
    if (key === 'all')       return handsHistory.length;
    if (key === 'showdowns') return handsHistory.filter(h => h.wasShown).length;
    if (key === 'wins')      return handsHistory.filter(h => h.won).length;
    if (key === 'losses')    return handsHistory.filter(h => !h.won).length;
    if (key === 'badbeats')  return handsHistory.filter(h => h.isBadBeat).length;
    if (key === 'suckouts')  return handsHistory.filter(h => h.isSuckOut).length;
    return 0;
  }

  const filteredHands = [...handsHistory].reverse().filter(h => {
    if (handFilter === 'showdowns') return h.wasShown;
    if (handFilter === 'wins')      return h.won;
    if (handFilter === 'losses')    return !h.won;
    if (handFilter === 'badbeats')  return h.isBadBeat;
    if (handFilter === 'suckouts')  return h.isSuckOut;
    return true;
  });

  useEffect(() => {
    console.log(`[${p.name}] Filter Debug:`, {
      filter: handFilter,
      handsHistoryCount: handsHistory.length,
      filteredCount: filteredHands.length,
      sampleHands: handsHistory.slice(0, 3).map(h => ({ num: h.num, isBadBeat: h.isBadBeat, isSuckOut: h.isSuckOut, wasShown: h.wasShown, won: h.won })),
    });
  }, [p, handFilter, handsHistory.length, filteredHands.length]);

  return (
    <div className="player-detail">
      <h2>{p.name}</h2>
      <div className="subtitle">
        {tags.map(t => (
          <span key={t.label} className={`tag ${t.cls}`} style={{ marginRight: 6 }}>{t.label}</span>
        ))}
      </div>

      {/* Stat grid */}
      <div className="detail-grid">
        <div className="detail-stat"><div className="ds-label">Hands Dealt</div><div className="ds-value">{p.handsDealt}</div></div>
        <div className="detail-stat"><div className="ds-label">Net Chips</div>
          <div className="ds-value" style={{ color: p.netChips >= 0 ? 'var(--win)' : 'var(--lose)' }}>
            {p.netChips >= 0 ? '+' : ''}{p.netChips}
          </div>
        </div>
        <div className="detail-stat"><div className="ds-label">VPIP</div><div className="ds-value">{p.vpip}%</div></div>
        <div className="detail-stat"><div className="ds-label">PFR</div><div className="ds-value">{p.pfr}%</div></div>
        <div className="detail-stat"><div className="ds-label">Preflop Fold</div><div className="ds-value">{p.preflopFoldPct}%</div></div>
        <div className="detail-stat"><div className="ds-label">Agg Factor</div><div className="ds-value">{p.af === 99 ? '∞' : p.af}</div></div>
        <div className="detail-stat"><div className="ds-label">Win Rate</div><div className="ds-value">{p.winRate}%</div></div>
        <div className="detail-stat"><div className="ds-label">Hands Won</div><div className="ds-value">{p.handsWon}</div></div>
        <div className="detail-stat"><div className="ds-label">Luckiness†</div><div className="ds-value">{p.luckiness}%</div></div>
        <div className="detail-stat"><div className="ds-label">Buy-ins</div><div className="ds-value">{p.buyIns}</div></div>
        <div className="detail-stat"><div className="ds-label">Cash Out</div><div className="ds-value">{p.cashOut}</div></div>
        <div className="detail-stat"><div className="ds-label">Showdowns</div><div className="ds-value">{p.shownHands.length}</div></div>
      </div>

      {/* Charts */}
      <div className="charts-grid" style={{ marginBottom: 0 }}>

        {/* Radar */}
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Player Profile</h3>
            <button className="radar-info-btn" onClick={() => setShowRadarInfo(s => !s)}>
              ⓘ {showRadarInfo ? 'Hide' : 'How it\'s scored'}
            </button>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} outerRadius={80}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#7c82a0', fontSize: 11 }} />
              <Radar dataKey="value" stroke="#6c63ff" fill="#6c63ff" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
          {showRadarInfo && (
            <div className="radar-info-panel">
              {RADAR_AXES.map(a => (
                <div key={a.name} className="radar-info-row">
                  <div className="ri-name">{a.name}</div>
                  <div className="ri-body">
                    <div className="ri-desc">{a.desc}</div>
                    <div className="ri-scale">{a.scale}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hand categories — pie or range grid */}
        {(catData.length > 0 || hasRange) && (
          <div className="chart-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>{showGrid ? 'Preflop Range Grid' : 'Hand Categories (shown/known)'}</h3>
              {hasRange && (
                <button onClick={() => setShowGrid(g => !g)}
                  style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
                  {showGrid ? 'Pie Chart' : 'Range Grid'}
                </button>
              )}
            </div>
            {showGrid ? (
              <RangeGrid rangeHands={p.rangeHands || []} />
            ) : (
              <>
                <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginBottom: 6 }}>
                  Click a slice or legend item to see all hands in that category.
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart margin={{ top: 16, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={catData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      outerRadius={85}
                      onClick={(d) => toggleCategory(d.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {catData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[i % COLORS.length]}
                          opacity={selectedCategory && selectedCategory !== entry.name ? 0.35 : 1}
                          stroke={selectedCategory === entry.name ? '#fff' : 'transparent'}
                          strokeWidth={selectedCategory === entry.name ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#7c82a0', paddingTop: 14, cursor: 'pointer' }}
                      onClick={(d) => toggleCategory(d.value)}
                      formatter={(value) => (
                        <span style={{ color: selectedCategory === value ? 'var(--text)' : 'var(--muted)', fontWeight: selectedCategory === value ? 700 : 400 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Category drill-down ───────────────────────────────────────────────── */}
      {selectedCategory && (
        <div className="category-drilldown">
          <div className="cd-header">
            <span className="cd-title">{selectedCategory}</span>
            <span className="cd-count">{categoryHands.length} hand{categoryHands.length !== 1 ? 's' : ''}</span>
            <button className="cd-close" onClick={() => setSelectedCategory(null)}>✕ Clear</button>
          </div>
          {categoryHands.length === 0 ? (
            <p style={{ color: 'var(--muted)', padding: '12px 0', fontSize: '0.85rem' }}>No hand history available for this category.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="hand-table">
                <thead>
                  <tr><th>Hand #</th>{isMerged && <th>Session</th>}<th>Cards</th><th>Result</th><th>Board</th><th>Pot</th></tr>
                </thead>
                <tbody>
                  {[...categoryHands].reverse().map(h => (
                    <tr key={h.num} className={h.won ? 'won' : ''}>
                      <td>#{h.num}</td>
                      {isMerged && <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{h.sessionDate || '—'}</td>}
                      <td><CardBadge card={h.c1} /><CardBadge card={h.c2} /></td>
                      <td>
                        {h.isBadBeat
                          ? <span className="result-badge bad-beat">💔 Bad Beat</span>
                          : h.isSuckOut
                            ? <span className="result-badge suck-out">🎲 Suck-Out</span>
                            : h.won
                              ? <span className="result-badge win">✓ Won</span>
                              : h.wasShown
                                ? <span className="result-badge loss">✗ Lost</span>
                                : <span className="result-badge fold">Folded</span>}
                      </td>
                      <td>
                        {h.board.length > 0
                          ? <div style={{ display: 'flex', gap: 3 }}>{h.board.map((c, i) => <CardBadge key={i} card={c} />)}</div>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                        {h.potSize > 0 ? h.potSize.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Suck-Outs ────────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 20 }}>
        🎲 Suck-Outs
        {suckOuts.length > 0 && (
          <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
            — hands where you came from behind to win, sorted by what you beat
          </span>
        )}
      </div>

      {suckOuts.length === 0 ? (
        <div className="bad-beat-empty suck-out-empty">{suckOutEmpty}</div>
      ) : (
        <div className="bad-beat-list">
          {suckOuts.map((so, i) => (
            <div key={i} className="bad-beat-card suck-out-card">
              <div className="bb-header">
                <span className="bb-num">Hand #{so.num}{isMerged && so.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({so.sessionDate})</span>}</span>
                <span className="bb-severity">{SO_SEVERITY[so.oppHandRank] || ''}</span>
                <span className="bb-pot">Pot: {so.potSize.toLocaleString()}</span>
              </div>
              <div className="bb-body">
                <div className="bb-side">
                  <div className="bb-label">Your Hand</div>
                  <div className="bb-cards"><CardBadge card={so.c1} /><CardBadge card={so.c2} /></div>
                  <div className="bb-hand-name" style={{ color: 'var(--win)' }}>{so.myHandName}</div>
                </div>
                <div className="bb-vs" style={{ borderColor: 'rgba(0,212,170,0.3)', color: 'var(--accent2)' }}>BEAT</div>
                <div className="bb-side">
                  <div className="bb-label">{so.oppName}</div>
                  <div className="bb-cards"><CardBadge card={so.oppC1} /><CardBadge card={so.oppC2} /></div>
                  <div className="bb-hand-name" style={{ color: 'var(--muted)' }}>{so.oppHandName}</div>
                </div>
              </div>
              {so.board.length > 0 && (
                <div className="bb-board">
                  <span className="bb-board-label">Board: </span>
                  {so.board.map((c, j) => <CardBadge key={j} card={c} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Bad Beats ─────────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>
        💔 Bad Beats
        {badBeats.length > 0 && (
          <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
            — showdown losses with Two Pair or better, sorted worst to least
          </span>
        )}
      </div>

      {badBeats.length === 0 ? (
        <div className="bad-beat-empty">{ominousMsg}</div>
      ) : (
        <div className="bad-beat-list">
          {badBeats.map((bb, i) => (
            <div key={i} className="bad-beat-card">
              <div className="bb-header">
                <span className="bb-num">Hand #{bb.num}{isMerged && bb.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({bb.sessionDate})</span>}</span>
                <span className="bb-severity">{BB_SEVERITY[bb.myHandRank] || ''}</span>
                <span className="bb-pot">Pot: {bb.potSize.toLocaleString()}</span>
              </div>
              <div className="bb-body">
                <div className="bb-side">
                  <div className="bb-label">Your Hand</div>
                  <div className="bb-cards"><CardBadge card={bb.c1} /><CardBadge card={bb.c2} /></div>
                  <div className="bb-hand-name">{bb.myHandName}</div>
                </div>
                <div className="bb-vs">BEAT BY</div>
                <div className="bb-side">
                  <div className="bb-label">{bb.oppName}</div>
                  <div className="bb-cards"><CardBadge card={bb.oppC1} /><CardBadge card={bb.oppC2} /></div>
                  <div className="bb-hand-name">{bb.oppHandName}</div>
                </div>
              </div>
              {bb.board.length > 0 && (
                <div className="bb-board">
                  <span className="bb-board-label">Board: </span>
                  {bb.board.map((c, j) => <CardBadge key={j} card={c} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Hand History ──────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>Hand History</div>

      <div className="hand-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={`filter-btn ${handFilter === f.key ? 'active' : ''}`}
            onClick={() => setHandFilter(f.key)}>
            {f.label} <span className="filter-count">({filterCount(f.key)})</span>
          </button>
        ))}
      </div>

      {handsHistory.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
          No hand history available — re-upload the session to populate this section.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="hand-table">
            <thead>
              <tr>
                <th>Hand #</th>{isMerged && <th>Session</th>}<th>Cards</th><th>Type</th><th>Result</th><th>Pot</th>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredHands.flatMap(h => {
                const isExp = expandedHand === h.num;
                const hasCards = h.c1 && h.c2;
                const rows = [
                  <tr key={h.num}
                    className={`hand-row ${h.isBadBeat ? 'bad-beat-row' : ''} ${h.isSuckOut && !h.isBadBeat ? 'suck-out-row' : ''} ${h.won && !h.isBadBeat && !h.isSuckOut ? 'won' : ''}`}
                    onClick={() => setExpandedHand(isExp ? null : h.num)}
                    style={{ cursor: 'pointer' }}>
                    <td>#{h.num}</td>
                    {isMerged && <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{h.sessionDate || '—'}</td>}
                    <td>
                      {hasCards
                        ? <><CardBadge card={h.c1} /><CardBadge card={h.c2} /></>
                        : <span className="mucked-cards">?? ??</span>}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {hasCards ? categoryLabel(h.c1, h.c2) : '—'}
                    </td>
                    <td>
                      {h.isBadBeat
                        ? <span className="result-badge bad-beat">💔 Bad Beat</span>
                        : h.isSuckOut
                          ? <span className="result-badge suck-out">🎲 Suck-Out</span>
                          : h.won
                            ? <span className="result-badge win">✓ Won</span>
                            : h.wasShown
                              ? <span className="result-badge loss">✗ Lost</span>
                              : <span className="result-badge fold">Folded</span>}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                      {h.potSize > 0 ? h.potSize.toLocaleString() : '—'}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{isExp ? '▲' : '▼'}</td>
                  </tr>,
                ];

                if (isExp) {
                  rows.push(
                    <tr key={`${h.num}-exp`} className="hand-expanded-row">
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div className="hand-detail-panel">
                          {h.board.length > 0 && (
                            <div className="hd-row">
                              <span className="hd-label">Board</span>
                              <div className="hd-cards">
                                {h.board.map((c, i) => <CardBadge key={i} card={c} />)}
                              </div>
                            </div>
                          )}
                          {h.opponents.length > 0 && (
                            <div className="hd-row">
                              <span className="hd-label">Shown</span>
                              <div className="hd-opponents">
                                {h.opponents.map((opp, i) => (
                                  <span key={i} className="hd-opp">
                                    <span style={{ color: 'var(--muted)', marginRight: 4 }}>{opp.name}:</span>
                                    {opp.c1 ? <CardBadge card={opp.c1} /> : <span className="mucked-cards" style={{ fontSize: '0.75rem' }}>??</span>}
                                    {opp.c2 ? <CardBadge card={opp.c2} /> : <span className="mucked-cards" style={{ fontSize: '0.75rem' }}>??</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="hd-row">
                            <span className="hd-label">Result</span>
                            <span className={h.won ? 'pos' : 'neg'}>
                              {h.won
                                ? <>Won{h.wonAmount != null ? <strong> +{h.wonAmount.toLocaleString()}</strong> : ''} chips{h.myHandName && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>with {h.myHandName}</span>}</>
                                : h.wasShown
                                  ? <>Lost at showdown{h.winnerHandName && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>to {h.winnerHandName}</span>}{h.myHandName && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>(your hand: {h.myHandName})</span>}</>
                                  : 'Folded'}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 16 }}>
        † Luckiness = % of observed hands that were premium (AA/KK/QQ/JJ/AK).
        VPIP/PFR/Fold% from preflop actions. AF = (Bets+Raises)/Calls post-flop.
        Bad beats = showdown losses with Two Pair or better. Suck-outs = the inverse.
      </p>
    </div>
  );
}
