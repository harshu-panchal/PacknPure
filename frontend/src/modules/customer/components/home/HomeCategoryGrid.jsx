import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HOME_SECTION } from './homeLayout';

const HomeCategoryGrid = ({ categories, title = 'Shop by category' }) => {
    const navigate = useNavigate();

    return (
        <section className={`${HOME_SECTION} py-4 md:py-8`}>
            <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-2xl">{title}</h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 md:gap-5 lg:grid-cols-8">
                {categories.map((cat) => (
                    <button
                        key={String(cat.id)}
                        type="button"
                        onClick={() => navigate(`/category/${cat.id}`)}
                        className="flex flex-col items-center gap-2 text-center group"
                    >
                        <div className="w-full aspect-square rounded-2xl bg-brand-50 flex items-center justify-center p-2 overflow-hidden border border-brand-100 group-active:scale-95 transition-transform group-hover:border-brand-200">
                            <img
                                src={cat.image}
                                alt={cat.name || 'Category'}
                                className="w-full h-full object-contain mix-blend-multiply"
                                loading="lazy"
                            />
                        </div>
                        <span className="text-[10px] md:text-xs font-semibold text-slate-800 leading-tight line-clamp-2 px-0.5">
                            {cat.name}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default HomeCategoryGrid;
