# PacknPure Pickup Partner — Phase 1 UI Audit Report

**Date:** July 22, 2026  
**Scope:** `frontend/src/modules/pickup/` (11 original files)  
**Phase:** UI, UX, Responsiveness only — no API/backend/business logic changes

---

## Executive Summary

The Pickup Partner app was a compact 11-file module with inline Tailwind styling, no design system, and several responsive and UX gaps. This audit covered all 3 screens, 4 components, 1 layout, and 1 route file before Phase 1 implementation.

---

## 1. Screen Inventory

| Screen | Route | File | Purpose |
|--------|-------|------|---------|
| Auth | `/pickup/auth` | `pages/Auth.jsx` | OTP login (phone → OTP) |
| Dashboard | `/pickup/dashboard` | `pages/Dashboard.jsx` | Task center, workflow, maps |
| Profile | `/pickup/profile` | `pages/Profile.jsx` | Partner profile, wallet, withdrawals |

**Dashboard workflow steps (in-page):** Navigate → Arrive → Photos → Generate OTP → Verify OTP → Confirm → Hub delivery

---

## 2. Responsive Issues (Pre-Phase 1)

### Auth
| Issue | Severity | Detail |
|-------|----------|--------|
| Excessive card padding | Medium | `p-10` caused cramped content on 320–375px |
| Decorative blur overflow | Low | Absolute `-10%` positioned blurs risked horizontal scroll |
| OTP input overflow | Medium | `tracking-[0.5em]` on single input clipped on narrow screens |
| No safe-area support | High | Missing `env(safe-area-inset-*)` for notched devices |
| No landscape handling | Medium | Centered layout wasted vertical space in landscape |

### Dashboard
| Issue | Severity | Detail |
|-------|----------|--------|
| Inconsistent max-width | Low | Header `max-w-6xl` vs main `max-w-2xl` |
| Bottom padding mismatch | High | `pb-24` didn't account for floating nav + safe area |
| Stats label clipping | Medium | `text-[9px]` labels truncated on 320px |
| SlideToAction fixed travel | **Critical** | `maxTravel = 220px` broke on all non-220px track widths |
| Map border waste | Medium | `border-4` consumed ~32px on narrow screens |
| Coordinate text overflow | Medium | Long lat/lng strings overflowed without `break-all` |
| Product row wrap | Low | Qty controls wrapped awkwardly on 320px |
| OTP input tracking | Medium | `tracking-[0.5em]` caused horizontal overflow |
| Duplicate CTA | Low | Slide + button both for "reached seller" |

### Profile
| Issue | Severity | Detail |
|-------|----------|--------|
| Wallet amount overflow | Medium | `text-4xl` with large balances could clip |
| Invalid Tailwind class | Low | `flex-2` is not a valid utility |
| Header safe-area | High | `pt-12` ignored notch/inset |
| Modal safe-area | Medium | Bottom sheet lacked inset padding |
| Fixed max-width | Low | `max-w-md` with `px-6` tight on 320px |

### PickupLayout
| Issue | Severity | Detail |
|-------|----------|--------|
| Nav safe-area | **Critical** | `pb-6` ignored home indicator on iOS |
| Active bubble clipping | Low | `-top-10` indicator could clip above nav bar |
| Touch targets | Medium | Nav items below 48px minimum on some breakpoints |
| Content padding | High | `pb-20` insufficient for floating nav height |

---

## 3. Layout & Overflow

- **Horizontal scroll risk:** Decorative absolute elements in Auth; long unbroken strings in map fallback
- **Card clipping:** Rounded corners with `overflow-hidden` hid step indicator on small screens
- **Sticky header:** Dashboard header worked but lacked safe-top padding
- **Bottom nav overlap:** Primary action buttons could sit under floating nav on short viewports

---

## 4. Typography

| Area | Issue |
|------|-------|
| Label sizes | Inconsistent: `8px`, `9px`, `10px` used interchangeably |
| Hierarchy | All-caps + wide tracking reduced readability on small screens |
| OTP fields | Oversized tracking caused character spill |
| Body text | Mix of `font-bold`, `font-black`, `font-semibold` without system |

