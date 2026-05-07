import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, Legend,
} from 'recharts';

const COLORS = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#a29bfe','#55efc4','#fdcb6e','#e17055'];

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

export default function OverviewCharts({ players }) {
  // Only players with ≥3 hands dealt for charts
  const active = players.filter(p => p.handsDealt >= 3);

  // Net chips bar data
  const netData = [...active].sort((a,b) => b.netChips - a.netChips).map(p => ({
    name: p.name.split(' ')[0],
    'Net Chips': p.netChips,
  }));

  // VPIP vs PFR
  const vpipData = active.map(p => ({
    name: p.name.split(' ')[0],
    VPIP: p.vpip,
    PFR: p.pfr,
  }));

  // Preflop fold %
  const foldData = [...active]
    .sort((a,b) => b.preflopFoldPct - a.preflopFoldPct)
    .map(p => ({
      name: p.name.split(' ')[0],
      'Fold %': p.preflopFoldPct,
    }));

  // Aggression factor
  const afData = [...active].sort((a,b) => b.af - a.af).map(p => ({
    name: p.name.split(' ')[0],
    'Agg Factor': Math.min(p.af, 10),
  }));

  return (
    <div className="charts-grid">
      {/* Net Chips */}
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

      {/* VPIP vs PFR */}
      <div className="chart-card">
        <h3>VPIP vs PFR (%)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={vpipData} margin={{ top: 0, right: 10, left: -10, bottom: 55 }}>
            <XAxis dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} height={55} />
            <YAxis tick={{ fill: '#7c82a0', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip content={<Tip />} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ color: '#7c82a0', fontSize: 12, paddingBottom: 8 }} />
            <Bar dataKey="VPIP" fill="#6c63ff" radius={[3,3,0,0]} />
            <Bar dataKey="PFR" fill="#00d4aa" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Preflop Fold % */}
      <div className="chart-card">
        <h3>Preflop Fold %</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={foldData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#7c82a0', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#7c82a0', fontSize: 11 }} width={130} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="Fold %" fill="#ffd166" radius={[0,4,4,0]}>
              {foldData.map((d, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Aggression Factor */}
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
    </div>
  );
}
