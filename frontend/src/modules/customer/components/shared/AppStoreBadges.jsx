import React from 'react';
import { useSettings } from '@core/context/SettingsContext';

const PlayStoreBadge = ({ className = 'h-11' }) => (
  <svg className={className} viewBox="0 0 135 40" aria-hidden>
    <rect width="135" height="40" rx="6" fill="#000" />
    <path
      d="M9.5 8.2l10.8 6.2-10.8 6.2V8.2zm1.8 14.4l12.6-7.2-4.6-2.6-8 4.6v5.2zm14.2-8.2l-4.6-2.6-8.6 4.9v5.4l8.6 4.9 4.6-2.6-8.2-4.7 8.2-4.9z"
      fill="#34A853"
    />
    <path d="M11.3 8.2v15.6l8-4.6-8-11z" fill="#FBBC04" />
    <path d="M11.3 23.8l8 4.6V8.2l-8 15.6z" fill="#EA4335" />
    <path d="M19.3 13.6l8.2 4.7-8.2 4.7V13.6z" fill="#4285F4" />
    <text x="38" y="15" fill="#fff" fontSize="7" fontFamily="system-ui,sans-serif">
      GET IT ON
    </text>
    <text x="38" y="28" fill="#fff" fontSize="13" fontWeight="600" fontFamily="system-ui,sans-serif">
      Google Play
    </text>
  </svg>
);

const AppStoreBadge = ({ className = 'h-11' }) => (
  <svg className={className} viewBox="0 0 135 40" aria-hidden>
    <rect width="135" height="40" rx="6" fill="#000" />
    <path
      d="M24.8 28.5c-.5 1.2-1.1 2.4-2 2.4-.8 0-1-.5-2-.5-1 0-1.1.5-2 .5-.9 0-1.6-1.3-2.1-2.5-1.2-2.8-2.1-7.9-.9-11.4.6-1.6 1.7-2.6 3.2-2.6.9 0 1.6.6 2.4.6.8 0 1.3-.6 2.3-.6 1.4 0 2.5.8 3.1 2.1-2.7 1.5-2.3 5.4.4 6.7-.5 1.4-1.1 2.8-2 2.8zm-3.6-18.8c.5-.6 1.4-1 2.2-1 .1.9-.3 1.8-.8 2.4-.5.7-1.3 1.2-2.1 1.1-.1-.9.3-1.7.7-2.5z"
      fill="#fff"
    />
    <text x="38" y="15" fill="#fff" fontSize="7" fontFamily="system-ui,sans-serif">
      Download on the
    </text>
    <text x="38" y="28" fill="#fff" fontSize="13" fontWeight="600" fontFamily="system-ui,sans-serif">
      App Store
    </text>
  </svg>
);

/**
 * Play Store + App Store download badges. Links from admin settings when set.
 */
const AppStoreBadges = ({ className = '', badgeClassName = 'h-11 w-auto', alwaysShow = true }) => {
  const { settings } = useSettings();
  const playUrl = settings?.playStoreLink?.trim();
  const appStoreUrl = settings?.appStoreLink?.trim();

  if (!alwaysShow && !playUrl && !appStoreUrl) return null;

  const wrap = (url, label, child) => {
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-opacity hover:opacity-90 active:scale-[0.98]"
          aria-label={label}
        >
          {child}
        </a>
      );
    }
    return (
      <span className="inline-block cursor-default opacity-80" aria-label={label} title="Coming soon">
        {child}
      </span>
    );
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {wrap(playUrl, 'Get it on Google Play', <PlayStoreBadge className={badgeClassName} />)}
      {wrap(appStoreUrl, 'Download on the App Store', <AppStoreBadge className={badgeClassName} />)}
    </div>
  );
};

export { PlayStoreBadge, AppStoreBadge };
export default AppStoreBadges;
