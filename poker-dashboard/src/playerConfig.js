const KEY = 'poker-player-config';

/**
 * Config shape:
 * {
 *   viewer: "Will",           // canonical name of "me" (null if unset)
 *   aliases: {                // raw CSV name → canonical display name
 *     "William": "Will",
 *     "Will H": "Will"
 *   },
 *   hidden: ["Bot"]           // canonical names to exclude from views
 * }
 */

export function loadPlayerConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePlayerConfig(config) {
  localStorage.setItem(KEY, JSON.stringify(config));
}

/** Resolve a raw CSV name to its canonical display name. */
export function resolveAlias(rawName, config) {
  if (!config?.aliases) return rawName;
  return config.aliases[rawName] || rawName;
}

/** Get all unique canonical player names across all sessions. */
export function getAllCanonicalPlayers(sessions, config) {
  const names = new Set();
  for (const s of sessions) {
    for (const name of (s.playerNames || [])) {
      names.add(resolveAlias(name, config));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Get all raw aliases that map to a given canonical name. */
export function getAliasesFor(canonicalName, config) {
  if (!config?.aliases) return [];
  return Object.entries(config.aliases)
    .filter(([, canonical]) => canonical === canonicalName)
    .map(([raw]) => raw);
}

/** Check if a canonical name is the viewer. */
export function isViewer(canonicalName, config) {
  return config?.viewer === canonicalName;
}

/** Check if a canonical name is hidden. */
export function isHidden(canonicalName, config) {
  return (config?.hidden || []).includes(canonicalName);
}
