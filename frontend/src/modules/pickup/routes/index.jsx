import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "../styles/pickup-theme.css";
import { PickupAlertProvider } from "../context/PickupAlertContext";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import PickupLayout from "../components/layout/PickupLayout";

const PickupRoutes = () => {
  return (
    <PickupAlertProvider>
      <PickupLayout>
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="/" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </PickupLayout>
    </PickupAlertProvider>
  );
};

export default PickupRoutes;
