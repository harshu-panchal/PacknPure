import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const Loader = ({ size = 'md', fullScreen = false, className }) => {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-10 w-10',
        lg: 'h-16 w-16',
    };

    const spinner = (
        <Loader2
            className={cn(
                'animate-spin text-primary',
                sizeClasses[size],
                className
            )}
            aria-hidden
        />
    );

    if (fullScreen) {
        return (
            <div
                className="fixed inset-0 z-shell-modal flex items-center justify-center bg-background/80 backdrop-blur-sm"
                role="status"
                aria-live="polite"
                aria-label="Loading"
            >
                {spinner}
            </div>
        );
    }

    return (
        <span role="status" aria-live="polite" aria-label="Loading" className="inline-flex">
            {spinner}
        </span>
    );
};

export default Loader;