---

## 5. Button Consistency

- **Variants:** slate-900 primary everywhere; no semantic colors per action type
- **Sizes:** Mix of `py-3`, `py-3.5`, `py-4` without scale
- **Loading states:** Text swap only ("SENDING CODE...") — no spinner
- **Touch targets:** Icon buttons in header were 36px (`p-2` + 18px icon) — below 44px guideline
- **Disabled states:** Opacity-only, no visual distinction beyond fade

---

## 6. Navigation

- Bottom nav: 2 routes + non-functional Alerts button
- Logout duplicated in Dashboard header and Profile
- No page transition animations between routes
- Auth correctly hides bottom nav

---

## 7. Component-Specific Findings

### Cards
- White cards with mixed border radii (`24px`, `28px`, `32px`, `40px`)
- Step sections used different tinted backgrounds without unified system
- No elevation scale

### Image Upload (`ParcelPhotoCapture`)
- 2-col grid on mobile acceptable; action buttons at 9px too small
- No image load placeholder/skeleton
- Touch targets on Retake/Replace below 44px
- Upload progress bar functional but minimal styling

### Map (`InAppNavMap`)
- Fixed `h-56` didn't adapt to landscape
- No lazy loading or error fallback for static map image
- Overlay text at 8px failed accessibility minimums
- Heavy `border-4` + `shadow-2xl` visually heavy for mobile

### Timeline
- Used shared `PurchaseRequestTimeline` — indigo accent didn't match pickup palette
- No pickup-specific styling without modifying shared component

### Stepper
- No visual step indicator; only text labels "Step 1 · Navigate" etc.
- User couldn't see overall progress at a glance

### Slider (`SlideToAction`)
- **Critical:** Fixed 220px max travel broke on all screen sizes
- No ResizeObserver; no responsive recalculation
- Label text could overlap thumb on narrow tracks

### OTP UI
- Auth: single input with wide letter-spacing
- Dashboard: icon + input with `tracking-[0.5em]` — poor mobile UX
- No segmented OTP boxes
- Resend button in Auth had no handler wired

---

## 8. States

| State | Before | Gap |
|-------|--------|-----|
| Loading | "Loading assignments..." text only | No skeleton loaders |
| Empty | Basic icon + text | No illustration hierarchy |
| Error | Toast only | No inline error recovery UI |
| Image loading | None | Flash of empty frame |

---

## 9. Accessibility

- Missing `aria-label` on icon-only buttons (refresh, logout)
- OTP inputs lacked `inputMode="numeric"` in Auth
- Slide control had `aria-label` but no keyboard alternative
- Color contrast: `text-slate-400` on `bg-slate-50` borderline on 10px text
- Focus rings inconsistent across inputs

---

## 10. Code Duplication

| Duplication | Location |
|-------------|----------|
| Button styles | Repeated across Auth, Dashboard, Profile |
| Card wrappers | Inline rounded/border/shadow patterns |
| Input styles | Duplicated in Auth, Profile, Dashboard |
| Step section pattern | 6 similar tinted boxes in Dashboard |
| Modal vs sheet | Profile withdrawal used custom modal markup |
| Timeline | Imported shared component instead of pickup-specific |

---

## 11. Shared Dependencies (Not Modified)

| Import | Path | Action Taken |
|--------|------|--------------|
| `PurchaseRequestTimeline` | `@shared/components/` | Replaced with pickup-specific `PickupTimeline` |
| `formatPrDate` | `@shared/utils/` | Kept (utility only, no UI) |
| `useAuth` | `@core/context/` | Kept (auth infrastructure) |
| `pickupApi` | Module service | Kept unchanged |

---

## 12. Priority Matrix

| Priority | Items |
|----------|-------|
| P0 | SlideToAction responsive travel, safe-area insets, bottom nav overlap |
| P1 | Skeleton loaders, OTP segmented input, step indicator, cancel sheet |
| P2 | Design system, button/input/card components, typography scale |
| P3 | Page transitions, image placeholders, error states |

---

## 13. Phase 1 Resolution Summary

All P0–P2 items addressed. See `PHASE1_VALIDATION.md` for implementation verification.
