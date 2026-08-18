import logo from "@/assets/FinFraudShieldImg.png";
import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Bug,
  BrainCircuit,
  ListChecks,
  LogOut,
  FlaskConical,
  Menu,
  UserSearch,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

const NAV_ITEMS = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, adminOnly: false },
  { to: "/sandbox", label: "Sandbox", icon: FlaskConical, adminOnly: false },
  { to: "/safe-vault", label: "Safe Vault", icon: ShieldCheck, adminOnly: false },
  { to: "/attacker-profiles", label: "Threat Intelligence", icon: Bug, adminOnly: true },
  { to: "/account-lookup", label: "Account Lookup", icon: UserSearch, adminOnly: true },
  { to: "/model-performance", label: "Model & XAI", icon: BrainCircuit, adminOnly: false },
  { to: "/feedback-queue", label: "Feedback Queue", icon: ListChecks, adminOnly: true },
];

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-vault-950">
      <aside className={`flex shrink-0 flex-col border-r border-vault-700/60 bg-vault-900/60 backdrop-blur-sm transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}>
        <div className="flex items-center justify-between border-b border-vault-700/60 px-4 py-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={logo} alt="FinFraudShield Logo" className="h-10 w-10 rounded-lg object-contain" />
            {!collapsed && (
              <div>
                <p className="text-base font-bold text-slate-50">FinFraudShield</p>
                <p className="text-xs text-slate-500">AI Fraud Prevention Platform</p>
              </div>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 transition hover:bg-vault-800" title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
            <Menu className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : ""}
                className={({ isActive }) => `nav-link ${collapsed ? "justify-center" : ""} ${isActive ? "nav-link-active" : ""}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-vault-700/60 px-4 py-4">
          <div className={`mb-3 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-indigo/20 text-sm font-semibold text-accent-indigo">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">{user?.email}</p>
                <span className="badge bg-vault-800 text-slate-400">{user?.role}</span>
              </div>
            )}
          </div>

          <button onClick={logout} title="Sign out" className={`btn-secondary ${collapsed ? "justify-center" : "w-full justify-center"}`}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
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
