import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-vault-950 text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-indigo border-t-transparent" />
          Verifying session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-vault-950 text-center text-slate-300">
        <ShieldAlert className="h-10 w-10 text-risk-high" />
        <p className="text-lg font-semibold">Administrator access required</p>
        <p className="max-w-md text-sm text-slate-500">
          This subview is restricted to accounts with the <code>admin</code> role. Contact your
          security lead if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
