import React, { createContext, useContext } from "react";
import { usePickupBroadcasts } from "../hooks/usePickupBroadcasts";

const PickupBroadcastContext = createContext({
  broadcasts: [],
  acceptingId: "",
  acceptBroadcast: () => {},
  dismissBroadcast: () => {},
});

export function PickupBroadcastProvider({ children, onAccepted }) {
  const value = usePickupBroadcasts({ onAccepted });
  return (
    <PickupBroadcastContext.Provider value={value}>
      {children}
    </PickupBroadcastContext.Provider>
  );
}

export function usePickupBroadcastContext() {
  return useContext(PickupBroadcastContext);
}
