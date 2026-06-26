import React from 'react';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandFooterGradient, BRAND_COLOR_DARK, brandLogoOnColor } from '../../constants/brandTheme';
import AppStoreBadges from '../shared/AppStoreBadges';

const Footer = () => {
    const { settings } = useSettings();
    const logoUrl = brandLogoOnColor(settings);
    const primaryColor = brandColor(settings);

    return (
        <footer
            className="relative mt-8 w-full max-w-lg mx-auto overflow-hidden pt-16 pb-24 text-white shadow-2xl md:mt-12 md:max-w-none md:pb-16 md:pt-20"
            style={{ background: brandFooterGradient(settings) }}
        >
            <div className="pointer-events-none absolute inset-0 opacity-25">
                <div
                    className="absolute -right-24 -top-24 h-96 w-96 rounded-full blur-[150px]"
                    style={{ backgroundColor: primaryColor }}
                />
                <div
                    className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full blur-[150px]"
                    style={{ backgroundColor: BRAND_COLOR_DARK }}
                />
            </div>

            <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
                <svg
                    className="relative block h-[25px] w-[calc(100%+1.3px)] md:h-[60px]"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                >
                    <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white" />
                </svg>
            </div>

            <div className="container relative z-10 mx-auto max-w-[1400px] px-6 md:px-10 lg:px-12">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-12">
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center">
                            <img
                                src={logoUrl}
                                alt={`${settings?.appName || 'App'} Logo`}
                                className="h-12 w-auto object-contain md:h-14"
                            />
                        </div>
                        <p className="max-w-xs text-sm font-medium leading-relaxed text-white/90 md:text-base md:leading-loose">
                            Your daily dose of fresh, organic, and healthy products delivered straight to your door.
                            Freshness guaranteed.
                        </p>
                        <div>
                            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/70">
                                Get the app
                            </p>
                            <AppStoreBadges badgeClassName="h-10 w-auto sm:h-11" />
                        </div>
                        <div className="flex gap-4">
                            {settings?.facebook && (
                                <a
                                    href={settings.facebook}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full bg-white/15 p-2 text-white transition-all hover:bg-white/25 active:scale-95"
                                >
                                    <Facebook size={18} />
                                </a>
                            )}
                            {settings?.twitter && (
                                <a
                                    href={settings.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full bg-white/15 p-2 text-white transition-all hover:bg-white/25 active:scale-95"
                                >
                                    <Twitter size={18} />
                                </a>
                            )}
                            {settings?.instagram && (
                                <a
                                    href={settings.instagram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full bg-white/15 p-2 text-white transition-all hover:bg-white/25 active:scale-95"
                                >
                                    <Instagram size={18} />
                                </a>
                            )}
                            {settings?.youtube && (
                                <a
                                    href={settings.youtube}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full bg-white/15 p-2 text-white transition-all hover:bg-white/25 active:scale-95"
                                >
                                    <Youtube size={18} />
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="sm:pt-4">
                        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white md:mb-6 md:text-lg md:font-black md:uppercase md:tracking-widest">
                            <span className="hidden h-1 w-4 rounded-full bg-white md:block" />
                            Quick Links
                        </h3>
                        <ul className="space-y-2 md:space-y-3">
                            {[
                                ['/', 'Home'],
                                ['/about', 'About Us'],
                                ['/categories', 'Shop'],
                                ['/blogs', 'Blogs'],
                                ['/support', 'Contact'],
                            ].map(([to, label]) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="group flex items-center text-sm text-white/95 hover:text-white md:text-base md:font-semibold"
                                    >
                                        <span className="hidden h-px w-0 bg-white transition-all group-hover:mr-2 group-hover:w-4 md:block" />
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="sm:pt-4">
                        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white md:mb-6 md:text-lg md:font-black md:uppercase md:tracking-widest">
                            <span className="hidden h-1 w-4 rounded-full bg-white md:block" />
                            Categories
                        </h3>
                        <ul className="space-y-2 md:space-y-3">
                            {[
                                ['/category/fruits-vegetables', 'Fruits & Vegetables'],
                                ['/category/dairy-products', 'Dairy Products'],
                                ['/category/meat-fish', 'Meat & Fish'],
                                ['/category/bakery-snacks', 'Bakery & Snacks'],
                                ['/category/beverages', 'Beverages'],
                            ].map(([to, label]) => (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className="group flex items-center text-sm text-white/95 hover:text-white md:text-base md:font-semibold"
                                    >
                                        <span className="hidden h-px w-0 bg-white transition-all group-hover:mr-2 group-hover:w-4 md:block" />
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="sm:pt-4">
                        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white md:mb-6 md:text-lg md:font-black md:uppercase md:tracking-widest">
                            <span className="hidden h-1 w-4 rounded-full bg-white md:block" />
                            Contact Us
                        </h3>
                        <ul className="space-y-3 md:space-y-5">
                            <li className="group flex items-start gap-3 md:gap-4">
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white md:flex">
                                    <MapPin size={20} />
                                </div>
                                <MapPin className="mt-0.5 shrink-0 md:hidden" size={16} />
                                <span className="text-sm font-medium text-white md:pt-1 md:text-base">
                                    {settings?.address || '—'}
                                </span>
                            </li>
                            <li className="group flex items-center gap-3 md:gap-4">
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white md:flex">
                                    <Phone size={20} />
                                </div>
                                <Phone className="shrink-0 md:hidden" size={16} />
                                <span className="text-sm font-medium text-white md:text-base">
                                    {settings?.supportPhone || '—'}
                                </span>
                            </li>
                            <li className="group flex items-center gap-3 md:gap-4">
                                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white md:flex">
                                    <Mail size={20} />
                                </div>
                                <Mail className="shrink-0 md:hidden" size={16} />
                                <span className="text-sm font-medium text-white md:text-base">
                                    {settings?.supportEmail || '—'}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 border-t border-white/15 pt-6 text-center text-xs md:mt-16 md:flex md:justify-between md:pt-8 md:text-left">
                    <p className="text-xs text-white/70 md:text-sm">
                        &copy; {new Date().getFullYear()} {settings?.appName || 'App'}. All rights reserved.
                    </p>
                    <div className="mt-4 flex justify-center gap-4 md:mt-0 md:justify-end md:gap-8">
                        <Link to="/privacy" className="text-xs text-white/70 transition-all hover:text-white md:text-sm">
                            Privacy Policy
                        </Link>
                        <Link to="/terms" className="text-xs text-white/70 transition-all hover:text-white md:text-sm">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
