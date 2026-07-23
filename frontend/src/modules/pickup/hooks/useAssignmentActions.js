import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pickupApi } from "../services/pickupApi";
import {
  getApiErrorMessage,
  parseAssignmentNotes,
  parseHubImages,
  parseVendorImageUrls,
} from "../utils/assignmentUtils";
import { compressImageFiles } from "../utils/imageCompress";
import { enqueueOfflineAction } from "../utils/offlineQueue";
import { hasBackendProgress } from "../utils/workflowPhases";
import {
  readPersistFlag,
  readStoredImages,
  readPersistedDraft,
  writePersistedDraft,
  setActiveAssignmentId,
  getActiveAssignmentId,
} from "../utils/workflowPersist";

function isOfflineError(err) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(err?.message || err?.code || "").toLowerCase();
  return msg.includes("network") || msg.includes("failed to fetch");
}

function queueIfOffline(type, payload) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueOfflineAction({ type, payload, at: Date.now() });
    toast.message("Saved offline — will sync when back online");
    return true;
  }
  return false;
}

function isValidCoord(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

const emptyUi = () => ({
  accepted: false,
  acceptedAt: null,
  navigating: false,
  navStartedAt: null,
  sellerReached: false,
  sellerReachedAt: null,
  hubReached: false,
  hubReachedAt: null,
  hubNavigating: false,
  hubNavStartedAt: null,
  vendorImages: [],
  hubImages: [],
  otp: "",
  notes: "",
  pickedQty: {},
  photosUploadedAt: null,
  hubPhotosAt: null,
  requireOtpRegen: false,
});

export function useAssignmentDrafts(rows) {
  const [drafts, setDrafts] = useState({});
  const hydratedRef = useRef(new Set());

  const patchDraft = useCallback((id, patch) => {
    setDrafts((prev) => {
      const nextDraft = { ...(prev[id] || emptyUi()), ...patch };
      writePersistedDraft(id, nextDraft);
      return { ...prev, [id]: nextDraft };
    });
  }, []);

  const getDraft = useCallback((id) => drafts[id] || emptyUi(), [drafts]);

  useEffect(() => {
    if (!rows?.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const id = row._id;
        if (!id) continue;
        const cur = next[id] || emptyUi();
        const saved = !hydratedRef.current.has(id) ? readPersistedDraft(id) : null;

        let navigating = cur.navigating;
        let accepted = cur.accepted;
        let hubReached = cur.hubReached;
        let sellerReached = cur.sellerReached;
        let acceptedAt = cur.acceptedAt;
        let navStartedAt = cur.navStartedAt;
        let hubReachedAt = cur.hubReachedAt;
        let sellerReachedAt = cur.sellerReachedAt;
        let photosUploadedAt = cur.photosUploadedAt;
        let hubPhotosAt = cur.hubPhotosAt;
        let requireOtpRegen = Boolean(cur.requireOtpRegen);
        let otp = cur.otp || "";
        let notes = cur.notes || "";
        let pickedQty = { ...cur.pickedQty };
        let hubNavigating = cur.hubNavigating;
        let hubNavStartedAt = cur.hubNavStartedAt;

        if (saved) {
          navigating = Boolean(saved.navigating);
          accepted = Boolean(saved.accepted);
          hubReached = Boolean(saved.hubReached);
          sellerReached = Boolean(saved.sellerReached);
          acceptedAt = saved.acceptedAt || acceptedAt;
          navStartedAt = saved.navStartedAt || navStartedAt;
          hubReachedAt = saved.hubReachedAt || hubReachedAt;
          sellerReachedAt = saved.sellerReachedAt || sellerReachedAt;
          photosUploadedAt = saved.photosUploadedAt || photosUploadedAt;
          hubPhotosAt = saved.hubPhotosAt || hubPhotosAt;
          requireOtpRegen = Boolean(saved.requireOtpRegen);
          otp = saved.otp || otp;
          notes = saved.notes || notes;
          pickedQty = { ...(saved.pickedQty || {}), ...pickedQty };
          hubNavigating = Boolean(saved.hubNavigating);
          hubNavStartedAt = saved.hubNavStartedAt || hubNavStartedAt;
        } else if (!hydratedRef.current.has(id)) {
          navigating = readPersistFlag(`pickup_nav_${id}`);
          accepted = readPersistFlag(`pickup_accepted_${id}`);
          hubReached = readPersistFlag(`pickup_hub_reached_${id}`);
          sellerReached = readPersistFlag(`pickup_seller_reached_${id}`);
          hubNavigating = readPersistFlag(`pickup_hub_nav_${id}`);
        }

        const fromProof = parseVendorImageUrls(row.pickupProof);
        const fromHub = parseHubImages(row.hubDropProof);
        const rowNotes = parseAssignmentNotes(row.pickupProof, row.notes);
        const storedVendor =
          saved?.vendorImages?.length > 0
            ? saved.vendorImages
            : readStoredImages(`pickup_vendor_imgs_${id}`);
        const storedHub =
          saved?.hubImages?.length > 0
            ? saved.hubImages
            : readStoredImages(`pickup_hub_imgs_${id}`);

        const vendorImages =
          cur.vendorImages?.length > 0
            ? cur.vendorImages
            : fromProof.length > 0
              ? fromProof
              : storedVendor;
        const hubImages =
          cur.hubImages?.length > 0
            ? cur.hubImages
            : fromHub.length > 0
              ? fromHub
              : storedHub;

        if (fromProof.length && !photosUploadedAt) {
          photosUploadedAt =
            row.pickupProof?.reachedSellerAt ||
            row.pickupAssignedAt ||
            Date.now();
        }
        if (fromHub.length && !hubPhotosAt) {
          hubPhotosAt = row.hubDropProof?.droppedAt || Date.now();
        }

        const progressed = hasBackendProgress(row, {
          vendorImages,
          sellerReached,
        });
        const reached = Boolean(
          row.reachedSellerAt ||
            row.pickupProof?.reachedSellerAt ||
            sellerReached,
        );

        if (progressed && row.status === "pickup_assigned") {
          accepted = true;
          if (!acceptedAt) acceptedAt = row.pickupAssignedAt || Date.now();
        }
        if (reached && row.status === "pickup_assigned") {
          sellerReached = true;
          if (!sellerReachedAt) {
            sellerReachedAt =
              row.reachedSellerAt ||
              row.pickupProof?.reachedSellerAt ||
              Date.now();
          }
          navigating = true;
          if (!navStartedAt) navStartedAt = sellerReachedAt || Date.now();
        }
        // Keep active assignment on navigating after refresh (not Start Navigation)
        if (
          accepted &&
          row.status === "pickup_assigned" &&
          !sellerReached &&
          (navigating || getActiveAssignmentId() === id)
        ) {
          navigating = true;
          if (!navStartedAt) navStartedAt = acceptedAt || Date.now();
        }

        // Picked → restore hub navigation step after refresh (Slide · Reached hub)
        if (row.status === "picked") {
          if (!hydratedRef.current.has(id)) {
            hubNavigating =
              hubNavigating ||
              readPersistFlag(`pickup_hub_nav_${id}`) ||
              Boolean(saved?.hubNavigating);
            hubReached =
              hubReached || readPersistFlag(`pickup_hub_reached_${id}`);
          }
          if (hubNavigating && !hubReached) {
            navigating = true;
            if (!hubNavStartedAt) hubNavStartedAt = Date.now();
          }
          // Seller-nav flag must not fake hub-nav after refresh unless hub nav was started
          if (!hubNavigating && !hubReached) {
            navigating = false;
          }
        }

        if (row.status === "pickup_assigned") {
          for (const p of row.products || []) {
            const key = String(p.productId);
            if (pickedQty[key] == null) pickedQty[key] = p.qty;
          }
        }

        if (!otp && !hydratedRef.current.has(id)) {
          try {
            otp =
              localStorage.getItem(`pickup_otp_${id}`) ||
              sessionStorage.getItem(`pickup_otp_${id}`) ||
              "";
          } catch {
            /* ignore */
          }
        }

        const photosPresent = vendorImages.length > 0;
        if (
          !hydratedRef.current.has(id) &&
          row.status === "pickup_assigned" &&
          photosPresent &&
          (!row.pickupOtpGenerated || (row.pickupOtpVerified && !otp))
        ) {
          requireOtpRegen = !row.pickupOtpGenerated || !otp;
        }
        if (row.pickupOtpGenerated && !row.pickupOtpVerified) {
          requireOtpRegen = false;
        }

        const nextDraft = {
          ...cur,
          vendorImages,
          hubImages,
          notes: notes || rowNotes,
          pickedQty,
          acceptedAt,
          navStartedAt,
          hubReachedAt,
          sellerReachedAt,
          photosUploadedAt,
          hubPhotosAt,
          otp,
          requireOtpRegen,
          sellerReached,
          hubNavigating,
          hubNavStartedAt,
          accepted: row.status === "pickup_assigned" ? accepted : true,
          hubReached: row.status === "picked" ? hubReached : false,
          navigating: ["pickup_assigned", "picked"].includes(row.status)
            ? navigating
            : false,
        };

        next[id] = nextDraft;
        writePersistedDraft(id, nextDraft);
        hydratedRef.current.add(id);
      }
      return next;
    });
  }, [rows]);

  const setNavigating = useCallback(
    (id, navigating) => {
      patchDraft(id, {
        navigating,
        navStartedAt: navigating ? Date.now() : null,
      });
      if (navigating) setActiveAssignmentId(id);
    },
    [patchDraft],
  );

  /** Start hub navigation — separate from seller nav so refresh keeps hub step. */
  const startHubNavigation = useCallback(
    (id) => {
      patchDraft(id, {
        hubNavigating: true,
        hubNavStartedAt: Date.now(),
        navigating: true,
      });
      setActiveAssignmentId(id);
    },
    [patchDraft],
  );

  const acceptAssignment = useCallback(
    (id) => {
      patchDraft(id, {
        accepted: true,
        acceptedAt: Date.now(),
        navigating: true,
        navStartedAt: Date.now(),
      });
      setActiveAssignmentId(id);
    },
    [patchDraft],
  );

  const setHubReached = useCallback(
    (id, reached = true) => {
      patchDraft(id, {
        hubReached: reached,
        hubReachedAt: reached ? Date.now() : null,
        hubNavigating: reached ? false : true,
        navigating: reached ? false : true,
      });
      if (reached) setActiveAssignmentId(id);
    },
    [patchDraft],
  );

  return {
    drafts,
    getDraft,
    patchDraft,
    setNavigating,
    startHubNavigation,
    acceptAssignment,
    setHubReached,
  };
}

