import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandSoftGradient } from '../../constants/brandTheme';
import { HOME_HERO_OUTER } from './homeLayout';

const SLIDE_MS = 4500;
const SLIDE_H = 'min-h-[168px] sm:min-h-[188px] md:min-h-[280px] lg:min-h-[360px]';

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

/**
 * Full-width hero carousel — brand gradient promo slides (no green/orange tints).
 */
const HomeHeroBanners = ({ slides = [] }) => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const primary = brandColor(settings);
  const promoBg = brandSoftGradient(settings);
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const count = slides.length;

  const go = useCallback(
    (dir) => {
      if (!count) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || isPaused) return undefined;
    const t = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(t);
  }, [count, go, isPaused]);

  // ── Touch handlers ──
  const handleTouchStart = useCallback((e) => {
    startXRef.current = e.touches[0].clientX;
    setIsPaused(true);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const diff = startXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    setIsPaused(false);
  }, [go]);

  // ── Mouse drag handlers ──
  const handleMouseDown = useCallback((e) => {
    startXRef.current = e.clientX;
    isDraggingRef.current = true;
    setIsPaused(true);
  }, []);

  const handleMouseUp = useCallback((e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const diff = startXRef.current - e.clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
    setIsPaused(false);
  }, [go]);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsPaused(false);
    }
  }, []);

  if (!count) return null;

  return (
    <section className={cn(HOME_HERO_OUTER, '-mt-px px-0 md:px-6 lg:px-8')}>
      <div className={cn('relative overflow-hidden bg-brand-50 select-none', 'md:mx-auto md:max-w-[1400px] md:rounded-2xl')}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
            <div key={slide.id} className="w-full shrink-0">
              {slide.layout === 'fullBleed' ? (
                <button
                  type="button"
                  onClick={() =>
                    goToHeroLink(navigate, slide.linkType || 'none', slide.linkValue)
                  }
                  className={cn('relative block w-full', SLIDE_H)}
                >
                  <picture>
                    <source media="(max-width: 767px)" srcSet={slide.mobileImage || slide.image} />
                    <source media="(min-width: 768px)" srcSet={slide.image} />
                    <img
                      src={slide.image}
                      alt={slide.alt || ''}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </picture>
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-900/50 via-brand-900/10 to-transparent" />
                </button>
              ) : (
                <div
                  className={cn(
                    'relative flex items-center border-y border-brand-100/80 px-5 py-5 sm:px-8',
                    SLIDE_H,
                  )}
                  style={{ background: promoBg }}
                >
                  <div className="relative z-10 flex max-w-[58%] flex-col items-start gap-1.5 text-left">
                    <h3 className="text-2xl font-black leading-none tracking-tight text-slate-900 sm:text-[1.65rem]">
                      {slide.headline}{' '}
                      <span style={{ color: primary }}>{slide.headlineAccent}</span>
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-600">at</span>
                      <span
                        className="rounded-lg px-2 py-0.5 text-lg font-black text-white shadow-sm"
                        style={{ backgroundColor: primary }}
                      >
                        {slide.badge}
                      </span>
                      <span className="text-xs font-black text-slate-700">{slide.badgeSuffix}</span>
                    </div>
                    <p className="max-w-[200px] text-[11px] font-semibold leading-snug text-slate-500">
                      {slide.sub}
                    </p>
                    <button
                      type="button"
                      onClick={() => goToHeroLink(navigate, slide.linkType || 'none', slide.linkValue)}
                      className="mt-2 flex items-center gap-1 rounded-2xl px-5 py-2.5 text-xs font-black tracking-wide text-white shadow-lg shadow-brand-200/60"
                      style={{ backgroundColor: primary }}
                    >
                      {slide.cta}
                      <ChevronRight className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 right-0 top-0 flex w-[45%] items-end justify-center sm:w-[42%]">
                    <img
                      src={slide.image}
                      alt=""
                      className="max-h-[140px] w-auto object-contain object-bottom drop-shadow-md sm:max-h-[160px]"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-brand-600' : 'w-1.5 bg-white/80 ring-1 ring-brand-200/80',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeHeroBanners;
