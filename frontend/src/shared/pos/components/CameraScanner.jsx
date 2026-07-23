import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

/** Prefer Code128; keep related 1D formats as fallback for printed labels. */
const BARCODE_FORMATS = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
];

function friendlyCameraError(error) {
    const raw = String(error?.message || error || '').toLowerCase();

    if (
        raw.includes('notallowed') ||
        raw.includes('permission') ||
        raw.includes('denied') ||
        raw.includes('notallowederror')
    ) {
        return 'Camera permission denied. Allow camera access in your browser settings and try again.';
    }
    if (
        raw.includes('notfound') ||
        raw.includes('not found') ||
        raw.includes('no camera') ||
        raw.includes('devices not found') ||
        raw.includes('requested device not found')
    ) {
        return 'No camera found on this device.';
    }
    if (
        raw.includes('notreadable') ||
        raw.includes('trackstart') ||
        raw.includes('could not start') ||
        raw.includes('in use') ||
        raw.includes('abort')
    ) {
        return 'Camera is unavailable or already in use by another app.';
    }
    if (raw.includes('secure') || raw.includes('https')) {
        return 'Camera requires a secure (HTTPS) connection.';
    }
    if (raw.includes('overconstrained')) {
        return 'Could not open the rear camera. Retry to try another camera.';
    }
    return 'Unable to start the camera scanner. Please try again.';
}

async function stopAndClear(instance) {
    if (!instance) return;
    try {
        if (instance.isScanning) {
            await instance.stop();
        }
    } catch {
        // ignore
    }
    try {
        await instance.clear();
    } catch {
        // ignore
    }
}

/**
 * Camera barcode scanner (Code128-first).
 * Uses Html5Qrcode (not the Scanner UI widget) for reliable 1D detection.
 * Callbacks via refs → parent re-renders do not restart the camera.
 */
export const CameraScanner = ({ onScan, onClose }) => {
    const reactId = useId();
    const readerId = `barcode-reader-${reactId.replace(/:/g, '')}`;

    const onScanRef = useRef(onScan);
    const onCloseRef = useRef(onClose);
    const scannerRef = useRef(null);
    const handledRef = useRef(false);

    const [errorMessage, setErrorMessage] = useState(null);
    const [statusText, setStatusText] = useState('Starting camera…');
    const [retryToken, setRetryToken] = useState(0);

    onScanRef.current = onScan;
    onCloseRef.current = onClose;

    useEffect(() => {
        handledRef.current = false;
        setErrorMessage(null);
        setStatusText('Starting camera…');

        let cancelled = false;
        let html5QrCode = null;

        const start = async () => {
            // Delay survives React Strict Mode double-mount (cleanup cancels first run).
            await new Promise((r) => setTimeout(r, 200));
            if (cancelled) return;

            const element = document.getElementById(readerId);
            if (!element) {
                setErrorMessage('Scanner failed to initialize. Please close and try again.');
                setStatusText('');
                return;
            }
            // Ensure a clean container after any previous clear().
            element.innerHTML = '';

            html5QrCode = new Html5Qrcode(readerId, {
                formatsToSupport: BARCODE_FORMATS,
                useBarCodeDetectorIfSupported: true,
                verbose: false,
            });
            scannerRef.current = html5QrCode;

            const onDecoded = (decodedText) => {
                if (handledRef.current || cancelled) return;
                handledRef.current = true;
                const code = String(decodedText || '').trim();
                setStatusText('Barcode detected…');

                const instance = scannerRef.current;
                scannerRef.current = null;
                stopAndClear(instance).finally(() => {
                    if (code) onScanRef.current?.(code);
                });
            };

            try {
                // Prefer rear camera; fall back to any camera.
                try {
                    await html5QrCode.start(
                        { facingMode: 'environment' },
                        {
                            fps: 15,
                            // Wide / short box — required for 1D Code128 (not QR-shaped).
                            qrbox: (viewfinderWidth, viewfinderHeight) => {
                                const width = Math.floor(Math.min(viewfinderWidth * 0.95, 420));
                                const height = Math.floor(Math.min(120, viewfinderHeight * 0.4));
                                return { width, height };
                            },
                            aspectRatio: 1.777778,
                            disableFlip: false,
                        },
                        onDecoded,
                        () => {
                            // Frame miss — normal while aiming.
                        },
                    );
                } catch (rearErr) {
                    if (cancelled) return;
                    // Fallback: first available camera device.
                    const cameras = await Html5Qrcode.getCameras();
                    if (!cameras?.length) throw rearErr;
                    await html5QrCode.start(
                        cameras[0].id,
                        {
                            fps: 15,
                            qrbox: (viewfinderWidth, viewfinderHeight) => {
                                const width = Math.floor(Math.min(viewfinderWidth * 0.95, 420));
                                const height = Math.floor(Math.min(120, viewfinderHeight * 0.4));
                                return { width, height };
                            },
                            aspectRatio: 1.777778,
                            disableFlip: false,
                        },
                        onDecoded,
                        () => {},
                    );
                }

                if (cancelled) {
                    await stopAndClear(html5QrCode);
                    scannerRef.current = null;
                    return;
                }
                setStatusText('Aim at the Code128 barcode');
            } catch (error) {
                await stopAndClear(html5QrCode);
                scannerRef.current = null;
                if (!cancelled) {
                    setErrorMessage(friendlyCameraError(error));
                    setStatusText('');
                }
            }
        };

        start();

        return () => {
            cancelled = true;
            const instance = scannerRef.current;
            scannerRef.current = null;
            stopAndClear(instance);
        };
    }, [readerId, retryToken]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onCloseRef.current?.();
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

    const handleClose = async () => {
        const instance = scannerRef.current;
        scannerRef.current = null;
        await stopAndClear(instance);
        onCloseRef.current?.();
    };

    const handleRetry = async () => {
        handledRef.current = false;
        const instance = scannerRef.current;
        scannerRef.current = null;
        await stopAndClear(instance);
        setErrorMessage(null);
        setStatusText('Starting camera…');
        setRetryToken((n) => n + 1);
    };

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
                        onClick={handleClose}
                        aria-label="Close scanner"
                        className="touch-target inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" aria-hidden />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto overscroll-contain space-y-3">
                    {errorMessage ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-3" role="alert">
                            <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white"
                                >
                                    Retry Camera
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-3 py-2 rounded-lg text-xs font-bold ring-1 ring-slate-200 text-slate-600"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                id={readerId}
                                className="w-full rounded-lg overflow-hidden bg-black min-h-[240px]"
                            />
                            {statusText && (
                                <p className="text-center text-sm text-gray-600" role="status">
                                    {statusText}
                                </p>
                            )}
                            <p className="text-center text-xs text-gray-400">
                                Hold the phone steady. Keep the full barcode inside the wide box.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
