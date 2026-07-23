import React, { useCallback, useMemo, useState, Suspense } from "react";
import { useAuth } from "@core/context/AuthContext";
import { toast } from "sonner";
import { Package, CheckCircle, Truck, RefreshCw, Clock } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import AssignmentCard from "../components/AssignmentCard";
import TripOverviewCard from "../components/TripOverviewCard";
import OfflineBanner from "../components/OfflineBanner";
import {
  PickupPageHeader,
  PickupChip,
  PickupCard,
  PickupEmptyState,
  PickupErrorState,
  PickupBottomSheet,
  PickupButton,
  PickupInput,
  AssignmentCardSkeleton,
  StatsSkeleton,
} from "../components/ui";
import { usePickupAssignments } from "../hooks/usePickupAssignments";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { usePickupNotifications } from "../hooks/usePickupNotifications";
import { usePickupAlertContext } from "../context/PickupAlertContext";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import {
  useAssignmentDrafts,
  useAssignmentActions,
} from "../hooks/useAssignmentActions";
import { pickupApi } from "../services/pickupApi";
import { getHubLocation, getHubAddress, toLatLng } from "../utils/assignmentUtils";
import { buildTripPlan, getSellerStopsForMap } from "../utils/tripPlanner";

const CompletionCelebration = React.lazy(
  () => import("../components/CompletionCelebration"),
);

const FILTER_LABELS = {
  active: "Active",
  all: "All",
  hub_delivered: "Done",
};

