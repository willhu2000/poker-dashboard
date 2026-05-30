import { useState } from 'react';
import { classifyHand } from '../parser.js';
import { bestHand } from '../handEval.js';
import CoachingReport from './CoachingReport.jsx';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#a29bfe','#55efc4','#fdcb6e','#e17055','#74b9ff'];
const RANKS_DESC = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

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

// ── Premium hand detection ────────────────────────────────────────────────────
function isPremiumHand(c1, c2) {
  if (!c1 || !c2) return false;
  const RANK_V = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const r1 = RANK_V[c1.rank] || 0, r2 = RANK_V[c2.rank] || 0;
  // AA, KK, QQ
  if (r1 === r2 && r1 >= 12) return true;
  // AKs
  if (((r1 === 14 && r2 === 13) || (r1 === 13 && r2 === 14)) && c1.suit === c2.suit) return true;
  return false;
}

function premiumLabel(c1, c2) {
  if (!c1 || !c2) return '';
  const RANK_V = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const r1 = RANK_V[c1.rank] || 0, r2 = RANK_V[c2.rank] || 0;
  if (r1 === r2) return c1.rank + c1.rank;
  return 'AKs';
}

// ── Hand strength for sort ────────────────────────────────────────────────────
const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function handStrength(c1, c2) {
  if (!c1 || !c2) return -1;
  const r1 = RANK_VAL[c1.rank] || 0;
  const r2 = RANK_VAL[c2.rank] || 0;
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  const suited = c1.suit === c2.suit && c1.suit !== '?';
  if (r1 === r2) return 500 + hi * 10;          // pairs top
  return hi * 15 + lo + (suited ? 1 : 0);       // hi card dominates, suited bonus
}

// ── Card query parser ─────────────────────────────────────────────────────────
const _RMAP = {
  'a':'A','ace':'A','aces':'A',
  'k':'K','king':'K','kings':'K',
  'q':'Q','queen':'Q','queens':'Q',
  'j':'J','jack':'J','jacks':'J',
  't':'10','ten':'10','tens':'10','10':'10',
  '9':'9','nine':'9','nines':'9','8':'8','eight':'8','eights':'8',
  '7':'7','seven':'7','sevens':'7','6':'6','six':'6','sixes':'6',
  '5':'5','five':'5','fives':'5','4':'4','four':'4','fours':'4',
  '3':'3','three':'3','threes':'3','2':'2','two':'2','twos':'2','deuce':'2','deuces':'2',
};
const _SMAP = { 's':'s','spade':'s','spades':'s','h':'h','heart':'h','hearts':'h','d':'d','diamond':'d','diamonds':'d','c':'c','club':'c','clubs':'c' };

function parseCardQuery(input) {
  const toks = input.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const cards = [];
  let i = 0;
  while (i < toks.length && cards.length < 2) {
    const t = toks[i];
    // compact rank+suit: "as","kd","10h"
    const rs = t.match(/^(a|k|q|j|10|[2-9])(s|h|d|c)$/);
    if (rs) { cards.push({ rank: _RMAP[rs[1]], suit: _SMAP[rs[2]] }); i++; continue; }
    // pure rank word
    if (_RMAP[t]) {
      const rank = _RMAP[t];
      if (i+1 < toks.length && _SMAP[toks[i+1]]) { cards.push({ rank, suit: _SMAP[toks[i+1]] }); i+=2; }
      else { cards.push({ rank, suit: null }); i++; }
      continue;
    }
    // doubled single-char: "aa","kk","99"
    const dd = t.match(/^([akqjt2-9])\1$/);
    if (dd && _RMAP[dd[1]]) { const r = _RMAP[dd[1]]; cards.push({ rank:r,suit:null },{ rank:r,suit:null }); i++; continue; }
    // "1010"
    if (t === '1010') { cards.push({ rank:'10',suit:null },{ rank:'10',suit:null }); i++; continue; }
    // two-rank compact: "ak","qj","aks"
    const tr = t.match(/^([akqjt2-9])(10|[akqjt2-9])[so]?$/);
    if (tr && _RMAP[tr[1]] && _RMAP[tr[2]]) { cards.push({ rank:_RMAP[tr[1]],suit:null },{ rank:_RMAP[tr[2]],suit:null }); i++; continue; }
    i++;
  }
  return cards;
}

