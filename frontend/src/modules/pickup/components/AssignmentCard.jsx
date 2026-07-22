import React, { memo, useMemo } from "react";
import {
  CheckCircle,
  Store,
  KeyRound,
  Navigation,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatPrDate } from "@shared/utils/purchaseRequestFormat";
import ParcelPhotoCapture from "./ParcelPhotoCapture";
import SlideToAction from "./SlideToAction";
import InAppNavMap from "./InAppNavMap";
import {
  PickupCard,
  PickupButton,
  PickupInput,
  PickupBadge,
  PickupTimeline,
  PickupStepIndicator,
} from "./ui";
import {
  toLatLng,
  distanceMeters,
  formatDistance,
  formatEta,
  isOtpExpired,
  statusLabel,
} from "../utils/assignmentUtils";
import OtpCountdown from "./OtpCountdown";
import { enrichTimeline } from "../utils/enrichTimeline";
import {
  WORKFLOW_PHASE,
  WORKFLOW_STEPS,
  deriveWorkflowPhase,
  getWorkflowStepIndex,
  shouldShowMap,
  getNextActionLabel,
} from "../utils/workflowPhases";

const AssignmentCard = function AssignmentCard({
  row,
  draft,
  partnerLoc,
  hubLoc,
  hubAddress,
  actionLoadingId,
  uploadingId,
  uploadProgress,
  onNavigate,
  onMarkReached,
  onAddVendorImages,
  onReplaceVendorImage,
  onRemoveVendorImage,
  onGenerateOtp,
  onVerifyOtp,
  onConfirmPickup,
  onCancel,
  onAddHubImages,
  onReplaceHubImage,
  onRemoveHubImage,
  onMarkHubDelivered,
  mapStops,
  onAccept,
  onHubReached,
  onOtpExpired,
  onPatchDraft,
}) {
  const vendorLoc = useMemo(() => toLatLng(row.vendor?.location), [row.vendor?.location]);
  const isPickedPhase = row.status === "picked";
  const isHubTarget = isPickedPhase || row.status === "hub_delivered";

  const targetLoc = isHubTarget ? hubLoc : vendorLoc;

  const phase = deriveWorkflowPhase(row, draft);
  const enrichedTimeline = useMemo(() => enrichTimeline(row, draft), [row, draft]);

  const stepIndex = getWorkflowStepIndex(phase);
  const showMap = shouldShowMap(phase);
  const distance = partnerLoc && targetLoc ? distanceMeters(partnerLoc, targetLoc) : null;
  const etaText = formatEta(row.eta || row.dates?.eta);
  const otpExpired =
    row.pickupOtpGenerated &&
    !row.pickupOtpVerified &&
    isOtpExpired(row.pickupOtpExpiresAt);

  const renderCurrentAction = () => {
    switch (phase) {
      case WORKFLOW_PHASE.PENDING_ACCEPT:
        return (
          <PickupCard variant="tinted" padding="sm" className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">
              New assignment
            </p>
            <p className="text-xs text-slate-600">
              Review details and accept to begin pickup from {row.vendor?.name || "seller"}.
            </p>
            <PickupButton size="sm" fullWidth onClick={() => onAccept?.(row)}>
              Accept assignment
            </PickupButton>
          </PickupCard>
        );

      case WORKFLOW_PHASE.ASSIGNED:
        return (
          <PickupCard variant="tinted" padding="sm" className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">
              Navigate to seller
            </p>
            <PickupButton size="sm" icon={Navigation} onClick={() => onNavigate(row)} fullWidth>
              Start navigation
            </PickupButton>
          </PickupCard>
        );

      case WORKFLOW_PHASE.NAVIGATING:
        return (
          <PickupCard padding="sm" className="space-y-3 border-amber-100 bg-amber-50/80">
            <p className="text-xs font-semibold text-slate-600">
              Follow the route. When you arrive at the seller, slide to confirm.
            </p>
            <SlideToAction
              label="Slide · Reached seller"
              colorClass="bg-amber-600"
              loading={actionLoadingId === `${row._id}:reached`}
              onConfirm={() => onMarkReached(row)}
            />
          </PickupCard>
        );

      case WORKFLOW_PHASE.PHOTO_CAPTURE:
        return (
          <PickupCard padding="sm" className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Parcel photos
            </p>
            <ParcelPhotoCapture
              images={draft.vendorImages}
              uploading={uploadingId === row._id}
              uploadProgress={uploadProgress}
              onAddFiles={(files, source) => onAddVendorImages(row._id, files, source)}
              onRemove={(index) => onRemoveVendorImage(row._id, index)}
              onReplace={(index, file, source) =>
                onReplaceVendorImage(row._id, index, file, source)
              }
            />
            {draft.vendorImages.length > 0 && !row.pickupOtpGenerated && (
              <SlideToAction
                label="Slide to generate OTP"
                colorClass="bg-indigo-600"
                loading={actionLoadingId === `${row._id}:otp`}
                onConfirm={() => onGenerateOtp(row)}
              />
            )}
          </PickupCard>
        );

      case WORKFLOW_PHASE.OTP_GENERATED:
        return (
          <PickupCard padding="sm" className="space-y-3 border-violet-100 bg-violet-50/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
              Verify OTP
            </p>
            {otpExpired ? (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} />
                OTP expired — generate a new one after re-uploading photos.
              </div>
            ) : (
              <>
                <OtpCountdown
                  expiresAt={row.pickupOtpExpiresAt}
                  onExpired={() => onOtpExpired?.(row)}
                />
                <p className="text-xs font-medium text-slate-600">
                  Ask the seller for the OTP.
                </p>
                <div className="relative">
                  <KeyRound
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Seller OTP"
                    aria-label="Seller OTP"
                    value={draft.otp}
                    onChange={(e) =>
                      onPatchDraft(row._id, {
                        otp: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    className="w-full min-w-0 rounded-2xl border-none bg-white py-3 pl-10 pr-4 text-sm font-black tracking-[0.35em] text-slate-900 placeholder:tracking-normal placeholder:text-slate-300 focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <PickupButton
                  fullWidth
                  onClick={() => onVerifyOtp(row)}
                  disabled={
                    actionLoadingId === `${row._id}:verify` ||
                    String(draft.otp || "").length < 4 ||
                    otpExpired
                  }
                  loading={actionLoadingId === `${row._id}:verify`}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  Verify OTP
                </PickupButton>
              </>
            )}
          </PickupCard>
        );

      case WORKFLOW_PHASE.OTP_VERIFIED:
        return (
          <PickupCard padding="sm" className="space-y-2 border-emerald-100 bg-emerald-50/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Confirm pickup
            </p>
            <SlideToAction
              label="Slide to confirm pickup"
              colorClass="bg-slate-900"
              loading={actionLoadingId === `${row._id}:confirm`}
              onConfirm={() => onConfirmPickup(row)}
            />
          </PickupCard>
        );

      case WORKFLOW_PHASE.PICKED:
        return (
          <PickupCard variant="tinted" padding="sm" className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">
              Navigate to hub
            </p>
            {hubAddress && (
              <p className="text-xs font-medium text-slate-600">{hubAddress}</p>
            )}
            <PickupButton size="sm" icon={Navigation} onClick={() => onNavigate(row)} fullWidth>
              Start hub navigation
            </PickupButton>
          </PickupCard>
        );

      case WORKFLOW_PHASE.HUB_NAVIGATING:
        return (
          <PickupCard padding="sm" className="space-y-3 border-emerald-100 bg-emerald-50/80">
            <p className="text-xs font-semibold text-slate-600">
              Arriving at hub — slide when you reach the drop point.
            </p>
            <SlideToAction
              label="Slide · Reached hub"
              colorClass="bg-emerald-600"
              onConfirm={() => onHubReached?.(row)}
            />
          </PickupCard>
        );

      case WORKFLOW_PHASE.HUB_AT_HUB:
        return (
          <div className="space-y-3">
            <ParcelPhotoCapture
              label="Hub drop photos"
              images={draft.hubImages}
              uploading={uploadingId === row._id}
              uploadProgress={uploadProgress}
              onAddFiles={(files, source) => onAddHubImages(row._id, files, source)}
              onRemove={(index) => onRemoveHubImage(row._id, index)}
              onReplace={(index, file, source) =>
                onReplaceHubImage(row._id, index, file, source)
              }
            />
            <SlideToAction
              label="Slide · Confirm hub delivery"
              colorClass="bg-emerald-600"
              disabled={draft.hubImages.length < 1}
              loading={actionLoadingId === `${row._id}:hub-delivered`}
              onConfirm={() => onMarkHubDelivered(row)}
            />
          </div>
        );

      case WORKFLOW_PHASE.COMPLETED:
        return (
          <div className="rounded-2xl bg-emerald-50 py-3 text-center">
            <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              <CheckCircle size={14} />
              Completed
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      <PickupCard padding="md" className="space-y-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Store size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">
              {row.vendor?.name || "Seller"}
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {row.requestId}
              {row.orderId ? ` · Order ${String(row.orderId).slice(-6)}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PickupBadge variant="info">{statusLabel(row.status)}</PickupBadge>
              <PickupBadge variant="warning">{getNextActionLabel(phase)}</PickupBadge>
              {(row.pickupAssignedAt || row.createdAt) && (
                <span className="text-[10px] font-medium text-slate-400">
                  {formatPrDate(row.pickupAssignedAt || row.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {distance != null && (
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Distance
              </p>
              <p className="text-xs font-black text-slate-800">{formatDistance(distance)}</p>
            </div>
          )}
          {etaText && (
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">ETA</p>
              <p className="flex items-center gap-1 text-xs font-black text-slate-800">
                <Clock size={12} />
                {etaText}
              </p>
            </div>
          )}
          {row.vendor?.location && (
            <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2 sm:col-span-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Seller
              </p>
              <p className="flex items-center gap-1 truncate text-[10px] font-semibold text-slate-600">
                <MapPin size={10} className="shrink-0" />
                On map
              </p>
            </div>
          )}
        </div>

        {row.status === "pickup_assigned" && (
          <PickupStepIndicator steps={WORKFLOW_STEPS.slice(0, 6)} currentStep={stepIndex} />
        )}

        {showMap && targetLoc && (
          <InAppNavMap
            partnerLoc={partnerLoc}
            targetLoc={targetLoc}
            targetLabel={isHubTarget ? hubAddress || "HUB" : row.vendor?.name || "SHOP"}
            distance={formatDistance(distance)}
            eta={etaText}
            stops={mapStops}
            phaseLabel={
              phase === WORKFLOW_PHASE.NAVIGATING
                ? "En route to seller"
                : phase === WORKFLOW_PHASE.HUB_NAVIGATING
                  ? "En route to hub"
                  : undefined
            }
          />
        )}

        {(row.products || []).length > 0 && row.status === "pickup_assigned" && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Products
            </h4>
            {row.products.map((p) => (
              <div
                key={String(p.productId)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">
                    {p.name || "Product"}
                  </p>
                  {(p.sku || p.weight || p.unit) && (
                    <p className="truncate text-[10px] text-slate-400">
                      {[p.sku, p.weight && `${p.weight}${p.unit || ""}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-slate-400">Qty {p.qty}</span>
                  {phase !== WORKFLOW_PHASE.COMPLETED && (
                    <input
                      type="number"
                      min="0"
                      max={p.qty}
                      aria-label={`Picked quantity for ${p.name}`}
                      value={draft.pickedQty?.[String(p.productId)] ?? p.qty}
                      onChange={(e) =>
                        onPatchDraft(row._id, {
                          pickedQty: {
                            ...draft.pickedQty,
                            [String(p.productId)]: Math.min(
                              p.qty,
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            ),
                          },
                        })
                      }
                      className="w-14 rounded-lg border-none bg-white px-2 py-1.5 text-center text-xs font-black ring-1 ring-slate-100"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {row.status === "pickup_assigned" && (
          <PickupInput
            placeholder="Notes (optional)"
            value={draft.notes || ""}
            onChange={(e) => onPatchDraft(row._id, { notes: e.target.value })}
            inputClassName="text-xs font-semibold"
          />
        )}

        {renderCurrentAction()}

        {row.status === "pickup_assigned" && (
          <PickupButton
            variant="ghost"
            fullWidth
            size="sm"
            onClick={() => onCancel(row)}
            disabled={!!actionLoadingId}
            className="text-slate-500"
          >
            Cancel assignment
          </PickupButton>
        )}

        {draft.vendorImages.length > 0 &&
          [WORKFLOW_PHASE.OTP_GENERATED, WORKFLOW_PHASE.OTP_VERIFIED].includes(phase) && (
            <div className="grid grid-cols-4 gap-2">
              {draft.vendorImages.map((img, i) => (
                <img
                  key={`${img.url}-${i}`}
                  src={img.url}
                  alt={`Proof ${i + 1}`}
                  loading="lazy"
                  className="aspect-square rounded-xl border border-slate-100 object-cover"
                />
              ))}
            </div>
          )}

        {enrichedTimeline.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Trip history
            </p>
            <PickupTimeline timeline={enrichedTimeline} compact />
          </div>
        )}
      </PickupCard>
    </motion.div>
  );
}

function propsEqual(prev, next) {
  return (
    prev.row === next.row &&
    prev.draft === next.draft &&
    prev.partnerLoc === next.partnerLoc &&
    prev.hubLoc === next.hubLoc &&
    prev.actionLoadingId === next.actionLoadingId &&
    prev.uploadingId === next.uploadingId &&
    prev.uploadProgress === next.uploadProgress &&
    prev.mapStops === next.mapStops
  );
}

export default memo(AssignmentCard, propsEqual);
