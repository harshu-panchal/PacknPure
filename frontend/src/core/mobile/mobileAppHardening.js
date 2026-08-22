/**
 * Mobile / PWA / installed-app interaction hardening.
 * Prevents screen zoom, unwanted rotation shifts, pinch gestures, and page slide bounce.
 */

const LOCKED_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

const HARDEN_CLASS = 'app-mobile-hardened';

function getViewportMeta() {
  return document.querySelector('meta[name="viewport"]');
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    Boolean(window.navigator.standalone)
  );
}

/** True for mobile browser, touch device, mobile viewport, or installed PWA. */
export function shouldHardenMobileApp() {
  if (typeof window === 'undefined') return false;

  if (isStandalonePwa()) return true;

  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const mobileWidth = window.matchMedia('(max-width: 1024px)').matches;

  return coarsePointer || isTouchDevice || mobileUserAgent || mobileWidth;
}

function setViewportContent(content) {
  const meta = getViewportMeta();
  if (meta) meta.setAttribute('content', content);
}

function applyHardening(enabled) {
  const root = document.documentElement;
  setViewportContent(LOCKED_VIEWPORT);
  if (enabled) {
    root.classList.add(HARDEN_CLASS);
  } else {
    root.classList.remove(HARDEN_CLASS);
  }
}

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const el = target.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
  );
  return Boolean(el);
}

/**
 * Mount once at app root. Returns cleanup.
 */
export function initMobileAppHardening() {
  if (typeof window === 'undefined') return () => {};

  const mediaQueries = [
    window.matchMedia('(max-width: 1024px)'),
    window.matchMedia('(hover: none) and (pointer: coarse)'),
    window.matchMedia('(display-mode: standalone)'),
    window.matchMedia('(display-mode: fullscreen)'),
    window.matchMedia('(display-mode: minimal-ui)'),
  ];

  const sync = () => applyHardening(shouldHardenMobileApp());
  sync();

  const onChange = () => sync();
  mediaQueries.forEach((mq) => {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  });

  // Lock horizontal scroll shift on rotation or resize
  const onOrientationOrResize = () => {
    sync();
    if (window.scrollX !== 0) {
      window.scrollTo(0, window.scrollY);
    }
  };
  window.addEventListener('orientationchange', onOrientationOrResize);
  window.addEventListener('resize', onOrientationOrResize);

  // Block gesture zoom on iOS Safari
  const onGesture = (e) => {
    if (!shouldHardenMobileApp()) return;
    e.preventDefault();
  };

  // Block multi-touch pinch zoom
  const onTouchMove = (e) => {
    if (!shouldHardenMobileApp()) return;
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  };

  // Prevent double-tap zoom on non-editable elements
  let lastTouchEnd = 0;
  const onTouchEnd = (e) => {
    if (!shouldHardenMobileApp()) return;
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  };

  // Suppress long-press context menu / callout (not on editable fields)
  const onContextMenu = (e) => {
    if (!shouldHardenMobileApp()) return;
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
  };

  // Block image / link drag ghosts
  const onDragStart = (e) => {
    if (!shouldHardenMobileApp()) return;
    if (isEditableTarget(e.target)) return;
    const t = e.target;
    if (
      t instanceof Element &&
      (t.closest('img') || t.closest('a') || t.tagName === 'IMG' || t.tagName === 'A')
    ) {
      e.preventDefault();
    }
  };

  document.addEventListener('gesturestart', onGesture, { passive: false });
  document.addEventListener('gesturechange', onGesture, { passive: false });
  document.addEventListener('gestureend', onGesture, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('contextmenu', onContextMenu, { passive: false });
  document.addEventListener('dragstart', onDragStart, { passive: false });

  return () => {
    mediaQueries.forEach((mq) => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else if (typeof mq.removeListener === 'function') mq.removeListener(onChange);
    });
    window.removeEventListener('orientationchange', onOrientationOrResize);
    window.removeEventListener('resize', onOrientationOrResize);
    document.removeEventListener('gesturestart', onGesture);
    document.removeEventListener('gesturechange', onGesture);
    document.removeEventListener('gestureend', onGesture);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('dragstart', onDragStart);
  };
}

