# PacknPure Pickup Partner — Phase 2 Validation Report

**Date:** July 22, 2026  
**Build:** ✅ `vite build` passed  
**Scope:** Dynamic integration using existing backend APIs only

---

## 1. Module Boundary Compliance

### Modified / Added (Pickup module only)

```
frontend/src/modules/pickup/
├── components/AssignmentCard.jsx          (new)
├── components/InAppNavMap.jsx             (distance/ETA props)
├── hooks/usePickupAssignments.js          (new)
├── hooks/useLiveLocation.js               (new)
├── hooks/usePickupProfile.js              (new)
├── hooks/useAssignmentActions.js          (new)
├── pages/Auth.jsx
├── pages/Dashboard.jsx
├── pages/Profile.jsx
├── utils/assignmentUtils.js               (new)
├── utils/workflowPhases.js                (new)
└── PHASE2_VALIDATION.md                   (new)
```

### Untouched

| Area | Modified? |
|------|-----------|
| `pickupApi.js` | ❌ No (read-only) |
| Admin / Seller / Customer / Delivery | ❌ No |
| `src/core` | ❌ No |
| `src/shared` | ❌ No |
| Backend / APIs / DB / Sockets | ❌ No |

---

## 2. Hardcoded Data Removed

| Before | After |
|--------|-------|
| Hub coords `22.7196, 75.8577` | `getHubLocation()` from `VITE_HUB_*` env (mirrors backend `HUB_LOCATION_*`) |
| Local `flowById` step machine | `deriveWorkflowPhase()` from API fields |
| Client-only image state | Hydrated from `pickupProof` / `hubDropProof` |
| Hardcoded KYC "SOP Verified" | `profile.status` + `profile.isActive` from API |
| Static profile wallet | `profile.walletBalance` from API |
| Cancel body `notes` | Fixed to `reason` (matches backend contract) |
| Stats from filtered rows only | Computed from live assignment API response |

---

## 3. API Integration Map

| Feature | API | Status |
|---------|-----|--------|
| Login OTP | `POST /pickup-partner/send-login-otp` | ✅ |
| Verify login | `POST /pickup-partner/verify-otp` | ✅ |
| Profile | `GET/PUT /pickup-partner/my/profile` | ✅ |
| Assignments | `GET /pickup-partner/my/assignments` | ✅ |
| Reached seller | `POST .../reached-seller` | ✅ |
| Generate OTP | `POST .../generate-otp` | ✅ |
| Verify OTP | `POST .../verify-pickup-otp` | ✅ |
| Live location | `POST /pickup-partner/my/location` | ✅ |
| Mark picked | `POST .../mark-picked` | ✅ |
| Hub delivered | `POST .../mark-hub-delivered` | ✅ |
| Cancel | `POST .../cancel` | ✅ |
| Proof upload | `POST /pickup-partner/my/proofs/upload` | ✅ |
| Withdrawals | `GET/POST /pickup-partner/my/withdrawals` | ✅ |

---

## 4. Dynamic Assignment Fields Rendered

From `getMyPickupAssignments` response:

- `requestId`, `orderId`, `status`
- `vendor.name`, `vendor.location` (map)
- `products[]` — name, sku, weight, unit, qty, productId
- `pickupOtpGenerated`, `pickupOtpVerified`, `pickupOtpExpiresAt`
- `reachedSellerAt`, `pickupProof`, `hubDropProof`
- `eta`, `dates`, `timeline`
- `notes`, `pickupAssignedAt`, `createdAt`

**Computed client-side (from API coordinates):**
- Distance (haversine between partner GPS and target)
- ETA display from `row.eta`

---

## 5. Workflow Engine

Phases derived from backend state — never hardcoded:

```
ASSIGNED → NAVIGATING → PHOTO_CAPTURE → OTP_GENERATED →
OTP_VERIFIED → PICKED → HUB_NAVIGATING → COMPLETED
```

**Drivers:**
- `status` (`pickup_assigned`, `picked`, `hub_delivered`)
- `reachedSellerAt` / `pickupProof.reachedSellerAt`
- `pickupOtpGenerated`, `pickupOtpVerified`
- UI-only: `navigating` (sessionStorage per assignment)

**Single-action UI:** `AssignmentCard` renders only the current phase action.

---

## 6. UX / Reliability

| Requirement | Implementation |
|-------------|----------------|
| Loading / skeleton | `usePickupAssignments` + skeleton components |
| Error + retry | `PickupErrorState`, `getApiErrorMessage` |
| Auto-refresh | 15s poll + refresh after every mutation |
| Duplicate prevention | `inFlightRef` guard on all actions |
| GPS errors | `useLiveLocation` with permission/unavailable messages |
| Offline | `navigator.onLine` check in error helper |
| OTP expired | `pickupOtpExpiresAt` check with UI warning |
| Image hydration | Parse `VENDOR_IMAGES:` from `pickupProof.notes` |
| Memoization | `AssignmentCard` wrapped in `React.memo` |

---

## 7. Known Backend API Limitations (Not Changed)

These fields are **not returned** by existing profile/assignment APIs:

- Partner `address` on GET profile (PUT accepts it; GET omits it)
- Seller street address (only `vendor.location` coordinates)
- Hub coordinates in assignment payload (use `VITE_HUB_LOCATION_*` env aligned with backend)
- `isVerified` on profile GET (status/isActive used instead)

No backend changes were made per Phase 2 scope.

---

## 8. Final Checklist

- [x] Only Pickup module changed
- [x] No new APIs created
- [x] No API contracts modified
- [x] All assignment UI driven by API response
- [x] Workflow state-driven from backend fields
- [x] Profile & withdrawals fully dynamic
- [x] Timeline from `row.timeline` (backend `buildPrTimeline`)
- [x] Map uses live GPS + vendor/hub coordinates
- [x] Photo upload connected to proof API
- [x] OTP generate/verify connected
- [x] Production build passes