function cardMatchesDesc(card, desc) {
  if (!card || !desc) return false;
  if (desc.rank && card.rank !== desc.rank) return false;
  if (desc.suit && card.suit !== desc.suit) return false;
  return true;
}

function handMatchesCardQuery(c1, c2, descs) {
  if (!descs?.length) return true;
  if (descs.length === 1) return cardMatchesDesc(c1, descs[0]) || cardMatchesDesc(c2, descs[0]);
  const [d1, d2] = descs;
  return (cardMatchesDesc(c1,d1)&&cardMatchesDesc(c2,d2)) || (cardMatchesDesc(c1,d2)&&cardMatchesDesc(c2,d1));
}

function computeHandStrength(h) {
  const board = (h.board || []).filter(c => c && c.rank);
  if (h.c1 && h.c2) {
    if (board.length === 0) {
      // Preflop: only pair or high card
      return h.c1.rank === h.c2.rank ? { rank: 1, name: 'Pair' } : { rank: 0, name: 'High Card' };
    }
    return bestHand([h.c1, h.c2], board) ?? null;
  }
  // Unknown hole cards — evaluate board alone (needs ≥5 cards)
  if (board.length >= 5) return bestHand([], board) ?? null;
  return null;
}

function matchesSearch(h, query, col) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const chkHand = () => String(h.num).includes(q) || `#${h.num}`.includes(q);
  const chkCards = () => {
    const ds = parseCardQuery(query);
    return ds.length > 0 ? handMatchesCardQuery(h.c1, h.c2, ds) : categoryLabel(h.c1,h.c2).toLowerCase().includes(q);
  };
  const chkType = () => categoryLabel(h.c1,h.c2).toLowerCase().includes(q);
  const chkSess = () => fmtDate(h.sessionDate).toLowerCase().includes(q)||(h.sessionDate||'').includes(q);
  const chkRes  = () => (h.isCooler?'cooler':h.isBadBeat?'bad beat':h.isSuckOut?'suck-out':h.won?'won win':h.wasShown?'lost loss':'fold folded').includes(q);
  const chkPot      = () => String(h.potSize||0).includes(q);
  const chkStrength = () => (computeHandStrength(h)?.name ?? '').toLowerCase().includes(q);
  switch(col){
    case 'hand': return chkHand();
    case 'cards': return chkCards();
    case 'type': return chkType();
    case 'session': return chkSess();
    case 'result': return chkRes();
    case 'pot': return chkPot();
    case 'strength': return chkStrength();
    default: return chkHand()||chkCards()||chkType()||chkSess()||chkRes()||chkPot()||chkStrength();
  }
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

// ── Board cards with flop/turn/river separators ───────────────────────────────
function BoardCards({ board }) {
  if (!board?.length) return <span style={{ color:'var(--muted)' }}>—</span>;
  return (
    <div className="board-cards">
      {board.slice(0,3).map((c,i) => <CardBadge key={i} card={c}/>)}
      {board.length>3&&<><span className="board-sep">|</span><CardBadge card={board[3]}/></>}
      {board.length>4&&<><span className="board-sep">|</span><CardBadge card={board[4]}/></>}
    </div>
  );
}

// ── Action log ────────────────────────────────────────────────────────────────
const ACT_TEXT = {
  'post-sb': a=>`posts small blind ${a.amount?.toLocaleString()??''}`,
  'post-bb': a=>`posts big blind ${a.amount?.toLocaleString()??''}`,
  'fold': ()=>'folds',
  'call': a=>`calls ${a.amount?.toLocaleString()??''}`,
  'raise': a=>`raises to ${a.amount?.toLocaleString()??''}`,
  'bet': a=>`bets ${a.amount?.toLocaleString()??''}`,
  'check': ()=>'checks',
  'show': ()=>'shows hand',
  'collect': a=>`collects ${a.amount?.toLocaleString()??''}`,
};

