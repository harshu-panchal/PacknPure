import React from 'react';
import { MapPin } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

/** Shown when geolocation fails (device/system location off, permission blocked, etc). */
const LocationOffModal = ({ isOpen, onClose, title, message, onRetry, retryLabel = 'Try Again' }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title || 'Turn on your location'} size="sm">
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
        <MapPin size={28} />
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        {message ||
          "We couldn't detect your location. Please turn on your device's location (GPS) and allow location access, then try again."}
      </p>
      {onRetry && (
        <Button
          onClick={() => {
            onRetry();
            onClose();
          }}
          className="mt-2 w-full"
        >
          {retryLabel}
        </Button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-1 text-xs font-bold text-slate-400 hover:text-slate-600"
      >
        Search manually instead
      </button>
    </div>
  </Modal>
);

export default LocationOffModal;