const Dashboard = () => {
  const { user } = useAuth();
  const { setAlertState } = usePickupAlertContext();
  const [statusFilter, setStatusFilter] = useState("active");
  const [cancelRow, setCancelRow] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [focusMode, setFocusMode] = useState(
    () => localStorage.getItem("pickup_focus_mode") === "1",
  );
  const [focusedAssignmentId, setFocusedAssignmentId] = useState(() => {
    try {
      return sessionStorage.getItem("pickup_active_assignment") || null;
    } catch {
      return null;
    }
  });

  const { rows, loading, refreshing, error, stats, fetchAssignments } =
    usePickupAssignments(statusFilter);

  const { alerts, unreadCount, markAllRead } = usePickupNotifications(rows);
  React.useEffect(() => {
    setAlertState({ alerts, unreadCount, markAllRead });
  }, [alerts, unreadCount, markAllRead, setAlertState]);

  const activeAssignmentId = useMemo(
    () =>
      focusedAssignmentId ||
      rows.find((r) => ["pickup_assigned", "picked"].includes(r.status))?._id ||
      null,
    [rows, focusedAssignmentId],
  );

  // Keep active assignment sticky across refresh when still in-progress
  React.useEffect(() => {
    if (!rows?.length) return;
    let stored = null;
    try {
      stored = sessionStorage.getItem("pickup_active_assignment");
    } catch {
      stored = null;
    }
    const stillActive = stored && rows.some(
      (r) => r._id === stored && ["pickup_assigned", "picked"].includes(r.status),
    );
    if (stillActive) {
      setFocusedAssignmentId(stored);
      return;
    }
    const nextActive = rows.find((r) =>
      ["pickup_assigned", "picked"].includes(r.status),
    )?._id;
    if (nextActive) {
      setFocusedAssignmentId(nextActive);
      try {
        sessionStorage.setItem("pickup_active_assignment", nextActive);
      } catch {
        /* ignore */
      }
    }
  }, [rows]);

  const { liveLoc, gpsError, gpsAccuracy, getCurrentPosition } =
    useLiveLocation(activeAssignmentId);
  const hubLoc = useMemo(() => getHubLocation(), []);
  const hubAddress = getHubAddress();

  const { getDraft, patchDraft, setNavigating, acceptAssignment, setHubReached } =
    useAssignmentDrafts(rows);

  const actions = useAssignmentActions({
    fetchAssignments,
    getDraft,
    patchDraft,
  });

  const replayOfflineAction = useCallback(
    async (action) => {
      if (action?.type === "mark_reached" && action.payload?.id) {
        await pickupApi.markReachedSeller(action.payload.id, action.payload.body || {});
        await fetchAssignments({ silent: true });
        return;
      }
      if (action?.type === "refresh") {
        await fetchAssignments({ silent: true });
      }
    },
    [fetchAssignments],
  );

  const { online, queueLen, syncing, flush } = useOfflineQueue(replayOfflineAction);

  const trip = useMemo(() => buildTripPlan(rows, getDraft), [rows, getDraft]);

  const partnerLoc = useMemo(
    () =>
      liveLoc ||
      (user?.location?.coordinates?.length >= 2 ? toLatLng(user.location) : null),
    [liveLoc, user?.location],
  );

  const mapStops = useMemo(() => getSellerStopsForMap(trip, hubLoc), [trip, hubLoc]);

  const displayRows = useMemo(() => {
    if (!focusMode || statusFilter !== "active" || !trip.current) return rows;
    const currentId =
      (focusedAssignmentId && rows.some((r) => r._id === focusedAssignmentId)
        ? focusedAssignmentId
        : null) || trip.current._id;
    const current = rows.find((r) => r._id === currentId);
    const others = rows.filter(
      (r) => r._id !== currentId && r.status !== "hub_delivered",
    );
    return current ? [current, ...others] : rows;
  }, [rows, trip, focusMode, statusFilter, focusedAssignmentId]);

  const statCards = useMemo(
    () => [
      { label: "Assigned", value: stats.assigned, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Picked", value: stats.picked, icon: Package, color: "text-teal-600", bg: "bg-teal-50" },
      { label: "Done", value: stats.delivered, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    ],
    [stats],
  );

  const handleNavigate = useCallback(
    (row) => {
      setNavigating(row._id, true);
      setFocusedAssignmentId(row._id);
      try {
        sessionStorage.setItem("pickup_active_assignment", row._id);
      } catch {
        /* ignore */
      }
      toast.message("Navigation started");
    },
    [setNavigating],
  );

  const handleAccept = useCallback(
    (row) => {
      acceptAssignment(row._id);
      setFocusedAssignmentId(row._id);
      try {
        sessionStorage.setItem("pickup_active_assignment", row._id);
      } catch {
        /* ignore */
      }
      toast.success("Assignment accepted");
    },
    [acceptAssignment],
  );

  const handleHubReached = useCallback(
    (row) => {
      setHubReached(row._id, true);
      toast.success("Reached hub — capture proof photos");
    },
    [setHubReached],
  );

  const handleMarkReached = useCallback(
    (row) => actions.markReached(row, getCurrentPosition),
    [actions, getCurrentPosition],
  );

  const handleConfirmPickup = useCallback(
    (row) => actions.confirmPickup(row, getCurrentPosition),
    [actions, getCurrentPosition],
  );

  const handleHubDelivered = useCallback(
    async (row) => {
      await actions.markHubDelivered(row, getCurrentPosition);
      setHubReached(row._id, false);
      setCelebrate(true);
    },
    [actions, getCurrentPosition, setHubReached],
  );

  const handleRemoveVendorImage = useCallback(
    (rowId, index) => {
      const draft = getDraft(rowId);
      patchDraft(rowId, { vendorImages: draft.vendorImages.filter((_, i) => i !== index) });
    },
    [getDraft, patchDraft],
  );

  const handleRemoveHubImage = useCallback(
    (rowId, index) => {
      const draft = getDraft(rowId);
      patchDraft(rowId, { hubImages: draft.hubImages.filter((_, i) => i !== index) });
    },
    [getDraft, patchDraft],
  );

  const handleCancelOpen = useCallback((row) => {
    setCancelRow(row);
    setCancelReason("");
  }, []);

  const handleOtpExpired = useCallback(() => {
    toast.error("OTP expired — generate a new one");
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((v) => {
      const next = !v;
      try {
        localStorage.setItem("pickup_focus_mode", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleCancelConfirm = async () => {
    if (!cancelRow) return;
    await actions.cancelAssignment(cancelRow, cancelReason);
    setCancelRow(null);
    setCancelReason("");
  };

  const sharedCardProps = useMemo(
    () => ({
      partnerLoc,
      hubLoc,
      hubAddress,
      mapStops,
      actionLoadingId: actions.actionLoadingId,
      uploadingId: actions.uploadingId,
      uploadProgress: actions.uploadProgress,
      onNavigate: handleNavigate,
      onAccept: handleAccept,
      onMarkReached: handleMarkReached,
      onHubReached: handleHubReached,
      onAddVendorImages: actions.addVendorImages,
      onReplaceVendorImage: actions.replaceVendorImage,
      onRemoveVendorImage: handleRemoveVendorImage,
      onGenerateOtp: actions.generateOtp,
      onVerifyOtp: actions.verifyOtp,
      onConfirmPickup: handleConfirmPickup,
      onCancel: handleCancelOpen,
      onAddHubImages: actions.addHubImages,
      onReplaceHubImage: actions.replaceHubImage,
      onRemoveHubImage: handleRemoveHubImage,
      onMarkHubDelivered: handleHubDelivered,
      onPatchDraft: patchDraft,
      onOtpExpired: handleOtpExpired,
    }),
    [
      partnerLoc,
      hubLoc,
      hubAddress,
      mapStops,
      actions,
      handleNavigate,
      handleAccept,
      handleMarkReached,
      handleHubReached,
      handleRemoveVendorImage,
      handleConfirmPickup,
      handleCancelOpen,
      handleRemoveHubImage,
      handleHubDelivered,
      patchDraft,
      handleOtpExpired,
    ],
  );

  return (
    <div className="min-h-0">
      <PickupPageHeader
        title="Pickup Center"
        subtitle={user?.name || "Partner"}
        icon={Truck}
        actions={
          <button
            type="button"
            onClick={() => fetchAssignments({ silent: true })}
            aria-label="Refresh assignments"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100/70 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-700 active:scale-95"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        }
      />

      <OfflineBanner online={online} queueLen={queueLen} syncing={syncing} onSync={flush} />

      {(gpsError || gpsAccuracy != null) && (
        <div className="pickup-safe-x mx-auto max-w-2xl px-3 pt-2">
          <p
            role="status"
            className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800"
          >
            {gpsError ||
              (gpsAccuracy > 100
                ? "GPS accuracy is low — move to an open area"
                : `GPS accuracy ±${Math.round(gpsAccuracy)}m`)}
          </p>
        </div>
      )}

      <main className="pickup-safe-x mx-auto max-w-2xl space-y-4 py-4 sm:space-y-5 sm:py-5">
        {statusFilter === "active" && (
          <TripOverviewCard trip={trip} hubName={hubAddress || "Hub"} partnerLoc={partnerLoc} />
        )}

        {loading && rows.length === 0 ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {statCards.map((stat) => (
              <PickupCard key={stat.label} padding="sm" className={`${stat.bg} border-0 shadow-none`}>
                <stat.icon className={`${stat.color} mb-1`} size={16} aria-hidden />
                <p className="text-lg font-black text-slate-900 sm:text-xl">{stat.value}</p>
                <p className="truncate text-[9px] font-bold uppercase tracking-widest text-slate-500 sm:text-[10px]">
                  {stat.label}
                </p>
              </PickupCard>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Assignment filters">
            {Object.keys(FILTER_LABELS).map((key) => (
              <PickupChip
                key={key}
                active={statusFilter === key}
                onClick={() => setStatusFilter(key)}
                aria-label={`Filter ${FILTER_LABELS[key]}`}
              >
                {FILTER_LABELS[key]}
              </PickupChip>
            ))}
          </div>
          {statusFilter === "active" && trip.hasActiveTrip && (
            <button
              type="button"
              onClick={toggleFocusMode}
              aria-pressed={focusMode}
              className="ml-auto min-h-[36px] text-[10px] font-bold uppercase tracking-widest text-teal-600"
            >
              {focusMode ? "Show all" : "Focus current"}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading && rows.length === 0 ? (
              <>
                <AssignmentCardSkeleton />
                <AssignmentCardSkeleton />
              </>
            ) : error && rows.length === 0 ? (
              <PickupErrorState message={error} onRetry={() => fetchAssignments()} />
            ) : displayRows.length === 0 ? (
              <PickupEmptyState
                icon={Package}
                title="No assignments"
                description="New pickup tasks will appear here when assigned."
              />
            ) : (
              displayRows.map((row, idx) => {
                const activeId =
                  (focusedAssignmentId &&
                  rows.some((r) => r._id === focusedAssignmentId)
                    ? focusedAssignmentId
                    : null) || trip.current?._id;
                const isCurrent = activeId === row._id;
                const collapsed = focusMode && trip.hasActiveTrip && !isCurrent && idx > 0;
                if (collapsed) {
                  return (
                    <PickupCard
                      key={row._id}
                      padding="sm"
                      className="flex items-center justify-between gap-3 opacity-90"
                    >
                      <p className="min-w-0 truncate text-xs font-semibold text-slate-600">
                        {row.vendor?.name} · {row.requestId} ·{" "}
                        {row.status?.replace(/_/g, " ")}
                      </p>
                      <PickupButton
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => setFocusedAssignmentId(row._id)}
                      >
                        View Task
                      </PickupButton>
                    </PickupCard>
                  );
                }
                return (
                  <AssignmentCard
                    key={row._id}
                    row={row}
                    draft={getDraft(row._id)}
                    {...sharedCardProps}
                  />
                );
              })
            )}
          </AnimatePresence>
        </div>
      </main>

      <Suspense fallback={null}>
        <CompletionCelebration open={celebrate} onClose={() => setCelebrate(false)} />
      </Suspense>

      <PickupBottomSheet
        open={Boolean(cancelRow)}
        onClose={() => {
          setCancelRow(null);
          setCancelReason("");
        }}
        title="Cancel assignment"
      >
        <p className="mb-4 text-sm text-slate-500">Please provide a reason for cancelling.</p>
        <PickupInput
          label="Reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        <div className="mt-4 flex gap-3">
          <PickupButton variant="secondary" fullWidth onClick={() => setCancelRow(null)}>
            Back
          </PickupButton>
          <PickupButton
            variant="danger"
            fullWidth
            loading={actions.actionLoadingId === `${cancelRow?._id}:cancel`}
            onClick={handleCancelConfirm}
          >
            Confirm
          </PickupButton>
        </div>
      </PickupBottomSheet>
    </div>
  );
};

export default Dashboard;
