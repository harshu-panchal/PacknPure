import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Package,
  Store,
  Truck,
  Warehouse,
  Leaf,
  Clock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandFooterGradient, brandSoftGradient } from '../../constants/brandTheme';
import { HOME_SECTION } from './homeLayout';

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: 'Set your location',
    desc: 'We match you to the nearest hub and delivery zone for accurate stock and ETA.',
  },
  {
    icon: Store,
    title: 'Browse & order',
    desc: 'Shop daily essentials from our catalog — priced for your area, fulfilled locally.',
  },
  {
    icon: Warehouse,
    title: 'Hub fulfillment',
    desc: 'Orders route to your local hub. If stock runs short, trusted vendors replenish supply.',
  },
  {
    icon: Truck,
    title: 'Packed & delivered',
    desc: 'Fresh items are picked, packed at the hub, and delivered to your door fast.',
  },
];

const PILLARS = [
  {
    icon: Leaf,
    title: 'Fresh & quality-checked',
    desc: 'Hub-stored inventory with careful picking — so what arrives matches what you ordered.',
  },
  {
    icon: Clock,
    title: 'Hyperlocal speed',
    desc: 'Dark-store style fulfillment near you, not shipped from far away warehouses.',
  },
  {
    icon: ShieldCheck,
    title: 'Trusted supply chain',
    desc: 'Local vendors and hub partners power procurement when you need items most.',
  },
];

/**
 * Desktop-only marketing blocks for the landing page (about, how it works, trust).
 */
const HomePlatformSections = ({ onLocationClick }) => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings?.appName || 'Pack & Pure';
  const primary = brandColor(settings);

  return (
    <div className="hidden border-t border-slate-100 bg-white md:block">
      <section className={`${HOME_SECTION} py-14 lg:py-16`}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${primary}14`, color: primary }}
            >
              About {appName}
            </span>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900 lg:text-4xl">
              Hyperlocal groceries,{' '}
              <span style={{ color: primary }}>hub-powered</span> delivery
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              {appName} is built for quick commerce with a real supply chain behind it — local
              hubs hold inventory, orders route to the best nearby fulfillment point, and trusted
              vendors step in when stock needs a top-up. You get Blinkit-style speed with
              Hyperpure-style reliability for daily essentials.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: primary }}
              >
                Start shopping
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                onClick={onLocationClick}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <MapPin size={18} style={{ color: primary }} />
                Change delivery area
              </button>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded-3xl p-8 text-white shadow-xl lg:p-10"
            style={{ background: brandFooterGradient(settings) }}
          >
            <div
              className="absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: primary }}
            />
            <Package className="mb-4 h-10 w-10 opacity-90" style={{ color: primary }} />
            <h3 className="text-xl font-bold">Built for your neighbourhood</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Every order connects to real hub inventory and delivery partners in your zone —
              not a generic marketplace listing from thousands of kilometres away.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {['Hub-based stock & routing', 'Vendor procurement when needed', 'Track orders end-to-end'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: primary }}
                    />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <Link
              to="/about"
              className="mt-6 inline-flex text-sm font-bold text-white/90 underline-offset-4 hover:underline"
            >
              Read more about us →
            </Link>
          </div>
        </div>
      </section>

      <section
        className="py-14 lg:py-16"
        style={{ background: brandSoftGradient(settings) }}
      >
        <div className={HOME_SECTION}>
          <div className="mb-10 text-center md:mb-12">
            <h2 className="text-2xl font-black text-slate-900 lg:text-3xl">How it works</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
              From tap to doorstep — designed around local hubs, vendors, and delivery partners.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span
                  className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white"
                  style={{ backgroundColor: primary }}
                >
                  {i + 1}
                </span>
                <step.icon size={28} className="mb-3 text-slate-700" style={{ color: primary }} />
                <h3 className="font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${HOME_SECTION} py-14 lg:py-16`}>
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-black text-slate-900 lg:text-3xl">Why shop with us</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            The best fit for a hub-first grocery platform — speed, freshness, and local trust.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 text-center md:text-left"
            >
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl md:mx-0"
                style={{ backgroundColor: `${primary}12` }}
              >
                <p.icon size={24} style={{ color: primary }} />
              </div>
              <h3 className="font-bold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePlatformSections;
