import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  MapPin,
  Search,
  ShoppingCart,
  Heart,
  User,
  Mic,
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandLogo, NAVBAR_LOGO_CLASS } from '../../constants/brandTheme';
import { useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useLocation as useAppLocation } from '../../context/LocationContext';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/categories', label: 'Shop' },
  { to: '/offers', label: 'Offers' },
  { to: '/about', label: 'About' },
  { to: '/support', label: 'Support' },
];

const HomeDesktopNavbar = ({
  deliveryLabel,
  outlet,
  onLocationClick,
  className,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { currentLocation } = useAppLocation();
  const [isListening, setIsListening] = useState(false);

  const appName = settings?.appName || 'Pack & Pure';
  const logoUrl = brandLogo(settings);
  const primary = brandColor(settings);
  const firstName = user ? (user.name ? user.name.split(' ')[0] : 'User') : 'Guest';

  const startVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      navigate('/search');
      return;
    }
    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      if (transcript) navigate(`/search?q=${encodeURIComponent(transcript)}`);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-md md:block',
          className,
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3 lg:px-8">
          <div className="flex shrink-0 flex-col gap-1.5">
            <Link to="/" className="block w-fit">
              <img
                src={logoUrl}
                alt={appName}
                className={NAVBAR_LOGO_CLASS}
              />
            </Link>
            <button
              type="button"
              onClick={onLocationClick}
              className="flex min-w-0 max-w-[220px] flex-col items-start rounded-lg px-0.5 py-0.5 text-left transition-colors hover:opacity-80"
            >

              <span className="flex w-full items-center gap-1 text-sm font-bold text-slate-900">
                <MapPin size={14} style={{ color: primary }} className="shrink-0" />
                <span className="truncate font-bold text-slate-900">
                  {user?.businessName || (currentLocation?.name !== 'Please select your location' ? currentLocation?.name : (currentLocation?.city || outlet?.city || 'Guest Outlet'))}
                </span>
                <ChevronDown size={14} className="shrink-0 text-slate-400" />
              </span>
            </button>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive =
                location.pathname === to ||
                (to !== '/' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'text-white' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600',
                  )}
                  style={isActive ? { backgroundColor: primary } : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 lg:max-w-md xl:max-w-lg">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-left text-slate-400 transition-colors hover:border-brand-200 hover:bg-white focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100"
            >
              <Search size={18} className="shrink-0" />
              <span className="truncate text-sm font-medium">
                Search groceries, dairy, snacks…
              </span>
            </button>
            <button
              type="button"
              onClick={startVoiceSearch}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50/50 transition-colors hover:border-brand-300"
              aria-label="Voice search"
              style={{ color: primary }}
            >
              <Mic size={20} />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/wishlist')}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-50"
              aria-label="Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-50"
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="ml-1 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 transition-colors hover:bg-white"
            >
              <User size={18} className="text-slate-500" />
              <span className="hidden max-w-[72px] truncate sm:inline">{firstName}</span>
            </button>
          </div>
        </div>
      </header>

      {isListening && (
        <div className="fixed inset-0 z-[100] hidden items-center justify-center bg-black/60 backdrop-blur-sm md:flex">
          <div className="flex w-80 flex-col items-center gap-6 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-brand-50">
              <div
                className="absolute inset-0 animate-ping rounded-full opacity-25"
                style={{ backgroundColor: primary }}
              />
              <Mic size={48} style={{ color: primary }} />
            </div>
            <div className="space-y-1 text-center">
              <h3 className="text-2xl font-black text-slate-800">Listening…</h3>
              <p className="text-sm text-slate-500">Say what you want to order</p>
            </div>
            <button
              type="button"
              className="w-full rounded-2xl bg-slate-100 py-3.5 font-bold text-slate-700 hover:bg-slate-200"
              onClick={() => setIsListening(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default HomeDesktopNavbar;
