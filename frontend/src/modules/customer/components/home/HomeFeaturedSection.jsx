import React from 'react';
import { useNavigate } from 'react-router-dom';
import HomeProductCard from './HomeProductCard';
import ProductCard from '../shared/ProductCard';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor } from '../../constants/brandTheme';
import { HOME_SECTION } from './homeLayout';

const HomeFeaturedSection = ({ products, title = 'Popular picks' }) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const primary = brandColor(settings);

    if (!products?.length) return null;

    return (
        <section className={`${HOME_SECTION} space-y-3 py-4 pb-4 md:space-y-6 md:py-10 md:pb-12`}>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 md:text-2xl">{title}</h2>
                <button
                    type="button"
                    onClick={() => navigate('/categories')}
                    className="text-sm font-semibold md:text-base"
                    style={{ color: primary }}
                >
                    See all
                </button>
            </div>

            {/* Mobile: B2B-style list rows (unchanged) */}
            <div className="space-y-3 md:hidden">
                {products.map((p) => (
                    <HomeProductCard key={p.id || p._id} product={p} />
                ))}
            </div>

            {/* Desktop: product grid with cart/wishlist integration */}
            <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
                {products.map((p) => (
                    <ProductCard
                        key={p.id}
                        product={p}
                        compact
                        neutralBg
                        showFulfillment={false}
                        showStockInfo={false}
                        imageBlend={false}
                    />
                ))}
            </div>
        </section>
    );
};

export default HomeFeaturedSection;
