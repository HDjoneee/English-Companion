import type { Issue, StoredSession } from "../types";

const SESSION_KEY = "ai-speaking-coach:sessions";
const FAVORITE_KEY = "ai-speaking-coach:favorites";
const MISTAKE_KEY = "ai-speaking-coach:mistakes";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadSessions() {
  return readJson<StoredSession[]>(SESSION_KEY, []);
}

export function saveSession(session: StoredSession) {
  const sessions = loadSessions().filter((item) => item.id !== session.id);
  writeJson(SESSION_KEY, [session, ...sessions].slice(0, 24));
}

export function deleteSession(id: string) {
  writeJson(
    SESSION_KEY,
    loadSessions().filter((session) => session.id !== id)
  );
}

export function loadFavorites() {
  return readJson<string[]>(FAVORITE_KEY, []);
}

export function saveFavorites(ids: string[]) {
  writeJson(FAVORITE_KEY, Array.from(new Set(ids)));
}

export function loadMistakes() {
  return readJson<Issue[]>(MISTAKE_KEY, []);
}

export function addMistakes(issues: Issue[]) {
  const oldItems = loadMistakes();
  const merged = [...issues, ...oldItems].reduce<Issue[]>((acc, issue) => {
    const exists = acc.some((item) => item.title === issue.title && item.original === issue.original);
    if (!exists) acc.push(issue);
    return acc;
  }, []);
  writeJson(MISTAKE_KEY, merged.slice(0, 80));
}

export function clearMistakes() {
  writeJson(MISTAKE_KEY, []);
}
