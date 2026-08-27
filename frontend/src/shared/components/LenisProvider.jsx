/**
 * LenisProvider — Global smooth scroll manager (desktop web only).
 *
 * On mobile / PWA / coarse-pointer devices Lenis is disabled so nested
 * overflow scroll shells (delivery, pickup, sheets) keep native finger scroll.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { shouldHardenMobileApp } from '@core/mobile/mobileAppHardening';

const LenisContext = createContext(null);

export const useLenis = () => useContext(LenisContext);

const MOBILE_SCROLL_QUERY =
  '(max-width: 767.98px), (hover: none) and (pointer: coarse)';

// Delegates the "is this mobile" check to mobileAppHardening's own function
// call rather than reading back the DOM class it sets — reading a class that
// another module writes (and that module's own listeners run on the same
// resize/media-query events) creates a MutationObserver feedback loop the
// moment something here also reacts to document.documentElement class changes.
function isMobileScrollEnvironment() {
  if (typeof window === 'undefined') return true;
  if (shouldHardenMobileApp()) return true;
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
        document.documentElement.classList.remove('lenis', 'lenis-smooth');
      }
      lenisRef.current = null;
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

    // Re-sync on both this provider's own breakpoint and mobileAppHardening's
    // breakpoint (1024px) — isMobileScrollEnvironment() depends on both via
    // shouldHardenMobileApp(), so a resize crossing either one needs to
    // re-run sync(). This replaces watching document.documentElement's class
    // attribute (which mobileAppHardening.js also writes to on these same
    // events) — reacting to the actual media queries instead of a DOM class
    // another module toggles avoids the two systems triggering each other.
    const mediaQueries = [
      window.matchMedia(MOBILE_SCROLL_QUERY),
      window.matchMedia('(max-width: 1024px)'),
    ];
    const onMedia = () => sync();
    mediaQueries.forEach((mq) => {
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMedia);
      else if (typeof mq.addListener === 'function') mq.addListener(onMedia);
    });

    return () => {
      mediaQueries.forEach((mq) => {
        if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onMedia);
        else if (typeof mq.removeListener === 'function') mq.removeListener(onMedia);
      });
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
