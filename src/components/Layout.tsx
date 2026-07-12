import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Bug,
  Users,
  BrainCircuit,
  ListChecks,
  LogOut,
  ShieldEllipsis,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
 
const NAV_ITEMS = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, adminOnly: false },
  { to: "/sandbox", label: "Sandbox", icon: FlaskConical, adminOnly: false },
  { to: "/safe-vault", label: "Safe Vault", icon: ShieldCheck, adminOnly: false },
  { to: "/threat-intelligence", label: "Threat Intelligence", icon: Bug, adminOnly: false },
  { to: "/attacker-profiles", label: "Attacker Profiles", icon: Users, adminOnly: true },
  { to: "/model-performance", label: "Model & XAI", icon: BrainCircuit, adminOnly: false },
  { to: "/feedback-queue", label: "Feedback Queue", icon: ListChecks, adminOnly: true },
];
 
export const Layout: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
 
  return (
    <div className="flex h-screen w-full overflow-hidden bg-vault-950">
      <aside className="flex w-64 shrink-0 flex-col border-r border-vault-700/60 bg-vault-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-5 py-5">
          <ShieldEllipsis className="h-7 w-7 text-accent-teal" />
          <div>
            <p className="text-sm font-bold leading-tight text-slate-50">PaySim Fraud Intel</p>
            <p className="text-[11px] leading-tight text-slate-500">Admin Console · Phase 5</p>
          </div>
        </div>
 
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : ""}`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
 
        <div className="border-t border-vault-700/60 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-indigo/20 text-sm font-semibold text-accent-indigo">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">{user?.email}</p>
              <span className="badge bg-vault-800 text-slate-400">{user?.role}</span>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary w-full justify-center">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
 
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
 
export default Layout;
