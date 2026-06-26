import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Search, ShoppingCart, Mic, User } from 'lucide-react';
import { brandColor, brandLogo, NAVBAR_LOGO_CLASS } from '../../constants/brandTheme';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';
import { useLocation as useAppLocation } from '../../context/LocationContext';

const HomeReviewHeader = ({ outlet, onLocationClick, className = '' }) => {
    const navigate = useNavigate();
    const [isListening, setIsListening] = useState(false);
    const { user } = useAuth();
    const { settings } = useSettings();
    const primary = brandColor(settings);
    const logoUrl = brandLogo(settings);
    const firstName = user?.name ? user.name.split(' ')[0] : 'Guest';
    const { currentLocation } = useAppLocation();

    const startVoiceSearch = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Your browser does not support voice search. Please try using Google Chrome.');
            return;
        }

        setIsListening(true);
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setIsListening(false);
            if (transcript) {
                navigate(`/search?q=${encodeURIComponent(transcript)}`);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            setIsListening(false);
        }
    };

    return (
        <header className={`sticky top-0 z-40 bg-white border-b border-slate-100 md:hidden ${className}`}>
            <div className="px-4 pt-3 pb-3 max-w-lg mx-auto md:max-w-3xl">
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="flex h-11 min-w-0 flex-1 items-center justify-start border-0 bg-transparent p-0"
                        aria-label="Home"
                    >
                        <img
                            src={logoUrl}
                            alt={settings?.appName || 'Logo'}
                            className={NAVBAR_LOGO_CLASS}
                        />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-1.5 h-10 px-3 rounded-full bg-slate-50 border border-slate-200 text-slate-700 active:scale-95 transition-transform shrink-0"
                        aria-label="Profile"
                    >
                        <User size={16} className="text-slate-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[60px]">{firstName}</span>
                    </button>
                </div>

                <div className="mt-2 min-w-0">
                    <button
                        type="button"
                        onClick={onLocationClick}
                        className="flex w-full items-center gap-1 text-left group"
                    >
                        <MapPin size={16} className="shrink-0" style={{ color: primary }} />
                        <span className="text-sm font-bold text-slate-900 truncate">
                            {user?.businessName || (currentLocation?.name !== 'Please select your location' ? currentLocation?.name : (currentLocation?.city || outlet?.city || 'Guest Outlet'))}
                        </span>
                        <ChevronDown size={16} className="text-slate-500 shrink-0 group-hover:text-slate-800" />
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/search')}
                        className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-400"
                    >
                        <Search size={18} className="shrink-0" />
                        <span className="text-sm font-medium truncate">
                            Search &apos;Paneer Patty&apos;
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={startVoiceSearch}
                        className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 active:scale-95 transition-transform"
                        style={{ color: primary }}
                        aria-label="Voice Search"
                    >
                        <Mic size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/cart')}
                        className="h-11 w-11 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-700"
                        aria-label="Cart"
                    >
                        <ShoppingCart size={20} />
                    </button>
                </div>
            </div>

            {isListening && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
                    <div className="bg-white rounded-[2rem] p-8 flex flex-col items-center gap-6 shadow-2xl max-w-[85vw] w-72 animate-in zoom-in-95 duration-200">
                        <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-red-50">
                            <div className="absolute inset-0 animate-ping rounded-full opacity-25" style={{ animationDuration: '1.5s', backgroundColor: primary }} />
                            <div className="absolute inset-2 animate-pulse rounded-full" style={{ backgroundColor: `${primary}22` }} />
                            <Mic size={48} className="z-10" style={{ color: primary }} />
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Listening...</h3>
                            <p className="text-sm font-medium text-slate-500">Speak what you want to order</p>
                        </div>
                        <button
                            type="button"
                            className="mt-2 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold active:scale-95 transition-all"
                            onClick={() => setIsListening(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
};

export default HomeReviewHeader;
