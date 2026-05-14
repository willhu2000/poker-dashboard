import { useCallback, useRef } from 'react';
import { hasOutdatedSessions, clearAllSessions } from '../sessions.js';

function fmt(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SessionsHome({ sessions, onView, onViewMerged, onViewTrends, onDelete, onNewFile, error }) {
  const inputRef = useRef(null);
  const draggingRef = useRef(false);

  const handleFiles = useCallback((files) => {
    const file = files[0];
    if (file) onNewFile(file);
  }, [onNewFile]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('over');
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }, []);
  const onDragLeave = useCallback((e) => { e.currentTarget.classList.remove('over'); }, []);

  const hasSessions = sessions.length > 0;

  if (!hasSessions) {
    return (
      <div className="upload-zone">
        <h1>♠ Poker Dashboard</h1>
        <p>Upload a PokerNow hand history CSV to analyse your session.</p>
        <div
          className="drop-area"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current.click()}
        >
          <div className="icon">📁</div>
          <p><strong>Drop your CSV here</strong></p>
          <p>or click to browse</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          Export from PokerNow → Settings → Download CSV
        </p>
      </div>
    );
  }

  return (
    <div className="sessions-page">
      <div className="sessions-header">
        <div>
          <h1>♠ Poker Dashboard</h1>
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Weekly home game tracker</div>
        </div>
      </div>

      <div className="sessions-body">
        {hasOutdatedSessions() && (
          <div className="outdated-banner">
            <div>
              <strong>Some sessions have outdated stats.</strong>{' '}
              Net Chips were computed before the still-seated fix. Re-upload those CSVs (or reset and let the bundled samples re-load) to get correct numbers.
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.82rem' }}
              onClick={() => {
                if (confirm('Reset will delete all stored sessions and reload the bundled samples. Continue?')) {
                  clearAllSessions();
                  location.reload();
                }
              }}
            >
              Reset
            </button>
          </div>
        )}

        {sessions.length >= 2 && (
          <div className="merged-row">
            <button className="merged-session-card" onClick={onViewMerged}>
              <div className="merged-icon">⚡</div>
              <div className="merged-info">
                <div className="merged-title">All Sessions Combined</div>
                <div className="merged-sub">
                  {sessions.length} sessions · {sessions.reduce((n, s) => n + s.handCount, 0)} total hands · view merged stats
                </div>
              </div>
              <div className="merged-arrow">→</div>
            </button>
            <button className="merged-session-card trends" onClick={onViewTrends}>
              <div className="merged-icon">📈</div>
              <div className="merged-info">
                <div className="merged-title">Trends Over Time</div>
                <div className="merged-sub">
                  Compare players session-by-session — are you improving?
                </div>
              </div>
              <div className="merged-arrow">→</div>
            </button>
          </div>
        )}

        <div
          className="drop-area drop-area-compact"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current.click()}
        >
          <span style={{ fontSize: '1.4rem', marginRight: 10 }}>📁</span>
          <span><strong>Drop a new CSV</strong> or click to browse</span>
        </div>
        <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        {error && <p style={{ color: 'var(--red)', marginTop: 8 }}>{error}</p>}

        <div className="sessions-list-header">
          <span>Individual Sessions</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="sessions-list">
          {sessions.map(s => (
            <div key={s.id} className="session-row">
              <div className="session-info">
                <div className="session-name">{s.fileName}</div>
                <div className="session-meta">
                  {fmt(s.uploadedAt)} · {s.handCount} hands · {s.playerNames.length} players
                </div>
                <div className="session-players">
                  {s.playerNames.slice(0, 6).join(', ')}{s.playerNames.length > 6 ? ` +${s.playerNames.length - 6} more` : ''}
                </div>
              </div>
              <div className="session-actions">
                <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => onView(s.id)}>
                  View
                </button>
                <button
                  className="btn"
                  style={{ fontSize: '0.82rem', padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}
                  onClick={() => {
                    if (confirm(`Delete "${s.fileName}"?`)) onDelete(s.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
