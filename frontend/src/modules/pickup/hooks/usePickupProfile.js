import { useCallback, useEffect, useState } from "react";
import { pickupApi } from "../services/pickupApi";
import { getApiErrorMessage } from "../utils/assignmentUtils";

export function usePickupProfile({ autoFetch = true } = {}) {
  const [profile, setProfile] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [assignmentStats, setAssignmentStats] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pRes, wRes, aRes] = await Promise.all([
        pickupApi.getMyProfile(),
        pickupApi.getWithdrawals(),
        pickupApi.getAssignments({ status: "all" }),
      ]);

      if (pRes?.data?.success) setProfile(pRes.data.result);
      if (wRes?.data?.success) setWithdrawals(wRes.data.result?.items || []);

      const items = aRes?.data?.result?.items || [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayPickups = items.filter((r) => {
        const doneAt = r.hubDeliveredAt || r.pickedAt || r.updatedAt;
        return doneAt && new Date(doneAt) >= todayStart && r.status === "hub_delivered";
      }).length;

      setAssignmentStats({
        total: items.length,
        active: items.filter((r) =>
          ["pickup_assigned", "picked"].includes(r.status),
        ).length,
        completed: items.filter((r) => r.status === "hub_delivered").length,
        pending: items.filter((r) => r.status === "pickup_assigned").length,
        todayPickups,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load profile"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetchAll();
  }, [autoFetch, fetchAll]);

  const updateProfile = useCallback(async (payload) => {
    const res = await pickupApi.updateProfile(payload);
    await fetchAll();
    return res;
  }, [fetchAll]);

  const requestWithdrawal = useCallback(
    async (payload) => {
      const res = await pickupApi.requestWithdrawal(payload);
      await fetchAll();
      return res;
    },
    [fetchAll],
  );

  return {
    profile,
    withdrawals,
    assignmentStats,
    loading,
    error,
    fetchAll,
    updateProfile,
    requestWithdrawal,
  };
}
