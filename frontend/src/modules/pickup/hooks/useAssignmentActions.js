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
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyUi()), ...patch },
    }));
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
        if (!hydratedRef.current.has(id)) {
          try {
            navigating = sessionStorage.getItem(`pickup_nav_${id}`) === "1";
            accepted = sessionStorage.getItem(`pickup_accepted_${id}`) === "1";
            hubReached = sessionStorage.getItem(`pickup_hub_reached_${id}`) === "1";
          } catch {
            navigating = false;
            accepted = false;
            hubReached = false;
          }
        }
        const fromProof = parseVendorImageUrls(row.pickupProof);
        const fromHub = parseHubImages(row.hubDropProof);
        const notes = parseAssignmentNotes(row.pickupProof, row.notes);

        const vendorImages =
          cur.vendorImages?.length > 0 ? cur.vendorImages : fromProof;
        const hubImages = cur.hubImages?.length > 0 ? cur.hubImages : fromHub;

        const pickedQty = { ...cur.pickedQty };
        if (row.status === "pickup_assigned") {
          for (const p of row.products || []) {
            const key = String(p.productId);
            if (pickedQty[key] == null) pickedQty[key] = p.qty;
          }
        }

        next[id] = {
          ...cur,
          vendorImages,
          hubImages,
          notes: cur.notes || notes,
          pickedQty,
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
      try {
        if (navigating) sessionStorage.setItem(`pickup_nav_${id}`, "1");
        else sessionStorage.removeItem(`pickup_nav_${id}`);
      } catch {
        /* ignore */
      }
    },
    [patchDraft],
  );

  const acceptAssignment = useCallback(
    (id) => {
      patchDraft(id, { accepted: true, acceptedAt: Date.now() });
      try {
        sessionStorage.setItem(`pickup_accepted_${id}`, "1");
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
      try {
        if (reached) {
          sessionStorage.setItem(`pickup_hub_reached_${id}`, "1");
          sessionStorage.removeItem(`pickup_nav_${id}`);
        } else sessionStorage.removeItem(`pickup_hub_reached_${id}`);
      } catch {
        /* ignore */
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

  const markReached = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:reached`;
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          let coords = null;
          try {
            coords = await getCurrentPosition();
          } catch {
            /* optional */
          }
          const body = { lat: coords?.latitude, lng: coords?.longitude };
          if (queueIfOffline("mark_reached", { id: row._id, body })) return;
          await pickupApi.markReachedSeller(row._id, body);
          toast.success("Reached seller — capture parcel photos");
          await fetchAssignments({ silent: true });
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
    [guard, fetchAssignments],
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
          await fetchAssignments({ silent: true });
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Failed to generate OTP"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, patchDraft, fetchAssignments],
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
          toast.success("OTP verified — confirm pickup");
          await fetchAssignments({ silent: true });
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Invalid OTP"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, fetchAssignments],
  );

  const confirmPickup = useCallback(
    async (row, getCurrentPosition) => {
      const key = `${row._id}:confirm`;
      const draft = getDraft(row._id);
      const urls = draft.vendorImages.map((i) => i.url).filter(Boolean);
      const otp = String(draft.otp || "").trim();
      if (!row.pickupOtpVerified) {
        toast.error("Verify OTP before confirming pickup");
        return;
      }
      if (!urls.length) {
        toast.error("Parcel image is required");
        return;
      }
      return guard(key, async () => {
        try {
          setActionLoadingId(key);
          let latitude;
          let longitude;
          try {
            const coords = await getCurrentPosition();
            latitude = coords.latitude;
            longitude = coords.longitude;
          } catch {
            toast.message("GPS unavailable — continuing without precise location");
          }
          const items = Object.entries(draft.pickedQty || {}).map(
            ([productId, actualPickedQty]) => ({
              productId,
              actualPickedQty: Number(actualPickedQty),
            }),
          );
          await pickupApi.markPicked(row._id, {
            otp,
            lat: latitude,
            lng: longitude,
            notes: draft.notes || "",
            vendorImageUrl: urls[0],
            vendorImageUrls: urls,
            items,
          });
          toast.success(`Pickup complete from ${row.vendor?.name || "Seller"}`);
          await fetchAssignments({ silent: true });
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Confirmation failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, fetchAssignments],
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
          await fetchAssignments({ silent: true });
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Cancellation failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [guard, fetchAssignments],
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
          let latitude;
          let longitude;
          try {
            const coords = await getCurrentPosition();
            latitude = coords.latitude;
            longitude = coords.longitude;
          } catch {
            toast.message("GPS unavailable — continuing without precise location");
          }
          await pickupApi.markHubDelivered(row._id, {
            lat: latitude,
            lng: longitude,
            notes: draft.notes || "",
            hubImageUrl: urls[0],
          });
          toast.success("Delivered to hub");
          await fetchAssignments({ silent: true });
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Hub delivery failed"));
        } finally {
          setActionLoadingId("");
        }
      });
    },
    [getDraft, guard, fetchAssignments],
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