function ActionLog({ log }) {
  if (!log?.length) return <p style={{color:'var(--muted)',fontSize:'0.78rem'}}>No action data (re-upload to capture).</p>;
  const groups = [];
  let cur = { street:'preflop', board:null, actions:[] };
  for (const ev of log) {
    if (ev.type==='street') { groups.push(cur); cur={street:ev.street,board:ev.board,actions:[]}; }
    else cur.actions.push(ev);
  }
  groups.push(cur);
  return (
    <div className="action-log">
      {groups.filter(g=>g.actions.length>0).map((g,gi)=>(
        <div key={gi} className="al-group">
          <div className="al-street-label">
            {g.street.toUpperCase()}
            {g.board?.length>0&&<span className="al-board">{g.board.map((c,i)=><CardBadge key={i} card={c}/>)}</span>}
          </div>
          {g.actions.map((act,ai)=>(
            <div key={ai} className="al-action">
              <span className="al-player">{act.player}</span>
              <span className="al-verb">{ACT_TEXT[act.action]?.(act)??act.action}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
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

// Quantized color stops: blue → purple → magenta → hot pink
const RANGE_STOPS = [
  [30, 80, 220],   // 0: blue
  [70, 60, 200],   // 1
  [110, 50, 190],  // 2
  [145, 40, 180],  // 3
  [175, 35, 165],  // 4
  [200, 30, 150],  // 5
  [220, 28, 130],  // 6
  [235, 30, 110],  // 7
  [245, 30, 90],   // 8
  [255, 40, 100],  // 9: hot pink
];

function cellBg(count, maxCount) {
  if (!count || !maxCount) return '#1e2035';
  if (maxCount <= 10) {
    // Quantized: pick a distinct stop for each count
    const idx = Math.min(count, RANGE_STOPS.length) - 1;
    const [r, g, b] = RANGE_STOPS[Math.round(idx * (RANGE_STOPS.length - 1) / Math.max(maxCount - 1, 1))];
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Smooth interpolation for larger counts
  const t = Math.sqrt(count / maxCount);
  const r = Math.round(30 + t * (255 - 30));
  const g = Math.round(80 + t * (40 - 80));
  const b = Math.round(220 + t * (100 - 220));
  return `rgb(${r}, ${g}, ${b})`;
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
    <div className="range-grid-wrap">
      <div className="range-grid">
        {RANKS_DESC.map((rowR, i) => RANKS_DESC.map((colR, j) => {
          const key = i === j ? rowR + colR : i < j ? rowR + colR + 's' : colR + rowR + 'o';
          const count = freq[key] || 0;
          const label = i === j ? rowR + rowR : i < j ? rowR + colR + 's' : colR + rowR + 'o';
          return (
            <div key={key} title={`${label}: ${count} hand${count !== 1 ? 's' : ''}`}
              className={`range-cell${count > 0 ? ' played' : ''}`}
              style={{ background: cellBg(count, maxCount), opacity: count > 0 ? 0.35 + 0.65 * Math.sqrt(count / maxCount) : undefined }}>
              {label}
            </div>
          );
        }))}
      </div>
      <div className="range-legend">
        {maxCount <= 10 ? (
          <div className="range-legend-steps">
            <div className="range-step">
              <div className="range-swatch" style={{ background: '#1e2035' }} />
              <span>0</span>
            </div>
            {Array.from({ length: maxCount }, (_, i) => (
              <div key={i + 1} className="range-step">
                <div className="range-swatch" style={{ background: cellBg(i + 1, maxCount) }} />
                <span>{i + 1}</span>
              </div>
            ))}
            <span className="range-legend-caption">times played</span>
          </div>
        ) : (
          <div className="range-legend-bar">
            <span className="range-legend-label">0</span>
            <div className="range-legend-gradient" />
            <span className="range-legend-label">{maxCount}</span>
            <span className="range-legend-caption">times played</span>
          </div>
        )}
        <p className="range-legend-help">
          Suited upper-right · pairs diagonal · offsuit lower-left
        </p>
      </div>
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
const CL_SEVERITY  = ['', '', '', '⚔️', '⚔️', '⚔️⚔️', '⚔️⚔️', '⚔️⚔️⚔️', '⚔️⚔️⚔️', '⚔️⚔️⚔️⚔️'];

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
export default function PlayerDetail({ player: p, isMerged = false, isViewer = false, handActionLogs = {} }) {
  const [showRadarInfo, setShowRadarInfo] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [handFilter, setHandFilter] = useState('all');
  const [expandedHand, setExpandedHand] = useState(null);
  const [detailMode, setDetailMode] = useState(false);
  const [sortCol, setSortCol] = useState('hand');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCol, setSearchCol] = useState('all');

  // Look up the action log for a hand entry. New sessions store logs in the
  // top-level handActionLogs map (keyed as `${sessionId}_${num}` when a sessionId
  // is available, plain `num` for un-merged single-session data). Old sessions
  // (pre-this-change) stored actionLog inline — fall back to that if present.
  function getActionLog(entry) {
    const key = entry.sessionId ? `${entry.sessionId}_${entry.num}` : entry.num;
    return handActionLogs[key] ?? entry.actionLog ?? [];
  }

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

  // Bad beats, suck-outs & coolers
  const badBeats = [...(p.badBeats || [])].sort((a, b) => b.myHandRank - a.myHandRank);
  const suckOuts = [...(p.suckOuts || [])].sort((a, b) => b.oppHandRank - a.oppHandRank);
  const coolers = [...(p.coolers || [])].sort((a, b) => {
    const rA = Math.min(a.myHandRank, a.oppHandRank), rB = Math.min(b.myHandRank, b.oppHandRank);
    return rB - rA || b.potSize - a.potSize;
  });
  const ominousMsg   = OMINOUS[   (p.name.charCodeAt(0) || 0) % OMINOUS.length];
  const suckOutEmpty = SUCKOUT_NONE[(p.name.charCodeAt(0) || 0) % SUCKOUT_NONE.length];

  // Derived key-hands (not stored — computed at render)
  const biggestWins = [...handsHistory]
    .filter(h => h.won && h.potSize > 0)
    .sort((a, b) => b.potSize - a.potSize)
    .slice(0, 5);
  const biggestLosses = [...handsHistory]
    .filter(h => h.wasShown && !h.won && h.potSize > 0)
    .sort((a, b) => b.potSize - a.potSize)
    .slice(0, 5);
  const premiumShowdowns = handsHistory
    .filter(h => (h.wasShown || h.won) && isPremiumHand(h.c1, h.c2));
  const premiumRecord = {};
  for (const h of premiumShowdowns) {
    const lbl = premiumLabel(h.c1, h.c2);
    if (!premiumRecord[lbl]) premiumRecord[lbl] = { wins: 0, losses: 0 };
    if (h.won) premiumRecord[lbl].wins++; else premiumRecord[lbl].losses++;
  }

  // Hand history filters
  const FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'showdowns', label: 'Showdowns' },
    { key: 'wins',      label: 'Wins' },
    { key: 'losses',    label: 'Losses' },
    { key: 'badbeats',  label: 'Bad Beats' },
    { key: 'suckouts',  label: 'Suck-Outs' },
    { key: 'coolers',   label: 'Coolers' },
  ];

  function filterCount(key) {
    if (key === 'all')       return handsHistory.length;
    if (key === 'showdowns') return handsHistory.filter(h => h.wasShown).length;
    if (key === 'wins')      return handsHistory.filter(h => h.won).length;
    if (key === 'losses')    return handsHistory.filter(h => h.wasShown && !h.won).length;
    if (key === 'badbeats')  return handsHistory.filter(h => h.isBadBeat).length;
    if (key === 'suckouts')  return handsHistory.filter(h => h.isSuckOut).length;
    if (key === 'coolers')   return handsHistory.filter(h => h.isCooler).length;
    return 0;
  }

  // Sort handler
  function handleSortClick(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'hand' || col === 'strength' || col === 'pot' ? 'desc' : 'asc'); }
  }

  // Sortable column header
  function SortTh({ col, children, style }) {
    const active = sortCol === col;
    return (
      <th onClick={() => handleSortClick(col)} className={`sortable${active ? ' sort-active' : ''}`} style={style}>
        {children} <span style={{opacity:0.5,fontSize:'0.7em'}}>{active ? (sortDir==='asc' ? '↑' : '↓') : '↕'}</span>
      </th>
    );
  }

  // Filtered + sorted hand list
  const filteredHands = (() => {
    let result = handsHistory.filter(h => {
      if (handFilter === 'showdowns') return h.wasShown;
      if (handFilter === 'wins')      return h.won;
      if (handFilter === 'losses')    return h.wasShown && !h.won;
      if (handFilter === 'badbeats')  return h.isBadBeat;
      if (handFilter === 'suckouts')  return h.isSuckOut;
      if (handFilter === 'coolers')   return h.isCooler;
      return true;
    });
    if (searchQuery.trim()) result = result.filter(h => matchesSearch(h, searchQuery, searchCol));
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'hand')    cmp = ((a.sessionDate||'').localeCompare(b.sessionDate||'')) || a.num - b.num;
      else if (sortCol === 'pot')     cmp = (a.potSize||0) - (b.potSize||0);
      else if (sortCol === 'cards')   cmp = handStrength(a.c1, a.c2) - handStrength(b.c1, b.c2);
      else if (sortCol === 'type')    cmp = categoryLabel(a.c1, a.c2).localeCompare(categoryLabel(b.c1, b.c2));
      else if (sortCol === 'session') cmp = (a.sessionDate||'').localeCompare(b.sessionDate||'');
      else if (sortCol === 'result') {
        const rk = h => h.isCooler ? 5 : h.isBadBeat ? 4 : h.isSuckOut ? 3 : h.won ? 2 : h.wasShown ? 1 : 0;
        cmp = rk(a) - rk(b);
      }
      else if (sortCol === 'strength') {
        cmp = (computeHandStrength(a)?.rank ?? -1) - (computeHandStrength(b)?.rank ?? -1);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  })();

  return (
    <div className="player-detail">
      {/* Header row with name + detail mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, flex: 1 }}>{p.name}</h2>
        <button
          className={`detail-toggle-btn${detailMode ? ' active' : ''}`}
          onClick={() => setDetailMode(d => !d)}
        >
          {detailMode ? 'Simple View' : 'Detailed Mode'}
        </button>
      </div>
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
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} outerRadius={80} cy="55%">
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

        {/* Hand categories — pie chart of shown/known hands */}
        {catData.length > 0 && (
          <div className="chart-card">
            <h3 style={{ margin: '0 0 8px' }}>Hand Categories (shown/known)</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginBottom: 6 }}>
              Click a slice or legend item to see all hands in that category.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 24, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={catData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
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
          </div>
        )}

        {/* Preflop range grid (independent card now — used to share a toggle with the pie) */}
        {hasRange && (
          <div className="chart-card">
            <h3 style={{ margin: '0 0 8px' }}>Preflop Range Grid</h3>
            <RangeGrid rangeHands={p.rangeHands || []} />
          </div>
        )}
      </div>

      {/* ── Coaching report (shown for every player; depth scales with how many
           hole cards we know — full for the viewer, showdowns-only for others) ── */}
      <CoachingReport player={p} isMerged={isMerged} isViewer={isViewer} />

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
                      {isMerged && <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{fmtDate(h.sessionDate)}</td>}
                      <td><CardBadge card={h.c1} /><CardBadge card={h.c2} /></td>
                      <td>
                        {h.isCooler
                          ? <span className="result-badge cooler">⚔️ Cooler</span>
                          : h.isBadBeat
                            ? <span className="result-badge bad-beat">💔 Bad Beat</span>
                            : h.isSuckOut
                              ? <span className="result-badge suck-out">🎲 Suck-Out</span>
                              : h.won
                                ? <span className="result-badge win">✓ Won</span>
                                : h.wasShown
                                  ? <span className="result-badge loss">✗ Lost</span>
                                  : <span className="result-badge fold">Folded</span>}
                      </td>
                      <td><BoardCards board={h.board} /></td>
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

      {/* ── Biggest Pots Won ────────────────────────────────────────────────── */}
      {biggestWins.length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 20 }}>
            💰 Biggest Pots Won
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
              — top {biggestWins.length} by pot size
            </span>
          </div>
          <div className="big-pot-list">
            {biggestWins.map((h, i) => (
              <div key={i} className="big-pot-card win">
                <div className="bp-rank">#{i + 1}</div>
                <div className="bp-body">
                  <div className="bp-header">
                    <span className="bp-num">Hand #{h.num}{isMerged && h.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(h.sessionDate)})</span>}</span>
                    <span className="bp-amount pos">Won {(h.wonAmount ?? h.potSize).toLocaleString()}</span>
                  </div>
                  <div className="bp-details">
                    {h.c1 && h.c2 ? <><CardBadge card={h.c1} /><CardBadge card={h.c2} /></> : <span className="mucked-cards">?? ??</span>}
                    {h.board?.length > 0 && <span style={{ marginLeft: 8 }}><BoardCards board={h.board} /></span>}
                    {h.myHandName && <span style={{ color: 'var(--muted)', fontSize: '0.78rem', marginLeft: 8 }}>{h.myHandName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Biggest Pots Lost ────────────────────────────────────────────────── */}
      {biggestLosses.length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>
            📉 Biggest Pots Lost
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
              — top {biggestLosses.length} showdown losses by pot size
            </span>
          </div>
          <div className="big-pot-list">
            {biggestLosses.map((h, i) => (
              <div key={i} className="big-pot-card loss">
                <div className="bp-rank">#{i + 1}</div>
                <div className="bp-body">
                  <div className="bp-header">
                    <span className="bp-num">Hand #{h.num}{isMerged && h.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(h.sessionDate)})</span>}</span>
                    <span className="bp-amount neg">Lost {h.potSize.toLocaleString()}</span>
                  </div>
                  <div className="bp-details">
                    {h.c1 && h.c2 ? <><CardBadge card={h.c1} /><CardBadge card={h.c2} /></> : <span className="mucked-cards">?? ??</span>}
                    {h.board?.length > 0 && <span style={{ marginLeft: 8 }}><BoardCards board={h.board} /></span>}
                    {h.myHandName && <span style={{ color: 'var(--muted)', fontSize: '0.78rem', marginLeft: 8 }}>{h.myHandName}</span>}
                    {h.winnerHandName && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 4 }}>vs {h.winnerHandName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Premium Showdowns ────────────────────────────────────────────────── */}
      {premiumShowdowns.length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>
            👑 Premium Showdowns
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
              — AA/KK/QQ/AKs at showdown
            </span>
          </div>
          <div className="premium-summary">
            {Object.entries(premiumRecord).map(([lbl, rec]) => (
              <span key={lbl} className="premium-tag">
                {lbl}: <span className="pos">{rec.wins}W</span>–<span className="neg">{rec.losses}L</span>
              </span>
            ))}
          </div>
          <div className="big-pot-list">
            {premiumShowdowns.map((h, i) => (
              <div key={i} className={`big-pot-card ${h.won ? 'win' : 'loss'}`}>
                <div className="bp-body">
                  <div className="bp-header">
                    <span className="bp-num">Hand #{h.num}{isMerged && h.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(h.sessionDate)})</span>}</span>
                    <span className={`bp-amount ${h.won ? 'pos' : 'neg'}`}>
                      {h.won ? `Won ${(h.wonAmount ?? h.potSize).toLocaleString()}` : `Lost ${h.potSize.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="bp-details">
                    <CardBadge card={h.c1} /><CardBadge card={h.c2} />
                    {h.board?.length > 0 && <span style={{ marginLeft: 8 }}><BoardCards board={h.board} /></span>}
                    {h.myHandName && <span style={{ color: 'var(--muted)', fontSize: '0.78rem', marginLeft: 8 }}>{h.myHandName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
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
                <span className="bb-num">Hand #{so.num}{isMerged && so.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(so.sessionDate)})</span>}</span>
                <span className="bb-severity">{SO_SEVERITY[so.oppHandRank] || ''}</span>
                <span className="bb-pot pos">Won {(so.wonAmount ?? so.potSize).toLocaleString()}</span>
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
              {so.board?.length > 0 && (
                <div className="bb-board">
                  <span className="bb-board-label">Board: </span>
                  <BoardCards board={so.board} />
                </div>
              )}
              {detailMode && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Play by Play</div>
                  <ActionLog log={getActionLog(so)}/>
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
                <span className="bb-num">Hand #{bb.num}{isMerged && bb.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(bb.sessionDate)})</span>}</span>
                <span className="bb-severity">{BB_SEVERITY[bb.myHandRank] || ''}</span>
                <span className="bb-pot neg">Lost {bb.potSize.toLocaleString()}</span>
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
              {bb.board?.length > 0 && (
                <div className="bb-board">
                  <span className="bb-board-label">Board: </span>
                  <BoardCards board={bb.board} />
                </div>
              )}
              {detailMode && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Play by Play</div>
                  <ActionLog log={getActionLog(bb)}/>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Coolers ──────────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>
        ⚔️ Coolers
        {coolers.length > 0 && (
          <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.78rem', marginLeft: 8 }}>
            — both players had strong hands, sorted by combined strength
          </span>
        )}
      </div>

      {coolers.length === 0 ? (
        <div className="bad-beat-empty" style={{ borderColor: 'rgba(108,99,255,0.15)' }}>No coolers detected. No unavoidable collisions yet.</div>
      ) : (
        <div className="bad-beat-list">
          {coolers.map((c, i) => (
            <div key={i} className="bad-beat-card cooler-card">
              <div className="bb-header">
                <span className="bb-num">Hand #{c.num}{isMerged && c.sessionDate && <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>({fmtDate(c.sessionDate)})</span>}</span>
                <span className="bb-severity">{CL_SEVERITY[Math.min(c.myHandRank, c.oppHandRank)] || ''}</span>
                <span className={`bb-pot ${c.won ? 'pos' : 'neg'}`}>
                  {c.won ? `Won ${c.potSize.toLocaleString()}` : `Lost ${c.potSize.toLocaleString()}`}
                </span>
              </div>
              <div className="bb-body">
                <div className="bb-side">
                  <div className="bb-label">Your Hand</div>
                  <div className="bb-cards"><CardBadge card={c.c1} /><CardBadge card={c.c2} /></div>
                  <div className="bb-hand-name" style={{ color: c.won ? 'var(--win)' : 'var(--lose)' }}>{c.myHandName}</div>
                </div>
                <div className="bb-vs" style={{ borderColor: 'rgba(108,99,255,0.3)', color: 'var(--accent)' }}>
                  {c.won ? 'BEAT' : 'LOST TO'}
                </div>
                <div className="bb-side">
                  <div className="bb-label">{c.oppName}</div>
                  <div className="bb-cards"><CardBadge card={c.oppC1} /><CardBadge card={c.oppC2} /></div>
                  <div className="bb-hand-name" style={{ color: 'var(--muted)' }}>{c.oppHandName}</div>
                </div>
              </div>
              {c.board?.length > 0 && (
                <div className="bb-board">
                  <span className="bb-board-label">Board: </span>
                  <BoardCards board={c.board} />
                </div>
              )}
              {detailMode && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Play by Play</div>
                  <ActionLog log={getActionLog(c)}/>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Hand History ──────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ fontSize: '0.9rem', marginTop: 16 }}>Hand History</div>

      {/* Search bar */}
      <div className="search-row">
        <input
          className="search-input"
          type="text"
          placeholder="Search hands…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select className="search-col-select" value={searchCol} onChange={e => setSearchCol(e.target.value)}>
          <option value="all">All columns</option>
          <option value="hand">Hand #</option>
          <option value="cards">Cards</option>
          <option value="type">Type</option>
          {isMerged && <option value="session">Session</option>}
          <option value="result">Result</option>
          <option value="pot">Pot</option>
          <option value="strength">Hand Strength</option>
        </select>
      </div>

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
                <SortTh col="hand">Hand #</SortTh>
                {isMerged && <SortTh col="session">Session</SortTh>}
                <SortTh col="cards">Cards</SortTh>
                <SortTh col="type">Type</SortTh>
                <SortTh col="result">Result</SortTh>
                <SortTh col="strength">Hand Strength</SortTh>
                <SortTh col="pot">Pot</SortTh>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredHands.flatMap(h => {
                const rowKey = h.sessionId ? `${h.sessionId}-${h.num}` : String(h.num);
                const isExp = expandedHand === rowKey;
                const hasCards = h.c1 && h.c2;
                const rows = [
                  <tr key={rowKey}
                    className={`hand-row ${h.isCooler ? 'cooler-row' : h.isBadBeat ? 'bad-beat-row' : ''} ${h.isSuckOut && !h.isBadBeat && !h.isCooler ? 'suck-out-row' : ''} ${h.won && !h.isBadBeat && !h.isSuckOut && !h.isCooler ? 'won' : ''}`}
                    onClick={() => setExpandedHand(isExp ? null : rowKey)}
                    style={{ cursor: 'pointer' }}>
                    <td>#{h.num}</td>
                    {isMerged && <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{fmtDate(h.sessionDate)}</td>}
                    <td>
                      {hasCards
                        ? <><CardBadge card={h.c1} /><CardBadge card={h.c2} /></>
                        : <span className="mucked-cards">?? ??</span>}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {hasCards ? categoryLabel(h.c1, h.c2) : '—'}
                    </td>
                    <td>
                      {h.isCooler
                        ? <span className="result-badge cooler">⚔️ Cooler</span>
                        : h.isBadBeat
                          ? <span className="result-badge bad-beat">💔 Bad Beat</span>
                          : h.isSuckOut
                            ? <span className="result-badge suck-out">🎲 Suck-Out</span>
                            : h.won
                              ? <span className="result-badge win">✓ Won</span>
                              : h.wasShown
                                ? <span className="result-badge loss">✗ Lost</span>
                                : <span className="result-badge fold">Folded</span>}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {computeHandStrength(h)?.name ?? '—'}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                      {h.potSize > 0 ? h.potSize.toLocaleString() : '—'}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{isExp ? '▲' : '▼'}</td>
                  </tr>,
                ];

                if (isExp) {
                  rows.push(
                    <tr key={`${rowKey}-exp`} className="hand-expanded-row">
                      <td colSpan={6 + (isMerged ? 1 : 0) + 1} style={{ padding: 0 }}>
                        <div className="hand-detail-panel">
                          {h.board?.length > 0 && (
                            <div className="hd-row">
                              <span className="hd-label">Board</span>
                              <div className="hd-cards">
                                <BoardCards board={h.board} />
                              </div>
                            </div>
                          )}
                          {h.opponents?.length > 0 && (
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
                          {detailMode && (h.dealer || h.sb || h.bb) && (
                            <div className="hd-row">
                              <span className="hd-label">Roles</span>
                              <span style={{fontSize:'0.8rem'}}>
                                {h.dealer && <><>D: </><strong>{h.dealer}</strong>&nbsp;&nbsp;</>}
                                {h.sb && <><>SB: </><strong>{h.sb}</strong>&nbsp;&nbsp;</>}
                                {h.bb && <><>BB: </><strong>{h.bb}</strong></>}
                              </span>
                            </div>
                          )}
                          {detailMode && (
                            <div className="hd-row" style={{flexDirection:'column',gap:4}}>
                              <span className="hd-label">Play by Play</span>
                              <ActionLog log={getActionLog(h)}/>
                            </div>
                          )}
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
