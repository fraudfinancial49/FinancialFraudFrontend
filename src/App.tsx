import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { ActivityProvider } from "@/store/ActivityContext";
import { ToastProvider } from "@/components/Toast";
import ProtectedRoute from "@/auth/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import SafeVault from "@/pages/SafeVault";
import ThreatIntelligence from "@/pages/ThreatIntelligence";
import AttackerProfiles from "@/pages/AttackerProfiles";
import ModelPerformance from "@/pages/ModelPerformance";
import AdminFeedbackQueue from "@/pages/AdminFeedbackQueue";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ActivityProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/overview" element={<Overview />} />
                <Route path="/safe-vault" element={<SafeVault />} />
                <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
                <Route
                  path="/attacker-profiles"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AttackerProfiles />
                    </ProtectedRoute>
                  }
                />
                <Route path="/model-performance" element={<ModelPerformance />} />
                <Route
                  path="/feedback-queue"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminFeedbackQueue />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </ActivityProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
