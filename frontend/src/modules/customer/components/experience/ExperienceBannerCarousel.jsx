import React from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const ExperienceBannerCarousel = ({ section, items, fullWidth = false, slideGap = 0, edgeToEdge = false }) => {
  const navigate = useNavigate();
  if (!items.length) return null;

  const handleBannerClick = (linkType, linkValue) => {
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
  };

  const effectiveSlideGap = fullWidth ? 0 : slideGap;

  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isResetting, setIsResetting] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const startXRef = React.useRef(0);
  const isDraggingRef = React.useRef(false);
  const loopedItems = items.length > 1 ? [...items, items[0]] : items;
  const stepPercent = 100 / loopedItems.length;

  const goNext = React.useCallback(() => {
    setActiveIndex((prev) => prev + 1);
  }, []);

  const goPrev = React.useCallback(() => {
    setActiveIndex((prev) => {
      if (prev <= 0) return items.length - 1;
      return prev - 1;
    });
  }, [items.length]);

  React.useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const intervalId = setInterval(() => {
      goNext();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [items.length, isPaused, goNext]);

  React.useEffect(() => {
    if (items.length <= 1 || activeIndex !== items.length) return;

    const timeoutId = window.setTimeout(() => {
      setIsResetting(true);
      setActiveIndex(0);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, items.length]);

  React.useEffect(() => {
    if (!isResetting) return;

    const frameId = window.requestAnimationFrame(() => {
      setIsResetting(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isResetting]);

  // ── Touch handlers ──
  const handleTouchStart = React.useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
    setIsPaused(true);
  }, []);

  const handleTouchEnd = React.useCallback((e) => {
    const diff = startXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setIsPaused(false);
  }, [goNext, goPrev]);

  // ── Mouse drag handlers ──
  const handleMouseDown = React.useCallback((e) => {
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
    setIsPaused(true);
  }, []);

  const handleMouseUp = React.useCallback((e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const diff = startXRef.current - e.clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setIsPaused(false);
  }, [goNext, goPrev]);

  const handleMouseLeave = React.useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsPaused(false);
    }
  }, []);

  return (
    <div
      className={cn("overflow-hidden select-none", fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={cn("flex ease-out", isResetting ? "transition-none" : "transition-transform duration-500")}
        style={{
          width: `${loopedItems.length * 100}%`,
          gap: `${effectiveSlideGap}px`,
          transform: `translateX(-${activeIndex * stepPercent}%)`,
        }}
      >
        {loopedItems.map((banner, idx) => (
          <div
            key={idx}
            className={cn(
              "relative shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center box-border group",
              fullWidth ? "min-h-[160px] md:min-h-[260px] rounded-none px-0" : "min-h-[160px] md:min-h-[260px] px-4 md:px-8 py-2"
            )}
            style={{
              width: `${stepPercent}%`,
            }}
          >
            {fullWidth ? (
              <>
                <picture>
                  <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl || banner.imageUrl} />
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || section?.title || "Banner"}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent p-6 md:p-12 flex flex-col justify-center items-start text-left text-white pointer-events-none">
                  {(banner.title || banner.subtitle) && (
                    <div className="transform transition-all duration-500 pointer-events-auto w-full md:w-1/2 flex flex-col items-start">
                      {banner.title && (
                        <h2 className="text-xl md:text-4xl font-extrabold mb-1 md:mb-2 leading-[1.1] drop-shadow-md">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="font-medium text-xs md:text-base text-gray-200 mb-3 md:mb-4 max-w-xl leading-snug line-clamp-2 md:line-clamp-none">
                          {banner.subtitle}
                        </p>
                      )}
                      <button 
                        type="button"
                        onClick={() => handleBannerClick(banner.linkType, banner.linkValue)}
                        className="bg-[#E23744] hover:bg-[#c92e3a] text-white font-bold px-5 py-2.5 md:px-6 md:py-3 rounded-xl text-xs md:text-sm shadow-lg transition-all w-auto inline-flex items-center transform hover:scale-105 active:scale-95 mt-2"
                      >
                        Explore Now
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="relative h-full w-full max-w-[800px] md:max-w-[1000px] -translate-x-2 md:-translate-x-4 overflow-hidden rounded-3xl bg-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <picture>
                  <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl || banner.imageUrl} />
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || section?.title || "Banner"}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent p-5 md:p-10 flex flex-col justify-center items-start text-left text-white pointer-events-none">
                  {(banner.title || banner.subtitle) && (
                    <div className="transform transition-all duration-500 pointer-events-auto w-full md:w-[55%] flex flex-col items-start">
                      {banner.title && (
                        <h2 className="text-lg md:text-3xl font-extrabold mb-1 md:mb-2 leading-[1.1] drop-shadow-md">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="font-medium text-[11px] md:text-sm text-gray-200 mb-3 md:mb-4 max-w-sm md:max-w-md leading-snug line-clamp-2">
                          {banner.subtitle}
                        </p>
                      )}
                      <button 
                        type="button"
                        onClick={() => handleBannerClick(banner.linkType, banner.linkValue)}
                        className="bg-[#E23744] hover:bg-[#c92e3a] text-white font-bold px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-xs md:text-sm shadow-lg transition-all w-auto inline-flex items-center transform hover:scale-105 active:scale-95 mt-1"
                      >
                        Explore Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExperienceBannerCarousel;
