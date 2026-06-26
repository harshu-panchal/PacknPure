import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function goToHeroLink(navigate, linkType, linkValue) {
    const v = linkValue != null ? String(linkValue).trim() : '';
    switch (linkType) {
        case 'category':
        case 'subcategory':
            if (v) navigate(`/category/${v}`);
            else navigate('/categories');
            break;
        case 'product':
            if (v) navigate(`/product/${v}`);
            else navigate('/search');
            break;
        case 'header':
            if (v) navigate(`/category/${v}`);
            else navigate('/categories');
            break;
        case 'url':
            if (v && /^https?:\/\//i.test(v)) window.open(v, '_blank', 'noopener,noreferrer');
            break;
        default:
            navigate('/offers');
    }
}

const Hero = ({ banners = [] }) => {
    const navigate = useNavigate();
    const [current, setCurrent] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Swipe / drag state
    const startXRef = useRef(0);
    const isDraggingRef = useRef(false);

    // Fallback if no banners provided (though API should provide them)
    const displayBanners = banners.length > 0 ? banners : [];

    const goNext = useCallback(() => {
        setCurrent((prev) => (prev + 1) % displayBanners.length);
    }, [displayBanners.length]);

    const goPrev = useCallback(() => {
        setCurrent((prev) => (prev - 1 + displayBanners.length) % displayBanners.length);
    }, [displayBanners.length]);

    useEffect(() => {
        if (displayBanners.length <= 1 || isPaused) return;
        const timer = setInterval(() => {
            goNext();
        }, 5000);
        return () => clearInterval(timer);
    }, [displayBanners.length, isPaused, goNext]);

    // ── Touch handlers ──
    const handleTouchStart = useCallback((e) => {
        startXRef.current = e.touches[0].clientX;
        setIsPaused(true);
    }, []);

    const handleTouchEnd = useCallback((e) => {
        const diff = startXRef.current - e.changedTouches[0].clientX;
        const SWIPE_THRESHOLD = 50;
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
            if (diff > 0) goNext();
            else goPrev();
        }
        setIsPaused(false);
    }, [goNext, goPrev]);

    // ── Mouse drag handlers (desktop cursor swipe) ──
    const handleMouseDown = useCallback((e) => {
        startXRef.current = e.clientX;
        isDraggingRef.current = true;
        setIsPaused(true);
    }, []);

    const handleMouseUp = useCallback((e) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const diff = startXRef.current - e.clientX;
        const SWIPE_THRESHOLD = 50;
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
            if (diff > 0) goNext();
            else goPrev();
        }
        setIsPaused(false);
    }, [goNext, goPrev]);

    const handleMouseLeave = useCallback(() => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsPaused(false);
        }
    }, []);

    if (!displayBanners.length) return null;

    return (
        <section className="relative block overflow-hidden pb-4 md:pb-8">
            <div className="relative z-10 w-full">
                <div
                    className="relative w-full overflow-hidden bg-brand-50 min-h-[168px] sm:min-h-[188px] md:min-h-[280px] lg:min-h-[360px] shadow-sm select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                >
                    {displayBanners.map((banner, index) => (
                        <div
                            key={banner.id || index}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                        >
                            <div className="relative block w-full h-full text-left">
                                <picture>
                                    <source media="(max-width: 767px)" srcSet={banner.mobileImage || banner.image} />
                                    <source media="(min-width: 768px)" srcSet={banner.image} />
                                    <img
                                        src={banner.image}
                                        alt={banner.title || 'Banner'}
                                        className="w-full h-full object-cover pointer-events-none"
                                        draggable={false}
                                    />
                                </picture>
                                
                                {/* Content Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 md:p-12 flex flex-col justify-end text-white pointer-events-none">
                                    <div className={`transform transition-all duration-700 ${index === current ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                                        
                                        {banner.title && (
                                            <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold mb-2 md:mb-3 leading-[1.1] drop-shadow-lg">
                                                {banner.title}
                                            </h1>
                                        )}

                                        {banner.subtitle && (
                                            <p className="font-medium text-sm md:text-lg text-gray-200 mb-4 md:mb-6 max-w-lg leading-relaxed line-clamp-2 md:line-clamp-none">
                                                {banner.subtitle}
                                            </p>
                                        )}

                                        {(banner.title || banner.subtitle) && (
                                            <button 
                                                type="button"
                                                onClick={() => goToHeroLink(navigate, banner.linkType, banner.linkValue)}
                                                className="bg-[#E23744] hover:bg-[#c92e3a] text-white font-bold px-6 py-3 md:px-8 md:py-4 rounded-xl text-sm md:text-base shadow-xl transition-all w-auto inline-flex items-center pointer-events-auto transform hover:scale-105 active:scale-95"
                                            >
                                                Explore Now
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Carousel Indicators */}
                    {displayBanners.length > 1 && (
                        <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
                            {displayBanners.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrent(index)}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${index === current ? 'bg-brand-600 w-6' : 'bg-white/80 hover:bg-white w-1.5 ring-1 ring-brand-200/80'}`}
                                    aria-label={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Hero;
