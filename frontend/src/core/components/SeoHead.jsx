import { useEffect, useRef } from 'react';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';

/**
 * Updates document title, favicon, and meta description/keywords from global settings.
 * Must be rendered inside SettingsProvider.
 */
export default function SeoHead() {
    const { settings } = useSettings();
    const metaRefs = useRef({ description: null, keywords: null, favicon: null });

    const { role, user } = useAuth();

    useEffect(() => {
        const baseAppName = settings?.appName || 'Packnpure';
        let panelTitle = baseAppName;

        if (role === 'seller') {
            const sellerIdentifier = user?.shopName || user?.name || user?.email;
            panelTitle = sellerIdentifier
                ? `${baseAppName} - Seller (${sellerIdentifier})`
                : `${baseAppName} - Seller`;
        } else if (role === 'admin') {
            const adminIdentifier = user?.name || user?.email;
            panelTitle = adminIdentifier
                ? `${baseAppName} - Admin (${adminIdentifier})`
                : `${baseAppName} - Admin`;
        } else if (role === 'delivery') {
            const deliveryIdentifier = user?.name || user?.email;
            panelTitle = deliveryIdentifier
                ? `${baseAppName} - Delivery (${deliveryIdentifier})`
                : `${baseAppName} - Delivery`;
        } else if (role === 'pickup_partner') {
            const pickupIdentifier = user?.name || user?.email;
            panelTitle = pickupIdentifier
                ? `${baseAppName} - Pickup Partner (${pickupIdentifier})`
                : `${baseAppName} - Pickup Partner`;
        } else if (settings?.metaTitle) {
            panelTitle = settings.metaTitle;
        }

        document.title = panelTitle;

        if (!settings) return;

        const desc = settings.metaDescription || '';
        const keywordsContent = (Array.isArray(settings.keywords) && settings.keywords.length)
            ? settings.keywords.join(', ')
            : (settings.metaKeywords || '');

        // Update or create meta description
        let metaDesc = metaRefs.current.description;
        if (!metaDesc) {
            metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaRefs.current.description = metaDesc;
        }
        metaDesc.setAttribute('content', desc);

        // Update or create meta keywords
        let metaKw = metaRefs.current.keywords;
        if (!metaKw) {
            metaKw = document.querySelector('meta[name="keywords"]');
            if (!metaKw) {
                metaKw = document.createElement('meta');
                metaKw.setAttribute('name', 'keywords');
                document.head.appendChild(metaKw);
            }
            metaRefs.current.keywords = metaKw;
        }
        metaKw.setAttribute('content', keywordsContent);

        // Update or create dynamic favicon
        const faviconUrl = settings.faviconUrl || '';
        let linkFavicon = metaRefs.current.favicon;
        if (!linkFavicon) {
            linkFavicon = document.getElementById('dynamic-favicon');
            if (!linkFavicon && faviconUrl) {
                linkFavicon = document.createElement('link');
                linkFavicon.id = 'dynamic-favicon';
                linkFavicon.rel = 'icon';
                linkFavicon.type = 'image/x-icon';
                document.head.appendChild(linkFavicon);
                metaRefs.current.favicon = linkFavicon;
            } else if (linkFavicon) {
                metaRefs.current.favicon = linkFavicon;
            }
        }
        if (linkFavicon) {
            linkFavicon.href = faviconUrl || '/vite.svg';
        }
    }, [settings, role, user]);

    return null;
}
