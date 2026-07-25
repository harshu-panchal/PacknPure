/**
 * LenisProvider — Global smooth scroll manager (desktop web only).
 *
 * On mobile / PWA / coarse-pointer devices Lenis is disabled so nested
 * overflow scroll shells (delivery, pickup, sheets) keep native finger scroll.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const LenisContext = createContext(null);

export const useLenis = () => useContext(LenisContext);

const MOBILE_SCROLL_QUERY =
  '(max-width: 767.98px), (hover: none) and (pointer: coarse)';

function isMobileScrollEnvironment() {
  if (typeof window === 'undefined') return true;
  if (document.documentElement.classList.contains('app-mobile-hardened')) return true;
  if (window.matchMedia(MOBILE_SCROLL_QUERY).matches) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  if (Boolean(window.navigator.standalone)) return true;
  return false;
}

const LenisProvider = ({ children }) => {
  const lenisRef = useRef(null);

  useEffect(() => {
    let lenis = null;
    let rafId = 0;
    let observer = null;

    const tick = (time) => {
      lenis?.raf(time);
      rafId = requestAnimationFrame(tick);
    };

    const destroyLenis = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };

    const createLenis = () => {
      if (lenis || isMobileScrollEnvironment()) return;

      lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        touchMultiplier: 1,
        smoothTouch: false,
        prevent: (node) =>
          node.hasAttribute('data-lenis-prevent') ||
          node.hasAttribute('data-lenis-prevent-touch'),
      });
      lenisRef.current = lenis;
      rafId = requestAnimationFrame(tick);

      observer = new MutationObserver(() => {
        const body = document.body;
        const isLocked =
          body.hasAttribute('data-scroll-locked') ||
          body.style.overflow === 'hidden' ||
          body.style.overflowY === 'hidden';

        if (!lenis) return;
        if (isLocked) lenis.stop();
        else lenis.start();
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'data-scroll-locked', 'class'],
      });
    };

    const sync = () => {
      if (isMobileScrollEnvironment()) destroyLenis();
      else createLenis();
    };

    sync();

    const media = window.matchMedia(MOBILE_SCROLL_QUERY);
    const onMedia = () => sync();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onMedia);
    else if (typeof media.addListener === 'function') media.addListener(onMedia);

    const classObserver = new MutationObserver(sync);
    classObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onMedia);
      else if (typeof media.removeListener === 'function') media.removeListener(onMedia);
      classObserver.disconnect();
      destroyLenis();
    };
  }, []);

  return (
    <LenisContext.Provider value={lenisRef}>
      {children}
    </LenisContext.Provider>
  );
};

export default LenisProvider;
