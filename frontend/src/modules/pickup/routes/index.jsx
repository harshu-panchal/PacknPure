import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Auth from "../pages/Auth";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import PickupLayout from "../components/layout/PickupLayout";

const PickupRoutes = () => {
  return (
    <PickupLayout>
      <Routes>
        <Route path="auth" element={<Auth />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </PickupLayout>
  );
};

export default PickupRoutes;

