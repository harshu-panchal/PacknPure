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
        full: 'sm:max-w-[95vw] max-h-[95dvh] h-auto sm:h-[95vh]',
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn("overflow-hidden p-0 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)]", sizes[size])}>
                <DialogHeader className="px-4 sm:px-6 pt-3 pb-2 border-b border-gray-100/50 bg-gray-50/10">
                    <DialogTitle className="text-lg sm:text-2xl font-semibold text-gray-900 pr-6">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {description || (typeof title === 'string' ? title : 'Modal content')}
                    </DialogDescription>
                </DialogHeader>

                <div
                    className="px-4 sm:px-6 pt-3 pb-5 max-h-[min(80dvh,80vh)] overflow-y-auto overscroll-contain touch-pan-y"
                    tabIndex={0}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    {children}
                </div>

                {footer && (
                    <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/30 border-t border-gray-100/50 flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default Modal;
