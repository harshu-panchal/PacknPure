import { useEffect, useState } from "react";
import axiosInstance from "@core/api/axios";
import { DEFAULT_GST_RATES } from "@shared/components/VariantGstFields";

export function useGstRates() {
  const [gstRates, setGstRates] = useState(DEFAULT_GST_RATES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosInstance.get("/settings");
        const data = res?.data?.result || res?.data;
        if (!cancelled && Array.isArray(data?.gstRates) && data.gstRates.length) {
          setGstRates(data.gstRates);
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return gstRates;
}
