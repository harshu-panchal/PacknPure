import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { X } from 'lucide-react';

export const CameraScanner = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);
    const closeRef = useRef(onClose);

    closeRef.current = onClose;

    useEffect(() => {
        if (!scannerRef.current) return undefined;

        const scanner = new Html5QrcodeScanner(
            'reader',
            {
                fps: 10,
                qrbox: { width: 250, height: 150 },
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                rememberLastUsedCamera: true,
            },
            false,
        );

        scanner.render(
            (decodedText) => {
                scanner.clear();
                onScan(decodedText);
            },
            () => {},
        );

        return () => {
            scanner.clear().catch(() => {});
        };
    }, [onScan]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeRef.current?.();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-shell-modal bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-px"
            role="dialog"
            aria-modal="true"
            aria-label="Scan barcode"
        >
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden w-full max-w-md max-h-[min(90dvh,90vh)] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                    <h3 className="font-bold text-gray-800">Scan Barcode</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close scanner"
                        className="touch-target inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" aria-hidden />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto overscroll-contain">
                    <div
                        id="reader"
                        ref={scannerRef}
                        className="w-full rounded-lg overflow-hidden border-2 border-dashed border-gray-300 min-h-[200px]"
                    />
                    <p className="text-center text-sm text-gray-500 mt-4">
                        Point your camera at a product barcode to scan.
                    </p>
                </div>
            </div>
        </div>
    );
};
