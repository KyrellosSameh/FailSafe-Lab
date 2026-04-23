import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import AdminDashboard from "../pages/admin/AdminDashboard";
import { ProtectedAdminRoute } from "./ProtectedRoute";

export default function AdminRoutes() {
  const navigate = useNavigate();

  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    const token = sessionStorage.getItem("app_adminToken");
    return token && token.length > 20;
  });

  useEffect(() => {
    if (adminLoggedIn) {
      const token = sessionStorage.getItem("app_adminToken");
      if (!token || token.length < 20) {
        sessionStorage.setItem("app_adminToken", Math.random().toString(36).substring(2) + Date.now().toString(36));
      }
    } else {
      sessionStorage.removeItem("app_adminToken");
    }
  }, [adminLoggedIn]);

  return (
    <ProtectedAdminRoute
      adminLoggedIn={adminLoggedIn}
      onLogin={() => {
        setAdminLoggedIn(true);
        navigate("/secure/ctrl-panel-9x7k2/dashboard");
      }}
      onBack={() => navigate("/")}
    >
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <AdminDashboard
              onBack={() => {
                setAdminLoggedIn(false);
                navigate("/");
              }}
            />
          }
        />
      </Routes>
    </ProtectedAdminRoute>
  );
}
