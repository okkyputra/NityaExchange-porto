const KEY = 'nitya.swapHistory';
const MAX_ENTRIES = 50;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

export function getSwaps() {
  return read();
}

export function addSwap(entry) {
  const entries = read();
  const next = [
    { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ...entries,
  ].slice(0, MAX_ENTRIES);
  write(next);
  return next;
}

export function clearHistory() {
  write([]);
}

export function removeSwap(id) {
  write(read().filter((e) => e.id !== id));
}
