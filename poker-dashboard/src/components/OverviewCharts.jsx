import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#a29bfe','#55efc4','#fdcb6e','#e17055','#74b9ff'];

// Deterministic per-player swatch (same scheme as Dashboard hero avatars).
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}
function initialsOf(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Custom CSS quadrant chart (replaces Recharts ScatterChart, which crashes under
// React 19 + Recharts 3 because Scatter passes a string to a path's `style` prop).
function StyleQuadrants({ players }) {
  // Map VPIP (0-100) → x %, AF (0-10 capped) → inverted y % so high AF is at top.
  // Use logical axis margins so dots near 0 / 100 stay inside the bounds.
  const VPIP_MAX = 100, AF_MAX = 10;
  const dots = players.map(p => {
    const af = Math.min(p.af, AF_MAX);
    const x = (p.vpip / VPIP_MAX) * 100;
    const y = 100 - (af / AF_MAX) * 100;
    return { ...p, x, y, color: colorFor(p.name) };
  });
  return (
    <div className="quadrant-wrap">
      <div className="quadrant-chart">
        {/* Quadrant labels */}
        <div className="quad-label tl">Tight-Aggressive (TAG)</div>
        <div className="quad-label tr">Loose-Aggressive (LAG)</div>
        <div className="quad-label bl">Tight-Passive (Rock)</div>
        <div className="quad-label br">Loose-Passive (Calling Station)</div>
        {/* Crosshair lines at VPIP=25 and AF=2 */}
        <div className="quad-line v" style={{ left: '25%' }} />
        <div className="quad-line h" style={{ top: `${100 - (2 / AF_MAX) * 100}%` }} />
        {/* Dots */}
        {dots.map(d => (
          <div
            key={d.name}
            className="quad-dot"
            style={{ left: `${d.x}%`, top: `${d.y}%`, background: d.color }}
            title={`${d.name} · VPIP ${d.vpip}% · AF ${d.af}`}
          >
            <span className="quad-initials">{initialsOf(d.name)}</span>
            <span className="quad-name">{d.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
      <div className="quad-axes">
        <span>VPIP % →</span>
        <span style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-90deg)', transformOrigin: 'left top', marginLeft: -4 }}>← AF</span>
      </div>
    </div>
  );
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill || p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(p.value % 1 === 0 ? 0 : 1) : p.value}
        </div>
      ))}
    </div>
  );
};

function classifyStyle(vpip, af) {
  const loose = vpip >= 25;
  const aggressive = af >= 2;
  if (loose && aggressive)  return 'Loose-Aggressive (LAG)';
  if (loose && !aggressive) return 'Loose-Passive (Calling Station)';
  if (!loose && aggressive) return 'Tight-Aggressive (TAG)';
  return 'Tight-Passive (Rock)';
}

export default function OverviewCharts({ players }) {
  // Only players with ≥3 hands dealt for charts
  const active = players.filter(p => p.handsDealt >= 3);

  const netData = [...active].sort((a,b) => b.netChips - a.netChips).map(p => ({
    name: p.name,
    'Net Chips': p.netChips,
  }));

  const vpipData = [...active].sort((a,b) => b.vpip - a.vpip).map(p => ({
    name: p.name,
    VPIP: p.vpip,
  }));

  const pfrData = [...active].sort((a,b) => b.pfr - a.pfr).map(p => ({
    name: p.name,
    PFR: p.pfr,
  }));

  const afData = [...active].sort((a,b) => b.af - a.af).map(p => ({
    name: p.name,
    'Agg Factor': Math.min(p.af, 10),
  }));

  const winData = [...active].sort((a,b) => b.winRate - a.winRate).map(p => ({
    name: p.name,
    'Win %': p.winRate,
  }));

  const scatterData = active.map(p => ({
    name: p.name,
    vpip: p.vpip,
    af: Math.min(p.af, 10),
    style: classifyStyle(p.vpip, p.af),
  }));

  return (
    <div className="charts-grid">
      {/* 1. Net Chips */}
      <div className="chart-card">
        <h3>Net Chips by Player</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={netData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="Net Chips" radius={[4,4,0,0]}>
              {netData.map((d, i) => (
                <Cell key={i} fill={d['Net Chips'] >= 0 ? '#00d4aa' : '#ff4d6d'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. VPIP */}
      <div className="chart-card">
        <h3>VPIP % — Looseness</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={vpipData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="VPIP" fill="#6c63ff" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 6 }}>
          % of hands voluntarily entered preflop. &lt;20 tight · 20–50 semi · &gt;50 loose.
        </p>
      </div>

      {/* 3. PFR */}
      <div className="chart-card">
        <h3>PFR % — Preflop Aggression</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={pfrData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="PFR" fill="#00d4aa" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 6 }}>
          % of hands raised preflop. Always ≤ VPIP. Gap = passive entries (limps/cold-calls).
        </p>
      </div>

      {/* 4. Aggression Factor */}
      <div className="chart-card">
        <h3>Aggression Factor</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={afData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="Agg Factor" radius={[4,4,0,0]}>
              {afData.map((d, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 6 }}>
          (Bets+Raises) ÷ Calls · capped at 10 for display
        </p>
      </div>

      {/* 5. Win Rate */}
      <div className="chart-card">
        <h3>Win Rate %</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={winData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="Win %" fill="#ffd166" radius={[4,4,0,0]}>
              {winData.map((d, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 6 }}>
          % of dealt hands the player collected the pot.
        </p>
      </div>

      {/* 6. Playing Style quadrants (custom CSS chart — see component comment) */}
      <div className="chart-card">
        <h3>Playing Style Quadrants</h3>
        <StyleQuadrants players={scatterData} />
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 8 }}>
          Crosshairs at VPIP=25 and AF=2. Dot color matches the player&apos;s avatar elsewhere on the page.
        </p>
      </div>
    </div>
  );
}
