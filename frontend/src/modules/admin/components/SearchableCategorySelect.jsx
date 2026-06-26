import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    HiOutlineMagnifyingGlass,
    HiOutlineChevronDown,
    HiOutlineCheck,
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';

/**
 * Searchable dropdown for parent categories or subcategories in admin forms.
 */
const SearchableCategorySelect = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    searchPlaceholder = 'Search by name…',
    emptyLabel = 'No categories match your search',
    disabled = false,
    helperText,
    getOptionId = (o) => o._id || o.id,
    getOptionLabel = (o) => o.name,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);

    const selected = useMemo(
        () => options.find((o) => getOptionId(o) === value),
        [options, value, getOptionId],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
    }, [options, query, getOptionLabel]);

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pick = (id) => {
        onChange(id);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                className={cn(
                    'w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold text-left flex items-center justify-between gap-2 outline-none ring-primary/5 focus:ring-2 transition-colors hover:bg-slate-200/80',
                    disabled && 'opacity-50 cursor-not-allowed hover:bg-slate-100',
                )}
            >
                <span className={cn('truncate', !selected && 'text-slate-400 font-semibold')}>
                    {selected ? getOptionLabel(selected) : placeholder}
                </span>
                <HiOutlineChevronDown
                    className={cn('w-4 h-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
                />
            </button>

            {open && (
                <div 
                    className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                            <HiOutlineMagnifyingGlass className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="flex-1 bg-transparent text-sm font-semibold outline-none min-w-0"
                            />
                        </div>
                    </div>
                    <ul className="max-h-56 overflow-y-auto overscroll-none touch-pan-y custom-scrollbar">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-400 font-medium">{emptyLabel}</li>
                        ) : (
                            filtered.map((opt) => {
                                const id = getOptionId(opt);
                                const active = id === value;
                                return (
                                    <li key={id}>
                                        <button
                                            type="button"
                                            onClick={() => pick(id)}
                                            className={cn(
                                                'w-full px-4 py-2.5 text-left text-sm font-semibold flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors',
                                                active && 'bg-primary/5 text-primary',
                                            )}
                                        >
                                            <span className="truncate">{getOptionLabel(opt)}</span>
                                            {active && <HiOutlineCheck className="w-4 h-4 shrink-0" />}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                    {options.length > 0 && (
                        <p className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-50">
                            {filtered.length} of {options.length} shown
                        </p>
                    )}
                </div>
            )}
            {helperText && (
                <p className="text-[10px] text-slate-400 ml-1 mt-1 font-medium">{helperText}</p>
            )}
        </div>
    );
};

export default SearchableCategorySelect;
