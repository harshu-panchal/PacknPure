import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', description }) => {
    const sizes = {
        sm: 'sm:max-w-md',
        md: 'sm:max-w-lg',
        lg: 'sm:max-w-2xl',
        xl: 'sm:max-w-4xl',
        full: 'sm:max-w-[95vw]',
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn("overflow-hidden p-0 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] sm:w-full flex flex-col gap-0 max-h-[80dvh] sm:max-h-[85vh] my-auto rounded-2xl sm:rounded-3xl shadow-2xl bg-white border border-slate-200/80", sizes[size])}>
                <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-white shrink-0 z-20 relative">
                    <DialogTitle className="text-base sm:text-xl font-bold text-slate-900 pr-8 leading-snug break-words">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {description || (typeof title === 'string' ? title : 'Modal content')}
                    </DialogDescription>
                </DialogHeader>

                <div
                    className="px-4 sm:px-6 pt-3.5 pb-8 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y space-y-4"
                    tabIndex={0}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    {children}
                </div>

                {footer && (
                    <DialogFooter className="px-4 sm:px-6 py-3 bg-white border-t border-slate-100 shrink-0 z-20 relative flex flex-row items-center justify-end gap-2.5 sm:space-x-0">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default Modal;