export function useAssignmentActions({ fetchAssignments, getDraft, patchDraft }) {
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const inFlightRef = useRef(new Set());

  const guard = useCallback((key, fn) => {
    if (inFlightRef.current.has(key)) return undefined;
    inFlightRef.current.add(key);
    return fn().finally(() => inFlightRef.current.delete(key));
  }, []);

  const refreshSilent = useCallback(() => {
    // Force refresh after mutations — do not skip when a poll is in flight
    return Promise.resolve(fetchAssignments({ silent: true, force: true })).catch(() => {});
  }, [fetchAssignments]);

  const uploadOne = useCallback(async (file, type, source) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await pickupApi.uploadProofImage(fd, type, (evt) => {
      if (!evt.total) return;
      setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
    });
    const url = res?.data?.result?.url || "";
    if (!url) throw new Error("Upload failed");
    return { url, source };
  }, []);

  const resolveRequiredCoords = useCallback(async (getCurrentPosition) => {
    // Fast path: use whatever GPS we already have; do not wait through long retries.
    if (typeof getCurrentPosition === "function") {
      try {
        const coords = await getCurrentPosition();
        const lat = Number(coords?.lat ?? coords?.latitude);
        const lng = Number(coords?.lng ?? coords?.longitude);
        if (isValidCoord(lat, lng)) {
          return { lat, lng, fromCache: Boolean(coords?.fromCache) };
        }
      } catch {
        /* fall through to testing fallback */
      }
    }
    // Testing fallback so confirm/hub are not blocked when browser GPS is denied/slow.
    // Backend requires finite lat/lng — do not send undefined.
    const hubLat = Number(
      import.meta.env.VITE_HUB_LOCATION_LAT ||
        import.meta.env.VITE_HUB_LAT ||
        import.meta.env.VITE_DEFAULT_HUB_LAT,
    );
    const hubLng = Number(
      import.meta.env.VITE_HUB_LOCATION_LNG ||
        import.meta.env.VITE_HUB_LNG ||
        import.meta.env.VITE_DEFAULT_HUB_LNG,
    );
    if (isValidCoord(hubLat, hubLng)) {
      return { lat: hubLat, lng: hubLng, fromCache: true };
    }
    // Last resort finite coords (never undefined)
    return { lat: 0, lng: 0, fromCache: true };
  }, []);

  const markReached = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:reached`;
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          let body = {};
          try {
            const coords = await getCurrentPosition();
            const lat = Number(coords?.lat ?? coords?.latitude);
            const lng = Number(coords?.lng ?? coords?.longitude);
            if (isValidCoord(lat, lng)) body = { lat, lng };
          } catch {
            // Arrival GPS is optional on backend — proceed without coords
          }
          if (queueIfOffline("mark_reached", { id: row._id, body })) {
            const at = Date.now();
            patchDraft(row._id, { sellerReached: true, sellerReachedAt: at, navigating: true });
            setActiveAssignmentId(row._id);
            return;
          }
          const res = await pickupApi.markReachedSeller(row._id, body);
          const at =
            res?.data?.result?.reachedSellerAt || new Date().toISOString();
          patchDraft(row._id, {
            sellerReached: true,
            sellerReachedAt: at,
            navigating: true,
          });
          setActiveAssignmentId(row._id);
          toast.success("Reached seller — capture parcel photos");
          await refreshSilent();
        } catch (err) {
          if (isOfflineError(err)) {
            queueIfOffline("mark_reached", {
              id: row._id,
              body: {},
            });
            const at = Date.now();
            patchDraft(row._id, { sellerReached: true, sellerReachedAt: at, navigating: true });
            setActiveAssignmentId(row._id);
          } else {
            toast.error(getApiErrorMessage(err, "Could not mark reached"));
          }
          throw err;
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [guard, refreshSilent, patchDraft],
  );

  const addVendorImages = useCallback(
    async (rowId, files, source) => {
      const draft = getDraft(rowId);
      const room = Math.max(0, 4 - draft.vendorImages.length);
      let batch;
      try {
        batch = (await compressImageFiles(files)).slice(0, room);
      } catch {
        batch = files.slice(0, room);
      }
      if (!batch.length) return;
      try {
        setUploadingId(rowId);
        setUploadProgress(0);
        const uploaded = [];
        for (const file of batch) {
          uploaded.push(await uploadOne(file, "vendor", source));
        }
        patchDraft(rowId, {
          vendorImages: [...draft.vendorImages, ...uploaded].slice(0, 4),
          photosUploadedAt: Date.now(),
          // New photos must re-run Generate OTP → Verify before mark-picked
          requireOtpRegen: true,
          otp: "",
        });
        try {
          sessionStorage.removeItem(`pickup_otp_${rowId}`);
        } catch {
          /* ignore */
        }
        toast.success(`${uploaded.length} photo(s) uploaded`);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Upload failed"));
      } finally {
        setUploadingId("");
        setUploadProgress(0);
      }
    },
    [getDraft, patchDraft, uploadOne],
  );

  const replaceVendorImage = useCallback(
    async (rowId, index, file, source) => {
      try {
        setUploadingId(rowId);
        setUploadProgress(0);
        const [compressed] = await compressImageFiles([file]);
        const uploaded = await uploadOne(compressed || file, "vendor", source);
        const draft = getDraft(rowId);
        const images = [...draft.vendorImages];
        images[index] = uploaded;
        patchDraft(rowId, {
          vendorImages: images,
          requireOtpRegen: true,
          otp: "",
        });
        try {
          sessionStorage.removeItem(`pickup_otp_${rowId}`);
        } catch {
          /* ignore */
        }
        toast.success("Photo updated");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Replace failed"));
      } finally {
        setUploadingId("");
        setUploadProgress(0);
      }
    },
    [getDraft, patchDraft, uploadOne],
  );

  const generateOtp = useCallback(
    async (row) => {
      const key = `${row._id}:otp`;
      const draft = getDraft(row._id);
      const urls = draft.vendorImages.map((i) => i.url).filter(Boolean);
      if (!urls.length) {
        toast.error("Upload at least one parcel photo first");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          // ONLY generatePickupOtp — never verify or mark-picked from this slide
          const res = await pickupApi.generatePickupOtp(row._id, {
            vendorImageUrl: urls[0],
            vendorImageUrls: urls,
          });
          patchDraft(row._id, {
            otp: "",
            requireOtpRegen: false,
          });
          try {
            sessionStorage.removeItem(`pickup_otp_${row._id}`);
          } catch {
            /* ignore */
          }
          toast.success("OTP generated — enter the seller code");
          if (res?.data?.result?.devMode && import.meta.env.DEV) {
            toast.message("Dev mode: seller OTP is 1234");
          }
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Failed to generate OTP"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, patchDraft, refreshSilent],
  );

  const verifyOtp = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:verify`;
      const draft = getDraft(row._id);
      const otp = String(draft.otp || "").trim();
      if (!otp) {
        toast.error("Enter the OTP from the seller");
        return;
      }
      if (otp.length < 4) {
        toast.error("Enter the full 4-digit OTP");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          // Step 1: ONLY verifyPickupOtp
          await pickupApi.verifyPickupOtp(row._id, { otp });
          patchDraft(row._id, { requireOtpRegen: false, otp });
          setActiveAssignmentId(row._id);

          // Step 2: markPicked ONLY after verify succeeds (same OTP)
          const urls = draft.vendorImages.map((i) => i.url).filter(Boolean);
          if (!urls.length) {
            toast.success("OTP verified — upload photos then confirm");
            refreshSilent();
            return;
          }

          const coords = await resolveRequiredCoords(getCurrentPosition);
          const items = Object.entries(draft.pickedQty || {}).map(
            ([productId, actualPickedQty]) => ({
              productId,
              actualPickedQty: Number(actualPickedQty),
            }),
          );
          await pickupApi.markPicked(row._id, {
            otp,
            lat: coords.lat,
            lng: coords.lng,
            notes: draft.notes || "",
            vendorImageUrl: urls[0],
            vendorImageUrls: urls,
            items,
          });
          // Clear seller-nav; hub starts only after "Start hub navigation"
          patchDraft(row._id, {
            navigating: false,
            hubNavigating: false,
            sellerReached: true,
          });
          toast.success(`Pickup complete from ${row.vendor?.name || "Seller"}`);
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "OTP verification failed"));
          refreshSilent();
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, patchDraft, refreshSilent, resolveRequiredCoords],
  );

  const confirmPickup = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:confirm`;
      const draft = getDraft(row._id);
      const urls = draft.vendorImages.map((i) => i.url).filter(Boolean);
      let otp = String(draft.otp || "").trim();
      if (!otp) {
        try {
          otp = String(sessionStorage.getItem(`pickup_otp_${row._id}`) || "").trim();
        } catch {
          otp = "";
        }
      }
      if (!row.pickupOtpVerified) {
        toast.error("Verify OTP before confirming pickup");
        return;
      }
      if (!otp) {
        // Cannot mark-picked without OTP code — send user back to generate/verify
        patchDraft(row._id, { requireOtpRegen: true, otp: "" });
        toast.error("OTP missing — generate and verify OTP again");
        return;
      }
      if (!urls.length) {
        toast.error("Parcel image is required");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          const coords = await resolveRequiredCoords(getCurrentPosition);
          const items = Object.entries(draft.pickedQty || {}).map(
            ([productId, actualPickedQty]) => ({
              productId,
              actualPickedQty: Number(actualPickedQty),
            }),
          );
          await pickupApi.markPicked(row._id, {
            otp,
            lat: coords.lat,
            lng: coords.lng,
            notes: draft.notes || "",
            vendorImageUrl: urls[0],
            vendorImageUrls: urls,
            items,
          });
          patchDraft(row._id, {
            navigating: false,
            hubNavigating: false,
            sellerReached: true,
          });
          toast.success(`Pickup complete from ${row.vendor?.name || "Seller"}`);
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Confirmation failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, patchDraft, refreshSilent, resolveRequiredCoords],
  );

  const cancelAssignment = useCallback(
    async (row, reason) => {
      const key = `${row._id}:cancel`;
      if (!reason?.trim()) {
        toast.error("Please provide a reason");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          await pickupApi.cancelPickupAssignment(row._id, {
            reason: reason.trim(),
          });
          toast.success("Assignment cancelled");
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Cancellation failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [guard, refreshSilent],
  );

  const addHubImages = useCallback(
    async (rowId, files, source) => {
      const draft = getDraft(rowId);
      const room = Math.max(0, 4 - draft.hubImages.length);
      let batch;
      try {
        batch = (await compressImageFiles(files)).slice(0, room);
      } catch {
        batch = files.slice(0, room);
      }
      if (!batch.length) return;
      try {
        setUploadingId(rowId);
        setUploadProgress(0);
        const uploaded = [];
        for (const file of batch) {
          uploaded.push(await uploadOne(file, "hub", source));
        }
        patchDraft(rowId, {
          hubImages: [...draft.hubImages, ...uploaded].slice(0, 4),
          hubPhotosAt: Date.now(),
        });
        toast.success("Hub photo uploaded");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Upload failed"));
      } finally {
        setUploadingId("");
        setUploadProgress(0);
      }
    },
    [getDraft, patchDraft, uploadOne],
  );

  const replaceHubImage = useCallback(
    async (rowId, index, file, source) => {
      try {
        setUploadingId(rowId);
        setUploadProgress(0);
        const [compressed] = await compressImageFiles([file]);
        const uploaded = await uploadOne(compressed || file, "hub", source);
        const draft = getDraft(rowId);
        const images = [...draft.hubImages];
        images[index] = uploaded;
        patchDraft(rowId, { hubImages: images });
        toast.success("Photo updated");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Replace failed"));
      } finally {
        setUploadingId("");
        setUploadProgress(0);
      }
    },
    [getDraft, patchDraft, uploadOne],
  );

  const markHubDelivered = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:hub-delivered`;
      const draft = getDraft(row._id);
      const urls = draft.hubImages.map((i) => i.url).filter(Boolean);
      if (!urls.length) {
        toast.error("Hub drop image is required");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          const coords = await resolveRequiredCoords(getCurrentPosition);
          await pickupApi.markHubDelivered(row._id, {
            lat: coords.lat,
            lng: coords.lng,
            notes: draft.notes || "",
            hubImageUrl: urls[0],
          });
          toast.success("Delivered to hub");
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Hub delivery failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, refreshSilent, resolveRequiredCoords],
  );

  return {
    actionLoadingId,
    uploadingId,
    uploadProgress,
    markReached,
    addVendorImages,
    replaceVendorImage,
    generateOtp,
    verifyOtp,
    confirmPickup,
    cancelAssignment,
    addHubImages,
    replaceHubImage,
    markHubDelivered,
  };
}
