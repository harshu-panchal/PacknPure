const STORAGE_KEY = "pickup_offline_queue_v1";

export function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function enqueueOfflineAction(action) {
  const items = loadOfflineQueue();
  items.push({ ...action, id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, at: Date.now() });
  saveOfflineQueue(items);
  return items;
}

export function dequeueOfflineAction(id) {
  const items = loadOfflineQueue().filter((i) => i.id !== id);
  saveOfflineQueue(items);
  return items;
}
