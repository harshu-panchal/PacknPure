import React, { useId } from 'react';
import { Input as ShadcnInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ label, error, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
        <div className="w-full space-y-1.5 min-w-0">
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <ShadcnInput
                id={inputId}
                className={cn(
                    'min-h-11',
                    error && 'border-destructive focus-visible:ring-destructive',
                    className
                )}
                ref={ref}
                aria-invalid={error ? true : undefined}
                aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
                {...props}
            />
            {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
            {helperText && !error && (
                <p id={helperId} className="text-xs text-muted-foreground">{helperText}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
