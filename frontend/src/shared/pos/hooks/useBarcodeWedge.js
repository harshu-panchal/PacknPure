import { useEffect, useRef } from 'react';

/**
 * USB / Bluetooth keyboard-wedge barcode scanner listener.
 * Scanners type characters rapidly and usually end with Enter.
 * Safe alongside the focused search input (that path uses Enter there).
 *
 * @param {object} options
 * @param {boolean} [options.enabled=true]
 * @param {(code: string) => void} options.onScan
 * @param {number} [options.minLength=6]
 * @param {number} [options.idleMs=80]
 */
export function useBarcodeWedge({
  enabled = true,
  onScan,
  minLength = 6,
  idleMs = 80,
} = {}) {
  const bufferRef = useRef('');
  const idleTimerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;

    const clearBuffer = () => {
      bufferRef.current = '';
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const flush = () => {
      const code = bufferRef.current.trim();
      clearBuffer();
      if (code.length >= minLength) {
        onScanRef.current?.(code);
      }
    };

    const isEditableTarget = (target) => {
      if (!target) return false;
      const tag = String(target.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      if (tag === 'INPUT') {
        const type = String(target.type || 'text').toLowerCase();
        // Allow wedge into the dedicated POS search box (handled separately via Enter).
        if (target.dataset?.posBarcodeSearch === 'true') return true;
        return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'hidden'].includes(type);
      }
      return false;
    };

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          event.preventDefault();
          flush();
        } else {
          clearBuffer();
        }
        return;
      }

      if (event.key === 'Escape') {
        clearBuffer();
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(flush, idleMs);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearBuffer();
    };
  }, [enabled, minLength, idleMs]);
}
