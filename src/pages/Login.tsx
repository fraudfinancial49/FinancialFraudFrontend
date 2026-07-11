import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldEllipsis, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

export const Login: React.FC = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname ?? "/overview";
      navigate(redirectTo, { replace: true });
    } catch {
      // error surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || isLoading;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-vault-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <ShieldEllipsis className="h-10 w-10 text-accent-teal" />
          <h1 className="text-xl font-bold text-slate-50">PaySim Fraud Intelligence</h1>
          <p className="text-sm text-slate-500">
            Admin console for fraud analysts &amp; security officers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-risk-high/40 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              className="input-field"
              placeholder="analyst@bank.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Access is restricted to provisioned fraud analyst &amp; admin accounts. There is no
            self-service registration on this console.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
