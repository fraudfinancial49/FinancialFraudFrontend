import logo from "@/assets/FinFraudShieldImg.png";
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

export const Login: React.FC = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <img
          src={logo}
          alt="FinFraudShield Logo"
          className="h-24 w-24 object-contain"
        />

        <h1 className="text-2xl font-bold text-slate-50">
          FinFraudShield
        </h1>

        <p className="text-sm text-slate-500 max-w-xs">
          AI-Powered Fraud Detection & Transaction Security Platform
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

  <div className="relative">
    <input
      id="password"
      type={showPassword ? "text" : "password"}
      required
      autoComplete="current-password"
      className="input-field pr-12"
      placeholder="••••••••"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-200"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? (
        <EyeOff className="h-5 w-5" />
      ) : (
        <Eye className="h-5 w-5" />
      )}
    </button>
  </div>
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
