/**
 * LenisProvider — Global smooth scroll manager.
 *
 * Architecture:
 *  1. Initialises a single Lenis instance for the whole app.
 *  2. Exposes a `useLenis()` hook so any child can call lenis.scrollTo() etc.
 *  3. Watches document.body via MutationObserver: whenever a modal/drawer
 *     adds `overflow:hidden` or `data-scroll-locked` (Radix UI / custom modals)
 *     it automatically calls lenis.stop(), and resumes on removal.
 *  4. Mobile: touchMultiplier = 1 + smoothTouch = false so native iOS/Android
 *     momentum is preserved and not doubled-up.
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const LenisContext = createContext(null);

export const useLenis = () => useContext(LenisContext);

const LenisProvider = ({ children }) => {
    const lenisRef = useRef(null);

    useEffect(() => {
        // ── 1. Create Lenis instance ──────────────────────────────────────
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            // Mobile: keep multiplier at 1 (was 2) to avoid over-sensitive scrolling
            touchMultiplier: 1,
            // Disable smooth on touch — native momentum is better on iOS/Android
            smoothTouch: false,
            // Prevent Lenis from hijacking wheel events inside `data-lenis-prevent` elements
            prevent: (node) => node.hasAttribute('data-lenis-prevent'),
        });
        lenisRef.current = lenis;

        // ── 2. RAF loop ───────────────────────────────────────────────────
        let rafId;
        function raf(time) {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);

        // ── 3. MutationObserver: auto-pause when modal opens ─────────────
        // Radix UI (Dialog/Sheet) sets `data-scroll-locked` on <body>.
        // Custom modals (SetNameModal, LocationDrawer) set `overflow:hidden` inline.
        // We watch for both.
        const observer = new MutationObserver(() => {
            const body = document.body;
            const isLocked =
                body.hasAttribute('data-scroll-locked') ||
                body.style.overflow === 'hidden' ||
                body.style.overflowY === 'hidden';

            if (isLocked) {
                lenis.stop();
            } else {
                lenis.start();
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style', 'data-scroll-locked', 'class'],
        });

        // ── 4. Cleanup ────────────────────────────────────────────────────
        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    return (
        <LenisContext.Provider value={lenisRef}>
            {children}
        </LenisContext.Provider>
    );
};

export default LenisProvider;
