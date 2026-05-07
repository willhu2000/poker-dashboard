import { useState, useCallback } from 'react';
import './index.css';
import { parseLog } from './parser.js';
import { analyseLog } from './stats.js';
import { loadSessions, saveSession, deleteSession, mergeSessions } from './sessions.js';
import Dashboard from './components/Dashboard.jsx';
import SessionsHome from './components/SessionsHome.jsx';

export default function App() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [view, setView] = useState(null); // null | { type:'single', id } | { type:'merged' }
  const [error, setError] = useState(null);

  function refresh() {
    setSessions(loadSessions());
  }

  function handleNewFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseLog(e.target.result);
        const stats = analyseLog(rows);
        const id = saveSession(file.name, stats);
        refresh();
        setView({ type: 'single', id });
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function handleDelete(id) {
    deleteSession(id);
    refresh();
    if (view?.id === id) setView(null);
  }

  function handleAddSession(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseLog(e.target.result);
        const stats = analyseLog(rows);
        saveSession(file.name, stats);
        refresh();
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  if (view) {
    const currentSessions = loadSessions();
    let data, label;
    if (view.type === 'single') {
      const session = currentSessions.find(s => s.id === view.id);
      if (!session) { setView(null); return null; }
      data = session.stats;
      label = session.fileName;
    } else {
      data = mergeSessions(currentSessions);
      label = `${currentSessions.length} sessions merged`;
    }
    if (!data) { setView(null); return null; }

    return (
      <div className="app">
        <Dashboard
          data={data}
          fileName={label}
          isMerged={view.type === 'merged'}
          sessionCount={currentSessions.length}
          onBack={() => setView(null)}
          onViewMerged={() => setView({ type: 'merged' })}
          onAddSession={handleAddSession}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <SessionsHome
        sessions={sessions}
        onView={(id) => setView({ type: 'single', id })}
        onViewMerged={() => setView({ type: 'merged' })}
        onDelete={handleDelete}
        onNewFile={handleNewFile}
        error={error}
      />
    </div>
  );
}
