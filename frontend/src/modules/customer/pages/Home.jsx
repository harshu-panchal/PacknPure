import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp } from 'lucide-react';
import { BRAND_COLOR } from '../constants/brandTheme';
import { useLocation } from '../context/LocationContext';
import { useHomePage } from '../hooks/useHomePage';
import HomeReviewHeader from '../components/home/HomeReviewHeader';

import HomeHeroBanners from '../components/home/HomeHeroBanners';
import Hero from '../components/home/Hero';
import HomeCategorySections from '../components/home/HomeCategorySections';
import HomePromoBelowCategories from '../components/home/HomePromoBelowCategories';
import HomeFeaturedSection from '../components/home/HomeFeaturedSection';
import HomePlatformSections from '../components/home/HomePlatformSections';
import LocationDrawer from '../components/shared/LocationDrawer';
import { HOME_SECTION } from '../components/home/homeLayout';
import SectionRenderer from '../components/experience/SectionRenderer';
import HomeSkeleton from '../components/home/HomeSkeleton';

/**
 * Customer landing (/) — mobile-first Blinkit-style home; desktop adds full-width
 * navbar, wider catalog grid, platform story sections, and product grid.
 */
const Home = () => {
    const { currentLocation } = useLocation();
    const [locationOpen, setLocationOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const hasPrompted = localStorage.getItem('hasPromptedLocation');
        if (!hasPrompted && currentLocation?.name === 'Please select your location') {
            setLocationOpen(true);
            localStorage.setItem('hasPromptedLocation', 'true');
        }
    }, [currentLocation]);

    useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 500);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const {
        deliveryLabel,
        outlet,
        heroSlides,
        promoBelowCategories,
        categorySections,
        products,
        isCatalogLoading,
        isCommerceLoading,
        error,
        experienceSections,
        categoryMap,
        subcategoryMap,
    } = useHomePage(currentLocation);

    const productsById = useMemo(() => {
        const map = {};
        products?.forEach(p => { map[p._id || p.id] = p; });
        return map;
    }, [products]);

    const openLocation = () => setLocationOpen(true);
    const scrollToTop = () => {
        // If Lenis is installed, prefer it for smooth scrolling.
        const lenis = typeof window !== 'undefined' ? window.lenis : null;
        if (lenis && typeof lenis.scrollTo === 'function') {
            lenis.scrollTo(0, { duration: 1.1 });
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-full overflow-x-hidden bg-gradient-to-b from-brand-50 via-white to-white pb-4 md:pb-0">
            <HomeReviewHeader
                deliveryLabel={deliveryLabel}
                outlet={outlet}
                onLocationClick={openLocation}
            />



            {error && (
                <p className={`${HOME_SECTION} mt-2 text-center text-sm font-medium text-brand-700`}>
                    {error}
                </p>
            )}

            {(isCatalogLoading || isCommerceLoading) ? (
                <HomeSkeleton />
            ) : (
                <>
                    <Hero banners={heroSlides} />
                    
                    <HomeCategorySections sections={categorySections} />
                    
                    {experienceSections?.length > 0 && (
                        <div className="mt-8 mb-6">
                            <SectionRenderer
                                sections={experienceSections}
                                productsById={productsById}
                                categoriesById={categoryMap}
                                subcategoriesById={subcategoryMap}
                            />
                        </div>
                    )}

                    <HomePromoBelowCategories promo={promoBelowCategories} />

                    <HomeFeaturedSection products={products} />
                </>
            )}

            <HomePlatformSections onLocationClick={openLocation} />

            <LocationDrawer isOpen={locationOpen} onClose={() => setLocationOpen(false)} />

            {showScrollTop && (
                <button
                    type="button"
                    onClick={scrollToTop}
                    className="fixed bottom-[92px] right-4 z-120 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl active:scale-95 transition-transform md:bottom-8"
                    style={{ backgroundColor: BRAND_COLOR }}
                    aria-label="Scroll to top"
                >
                    <ChevronUp size={22} strokeWidth={3} />
                </button>
            )}
        </div>
    );
};

export default Home;
