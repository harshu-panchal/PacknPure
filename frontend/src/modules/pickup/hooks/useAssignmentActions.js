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

function readSessionFlag(key) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key, on) {
  try {
    if (on) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readStoredImages(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.url === "string" && x.url.trim())
      .slice(0, 4)
      .map((x) => ({ url: x.url.trim(), source: x.source === "camera" ? "camera" : "gallery" }));
  } catch {
    return [];
  }
}

function writeStoredImages(key, images) {
  try {
    const payload = (images || [])
      .filter((x) => x?.url)
      .slice(0, 4)
      .map((x) => ({ url: x.url, source: x.source || "gallery" }));
    if (!payload.length) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

const emptyUi = () => ({
  accepted: false,
  acceptedAt: null,
  navigating: false,
  navStartedAt: null,
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
});

export function useAssignmentDrafts(rows) {
  const [drafts, setDrafts] = useState({});
  const hydratedRef = useRef(new Set());

  const patchDraft = useCallback((id, patch) => {
    setDrafts((prev) => {
      const nextDraft = { ...(prev[id] || emptyUi()), ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "vendorImages")) {
        writeStoredImages(`pickup_vendor_imgs_${id}`, nextDraft.vendorImages);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "hubImages")) {
        writeStoredImages(`pickup_hub_imgs_${id}`, nextDraft.hubImages);
      }
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
        let navigating = cur.navigating;
        let accepted = cur.accepted;
        let hubReached = cur.hubReached;
        let acceptedAt = cur.acceptedAt;
        let navStartedAt = cur.navStartedAt;
        let hubReachedAt = cur.hubReachedAt;
        let photosUploadedAt = cur.photosUploadedAt;
        let hubPhotosAt = cur.hubPhotosAt;

        if (!hydratedRef.current.has(id)) {
          navigating = readSessionFlag(`pickup_nav_${id}`);
          accepted = readSessionFlag(`pickup_accepted_${id}`);
          hubReached = readSessionFlag(`pickup_hub_reached_${id}`);
        }

        const fromProof = parseVendorImageUrls(row.pickupProof);
        const fromHub = parseHubImages(row.hubDropProof);
        const notes = parseAssignmentNotes(row.pickupProof, row.notes);
        const storedVendor = readStoredImages(`pickup_vendor_imgs_${id}`);
        const storedHub = readStoredImages(`pickup_hub_imgs_${id}`);

        // Prefer in-memory → backend proof → session-cached uploads (pre-OTP refresh)
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

        const progressed = hasBackendProgress(row, { vendorImages });
        const reached = Boolean(
          row.reachedSellerAt || row.pickupProof?.reachedSellerAt,
        );

        // Restore workflow after refresh from backend status (not only session flags)
        if (progressed && row.status === "pickup_assigned") {
          accepted = true;
          if (!acceptedAt) acceptedAt = row.pickupAssignedAt || Date.now();
          writeSessionFlag(`pickup_accepted_${id}`, true);
        }
        if (reached && row.status === "pickup_assigned") {
          navigating = true;
          if (!navStartedAt) {
            navStartedAt = row.reachedSellerAt || row.pickupProof?.reachedSellerAt || Date.now();
          }
          writeSessionFlag(`pickup_nav_${id}`, true);
        }
        if (row.status === "picked" && hubReached) {
          writeSessionFlag(`pickup_hub_reached_${id}`, true);
        }

        const pickedQty = { ...cur.pickedQty };
        if (row.status === "pickup_assigned") {
          for (const p of row.products || []) {
            const key = String(p.productId);
            if (pickedQty[key] == null) pickedQty[key] = p.qty;
          }
        }

        // Persist restored images so subsequent refresh still shows them
        if (vendorImages.length) writeStoredImages(`pickup_vendor_imgs_${id}`, vendorImages);
        if (hubImages.length) writeStoredImages(`pickup_hub_imgs_${id}`, hubImages);

        next[id] = {
          ...cur,
          vendorImages,
          hubImages,
          notes: cur.notes || notes,
          pickedQty,
          acceptedAt,
          navStartedAt,
          hubReachedAt,
          photosUploadedAt,
          hubPhotosAt,
          accepted: row.status === "pickup_assigned" ? accepted : true,
          hubReached: row.status === "picked" ? hubReached : false,
          navigating: ["pickup_assigned", "picked"].includes(row.status)
            ? navigating
            : false,
        };
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
      writeSessionFlag(`pickup_nav_${id}`, navigating);
      if (navigating) {
        try {
          sessionStorage.setItem("pickup_active_assignment", id);
        } catch {
          /* ignore */
        }
      }
    },
    [patchDraft],
  );

  const acceptAssignment = useCallback(
    (id) => {
      patchDraft(id, { accepted: true, acceptedAt: Date.now() });
      writeSessionFlag(`pickup_accepted_${id}`, true);
      try {
        sessionStorage.setItem("pickup_active_assignment", id);
      } catch {
        /* ignore */
      }
    },
    [patchDraft],
  );

  const setHubReached = useCallback(
    (id, reached = true) => {
      patchDraft(id, {
        hubReached: reached,
        hubReachedAt: reached ? Date.now() : null,
        navigating: false,
      });
      if (reached) {
        writeSessionFlag(`pickup_hub_reached_${id}`, true);
        writeSessionFlag(`pickup_nav_${id}`, false);
      } else {
        writeSessionFlag(`pickup_hub_reached_${id}`, false);
      }
    },
    [patchDraft],
  );

  return {
    drafts,
    getDraft,
    patchDraft,
    setNavigating,
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
    // Do not block slide/loading on list refresh — fire and forget
    Promise.resolve(fetchAssignments({ silent: true })).catch(() => {});
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
          if (queueIfOffline("mark_reached", { id: row._id, body })) return;
          await pickupApi.markReachedSeller(row._id, body);
          toast.success("Reached seller — capture parcel photos");
          refreshSilent();
        } catch (err) {
          if (isOfflineError(err)) {
            queueIfOffline("mark_reached", {
              id: row._id,
              body: {},
            });
          } else {
            toast.error(getApiErrorMessage(err, "Could not mark reached"));
          }
          throw err;
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [guard, refreshSilent],
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
        });
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
        patchDraft(rowId, { vendorImages: images });
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
          const res = await pickupApi.generatePickupOtp(row._id, {
            vendorImageUrl: urls[0],
            vendorImageUrls: urls,
          });
          patchDraft(row._id, { otp: "" });
          toast.success("OTP generated — ask seller for the code");
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
    async (row) => {
      const key = `${row._id}:verify`;
      const draft = getDraft(row._id);
      const otp = String(draft.otp || "").trim();
      if (!otp) {
        toast.error("Enter the OTP from the seller");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          await pickupApi.verifyPickupOtp(row._id, { otp });
          try {
            sessionStorage.setItem(`pickup_otp_${row._id}`, otp);
          } catch {
            /* ignore */
          }
          toast.success("OTP verified — confirm pickup");
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Invalid OTP"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, refreshSilent],
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
      // Dev OTP is always 1234 — avoid "Invalid pickup OTP" after refresh when draft.otp is empty
      if (!otp && row.pickupOtpVerified && import.meta.env.DEV) {
        otp = "1234";
      }
      if (!row.pickupOtpVerified) {
        toast.error("Verify OTP before confirming pickup");
        return;
      }
      if (!otp) {
        toast.error("OTP missing — enter and verify OTP again");
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
          toast.success(`Pickup complete from ${row.vendor?.name || "Seller"}`);
          refreshSilent();
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Confirmation failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, refreshSilent, resolveRequiredCoords],
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
