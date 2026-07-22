import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ 
    label, 
    value, 
    icon: Icon, 
    trend, 
    trendDirection = 'up',
    description,
    color = 'text-blue-600',
    bg = 'bg-blue-50',
    onClick,
    className 
}) => {
    return (
        <div 
            onClick={onClick}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(e);
                }
            } : undefined}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            className={cn(
                "ds-stat-card group min-w-0",
                onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                className
            )}
        >
            <div className="flex flex-col space-y-3 min-w-0">
                <div className="flex justify-between items-start gap-2">
                    <div className={cn("ds-stat-card-icon flex-shrink-0", bg)}>
                        {Icon && <Icon className={cn("ds-icon-lg", color)} strokeWidth={2.5} />}
                    </div>
                    {trend && (
                        <div className={cn(
                            "ds-stat-card-trend flex-shrink-0",
                            trendDirection === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                        )}>
                            {trendDirection === 'up' ? (
                                <TrendingUp className="ds-icon-sm mr-0.5" />
                            ) : (
                                <TrendingDown className="ds-icon-sm mr-0.5" />
                            )}
                            {trend}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="ds-caption mb-1.5 truncate">{label}</p>
                    <p className="ds-stat-large break-words">{value}</p>
                    {description && <p className="ds-description mt-1 line-clamp-2">{description}</p>}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
