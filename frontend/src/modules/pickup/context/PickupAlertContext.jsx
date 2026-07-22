import React, { createContext, useContext, useRef, useState, useCallback } from "react";

const PickupAlertContext = createContext({
  alerts: [],
  unreadCount: 0,
  setAlertState: () => {},
  markAllRead: () => {},
});

export function PickupAlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const markAllReadFnRef = useRef(() => {});

  const setAlertState = useCallback(({ alerts: a, unreadCount: u, markAllRead: fn }) => {
    setAlerts(a || []);
    setUnreadCount(u || 0);
    if (typeof fn === "function") markAllReadFnRef.current = fn;
  }, []);

  const markAllRead = useCallback(() => {
    markAllReadFnRef.current?.();
  }, []);

  return (
    <PickupAlertContext.Provider value={{ alerts, unreadCount, setAlertState, markAllRead }}>
      {children}
    </PickupAlertContext.Provider>
  );
}

export function usePickupAlertContext() {
  return useContext(PickupAlertContext);
}
