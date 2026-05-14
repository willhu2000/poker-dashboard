import { useState, useEffect } from 'react';
import './index.css';
import { parseLog, extractGameDate, extractPlayerNames, formatSessionName, hashContent } from './parser.js';
import { analyseLog } from './stats.js';
import { loadSessions, saveSession, deleteSession, mergeSessions, isDuplicate } from './sessions.js';
import Dashboard from './components/Dashboard.jsx';
import SessionsHome from './components/SessionsHome.jsx';
import TrendsView from './components/TrendsView.jsx';
import ViewerPickerModal from './components/ViewerPickerModal.jsx';

// Auto-loaded sample logs (placed in /public). Loaded once on first launch
// when localStorage has no sessions yet.
const AUTO_LOAD_LOGS = ['/log1.csv', '/log2.csv'];

export default function App() {
  const [sessions, setSessions] = useState(() => loadSessions());
  const [view, setView] = useState(null); // null | { type:'single', id } | { type:'merged', selectedIds:[] }
  const [error, setError] = useState(null);
  // Pending upload waiting for viewer-name selection. Set after a CSV is read
  // and parsed; cleared after the user picks a player (or cancels).
  // Shape: { fileName, rows, gameDate, hash, playerNames, openOnSave: bool }
  const [pendingUpload, setPendingUpload] = useState(null);

  // On first launch (no saved sessions), auto-ingest the bundled CSVs.
  useEffect(() => {
    if (loadSessions().length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        for (const url of AUTO_LOAD_LOGS) {
          const res = await fetch(url);
          if (!res.ok) continue;
          const text = await res.text();
          const hash = hashContent(text);
          if (isDuplicate(hash)) continue;
          const rows = parseLog(text);
          const gameDate = extractGameDate(rows) || new Date();
          // Bundled samples are Will's — let analyseLog use its built-in
          // "will*" heuristic by passing no explicit viewerName.
          const stats = analyseLog(rows);
          const sessionName = formatSessionName(gameDate);
          const viewer = Object.keys(stats.players).find(n => n.toLowerCase().startsWith('will')) || null;
          saveSession(sessionName, stats, gameDate, hash, viewer);
        }
        if (!cancelled) setSessions(loadSessions());
      } catch (err) {
        console.error('Auto-load failed', err);
        if (!cancelled) setError('Auto-load failed: ' + err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function refresh() {
    setSessions(loadSessions());
  }

  // Step 1: read + parse the file, then queue it for viewer selection.
  // `openOnSave` controls whether the new session auto-opens after save —
  // true from the empty-state / sessions list, false from "Add Session" in
  // the dashboard (which stays on the current view).
  function stageFile(file, { openOnSave }) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const hash = hashContent(text);
        if (isDuplicate(hash)) throw new Error('This file has already been uploaded.');
        const rows = parseLog(text);
        const gameDate = extractGameDate(rows) || new Date();
        const playerNames = extractPlayerNames(rows);
        const sessionName = formatSessionName(gameDate);
        setError(null);
        setPendingUpload({ fileName: sessionName, rows, gameDate, hash, playerNames, openOnSave });
      } catch (err) {
        console.error(err);
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Step 2: the user picked their name in the modal — run analyseLog with
  // that name, persist the session, and (optionally) navigate to it.
  function handleViewerPicked(viewerName) {
    if (!pendingUpload) return;
    try {
      const { fileName, rows, gameDate, hash, openOnSave } = pendingUpload;
      const stats = analyseLog(rows, viewerName);
      const id = saveSession(fileName, stats, gameDate, hash, viewerName);
      setPendingUpload(null);
      refresh();
      if (openOnSave) setView({ type: 'single', id });
    } catch (err) {
      console.error(err);
      setError('Failed to save session: ' + err.message);
      setPendingUpload(null);
    }
  }

  function handleNewFile(file) {
    stageFile(file, { openOnSave: true });
  }

  function handleAddSession(file) {
    stageFile(file, { openOnSave: false });
  }

  function handleDelete(id) {
    deleteSession(id);
    refresh();
    if (view?.id === id) setView(null);
  }

  const modal = pendingUpload && (
    <ViewerPickerModal
      fileName={pendingUpload.fileName}
      playerNames={pendingUpload.playerNames}
      onConfirm={handleViewerPicked}
      onCancel={() => setPendingUpload(null)}
    />
  );

  if (view?.type === 'trends') {
    const currentSessions = loadSessions();
    return (
      <div className="app">
        <TrendsView sessions={currentSessions} onBack={() => setView(null)} />
        {modal}
      </div>
    );
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
          onViewTrends={() => setView({ type: 'trends' })}
          onUpdateSessions={(ids) => setView({ type: 'merged', selectedIds: ids })}
          onAddSession={handleAddSession}
          error={error}
        />
        {modal}
      </div>
    );
  }

  return (
    <div className="app">
      <SessionsHome
        sessions={sessions}
        onView={(id) => setView({ type: 'single', id })}
        onViewMerged={() => setView({ type: 'merged', selectedIds: sessions.map(s => s.id) })}
        onViewTrends={() => setView({ type: 'trends' })}
        onDelete={handleDelete}
        onNewFile={handleNewFile}
        error={error}
      />
      {modal}
    </div>
  );
}
