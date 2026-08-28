/**
 * Vite hashes each build's JS chunk filenames. A tab left open across a new
 * deployment still holds `import()` calls pointing at the OLD hashed
 * filenames, which the server no longer serves — the dynamic import rejects
 * with "Failed to fetch dynamically imported module" (or similar wording
 * across browsers), and that propagates up to the router's errorElement.
 * The fix isn't a real error to show the user — it's just a stale reference
 * that a full reload (fetching the new index.html + current chunk hashes)
 * resolves immediately.
 */
const RELOAD_GUARD_KEY = 'pnp_chunk_reload_attempted';

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return (
    /failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /loading chunk [\w.-]+ failed/i.test(msg)
  );
}

/** Call once the app has successfully booted, so a later deploy can still trigger a fresh auto-reload. */
export function clearChunkReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}

/**
 * Triggers one automatic full reload for a stale-chunk error, guarded so a
 * genuinely broken deployment can't reload-loop forever. Returns true if a
 * reload was kicked off (caller should render nothing while it lands).
 */
export function tryChunkReloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
