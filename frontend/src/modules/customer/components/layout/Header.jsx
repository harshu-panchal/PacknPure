import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Heart, User, Menu, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useLocation as useAppLocation } from "../../context/LocationContext";
import { useSettings } from '@core/context/SettingsContext';
import { brandLogo, NAVBAR_LOGO_CLASS } from '../../constants/brandTheme';
import LocationDrawer from '../shared/LocationDrawer';
import HomeDesktopNavbar from '../home/HomeDesktopNavbar';
import { STATIC_DELIVERY_LABEL, STATIC_OUTLET } from '../../constants/homeStaticData';

const Header = ({ showMobile = true, showDesktop = true }) => {
    const { settings } = useSettings();
    const logoUrl = brandLogo(settings);
    const appName = settings?.appName || 'App';
    const { count: wishlistCount } = useWishlist();
    const { cartCount } = useCart();
    const [isLocationOpen, setIsLocationOpen] = useState(false);
    const { currentLocation, refreshLocation } = useAppLocation();
    const location = useLocation();


    return (
        <>
            {showDesktop && (
                <div className="hidden md:block">
                    <HomeDesktopNavbar
                        deliveryLabel={STATIC_DELIVERY_LABEL}
                        outlet={STATIC_OUTLET}
                        onLocationClick={() => {
                            refreshLocation();
                            setIsLocationOpen(true);
                        }}
                    />
                </div>
            )}

            {showMobile && (
                <header className="absolute top-4 md:top-8 left-0 right-0 z-[200] px-4 md:hidden">
                    <div className="container mx-auto max-w-6xl">
                        {/* Mobile Top Row: Location & Profile */}
                        <div className="md:hidden flex items-center justify-between mb-4 px-2 animate-in slide-in-from-top duration-500">
                            <button
                                type="button"
                                data-lenis-prevent
                                data-lenis-prevent-touch
                                onClick={() => {
                                    refreshLocation();
                                    setIsLocationOpen(true);
                                }}
                                className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform border-0 bg-transparent p-0 text-left"
                            >
                                <div className="h-10 w-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-sm">
                                    <MapPin size={22} className="text-white fill-current" />
                                </div>
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[10px] font-black text-white/80 uppercase tracking-widest flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                        {currentLocation.time}
                                    </span>
                                    <div className="flex items-center gap-1 font-black text-white text-base">
                                        <span className="max-w-[150px] truncate">{currentLocation.name}</span> <span className="text-[10px] opacity-70">▼</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Location Selection Drawer */}
            <LocationDrawer
                isOpen={isLocationOpen}
                onClose={() => setIsLocationOpen(false)}
            />
        </>
    );
};

export default Header;
