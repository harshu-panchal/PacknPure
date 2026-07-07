import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLenis } from "@/shared/components/LenisProvider";

const ScrollToTop = () => {
    const { pathname } = useLocation();
    const lenisRef = useLenis();

    useEffect(() => {
        const lenis = lenisRef?.current;
        if (lenis) {
            // Use Lenis-native scroll reset to avoid jitter from window.scrollTo fighting Lenis
            lenis.scrollTo(0, { immediate: true });
        } else {
            // Graceful fallback if LenisProvider is not available
            window.scrollTo(0, 0);
        }
    }, [pathname, lenisRef]);

    return null;
};

export default ScrollToTop;
