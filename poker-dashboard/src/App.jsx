import { useState, useCallback } from 'react';
import './index.css';
import { parseLog, extractGameDate, formatSessionName, hashContent } from './parser.js';
import { analyseLog } from './stats.js';
import { loadSessions, saveSession, deleteSession, mergeSessions, isDuplicate } from './sessions.js';
import Dashboard from './components/Dashboard.jsx';
import SessionsHome from './components/SessionsHome.jsx';

export default function App() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [view, setView] = useState(null); // null | { type:'single', id } | { type:'merged', selectedIds:[] }
  const [error, setError] = useState(null);

  function refresh() {
    setSessions(loadSessions());
  }

  function handleNewFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const hash = hashContent(text);
        if (isDuplicate(hash)) throw new Error('This file has already been uploaded.');
        const rows = parseLog(text);
        const gameDate = extractGameDate(rows) || new Date();
        const stats = analyseLog(rows);
        const sessionName = formatSessionName(gameDate);
        const id = saveSession(sessionName, stats, gameDate, hash);
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
        const text = e.target.result;
        const hash = hashContent(text);
        if (isDuplicate(hash)) throw new Error('This file has already been uploaded.');
        const rows = parseLog(text);
        const gameDate = extractGameDate(rows) || new Date();
        const stats = analyseLog(rows);
        const sessionName = formatSessionName(gameDate);
        saveSession(sessionName, stats, gameDate, hash);
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
    let data, label, selectedIds;
    if (view.type === 'single') {
      const session = currentSessions.find(s => s.id === view.id);
      if (!session) { setView(null); return null; }
      data = session.stats;
      label = session.fileName;
      selectedIds = [view.id];
    } else {
      selectedIds = view.selectedIds && view.selectedIds.length > 0 ? view.selectedIds : currentSessions.map(s => s.id);
      const sessionsToMerge = currentSessions.filter(s => selectedIds.includes(s.id));
      data = mergeSessions(sessionsToMerge);
      label = `${selectedIds.length} of ${currentSessions.length} sessions merged`;
    }
    if (!data) { setView(null); return null; }

    return (
      <div className="app">
        <Dashboard
          data={data}
          fileName={label}
          isMerged={view.type === 'merged'}
          sessionCount={currentSessions.length}
          selectedIds={selectedIds}
          allSessions={currentSessions}
          onBack={() => setView(null)}
          onViewMerged={() => setView({ type: 'merged', selectedIds: currentSessions.map(s => s.id) })}
          onUpdateSessions={(ids) => setView({ type: 'merged', selectedIds: ids })}
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
        onViewMerged={() => setView({ type: 'merged', selectedIds: sessions.map(s => s.id) })}
        onDelete={handleDelete}
        onNewFile={handleNewFile}
        error={error}
      />
    </div>
  );
}
