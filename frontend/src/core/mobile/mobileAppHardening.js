/**
 * Mobile / PWA / installed-app interaction hardening.
 * Desktop browsers are left untouched (normal zoom, select, copy, context menu).
 */

const MOBILE_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';

const DESKTOP_VIEWPORT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover';

const HARDEN_CLASS = 'app-mobile-hardened';

function getViewportMeta() {
  return document.querySelector('meta[name="viewport"]');
}

function isStandalonePwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari "Add to Home Screen"
    Boolean(window.navigator.standalone)
  );
}

/** True for mobile browser, mobile viewport, or installed PWA — not desktop web. */
export function shouldHardenMobileApp() {
  if (typeof window === 'undefined') return false;

  if (isStandalonePwa()) return true;

  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const mobileWidth = window.matchMedia('(max-width: 767.98px)').matches;

  return coarsePointer || mobileWidth;
}

function setViewportContent(content) {
  const meta = getViewportMeta();
  if (meta) meta.setAttribute('content', content);
}

function applyHardening(enabled) {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add(HARDEN_CLASS);
    setViewportContent(MOBILE_VIEWPORT);
  } else {
    root.classList.remove(HARDEN_CLASS);
    setViewportContent(DESKTOP_VIEWPORT);
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
    window.matchMedia('(max-width: 767.98px)'),
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

  // Block pinch-zoom / multi-touch zoom gestures (iOS Safari + some WebViews)
  const onGesture = (e) => {
    if (!shouldHardenMobileApp()) return;
    e.preventDefault();
  };

  // Block two-finger pinch via touchmove
  const onTouchMove = (e) => {
    if (!shouldHardenMobileApp()) return;
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
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
  document.addEventListener('contextmenu', onContextMenu, { passive: false });
  document.addEventListener('dragstart', onDragStart, { passive: false });

  return () => {
    mediaQueries.forEach((mq) => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else if (typeof mq.removeListener === 'function') mq.removeListener(onChange);
    });
    document.removeEventListener('gesturestart', onGesture);
    document.removeEventListener('gesturechange', onGesture);
    document.removeEventListener('gestureend', onGesture);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('dragstart', onDragStart);
    applyHardening(false);
  };
}
