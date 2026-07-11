import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearStoredSession,
  getStoredToken,
  loginRequest,
  registerUnauthorizedHandler,
  setStoredToken,
} from "@/api/client";
import type { UserRole } from "@/types/api";

interface DecodedClaims {
  sub: string; // email
  role: UserRole;
  exp: number;
}

interface AuthUser {
  email: string;
  role: UserRole;
  tokenExpiresAt: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeJwt(token: string): DecodedClaims | null {
  try {
    const base64Payload = token.split(".")[1];
    const padded = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return JSON.parse(decoded) as DecodedClaims;
  } catch {
    return null;
  }
}

function userFromToken(token: string): AuthUser | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  return {
    email: claims.sub,
    role: claims.role,
    tokenExpiresAt: claims.exp,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      const decoded = userFromToken(token);
      const isExpired = decoded ? decoded.tokenExpiresAt * 1000 < Date.now() : true;
      if (decoded && !isExpired) {
        setUser(decoded);
      } else {
        clearStoredSession();
      }
    }
    setIsLoading(false);
    registerUnauthorizedHandler(() => {
      setUser(null);
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await loginRequest(email, password);
      const token: string = data.access_token;
      setStoredToken(token);
      const decoded = userFromToken(token);
      if (!decoded) {
        throw new Error("Received an unreadable access token from the server.");
      }
      setUser(decoded);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Invalid credentials or the authentication service is unreachable.";
      setError(typeof detail === "string" ? detail : "Login failed.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isLoading,
      error,
      login,
      logout,
      clearError,
    }),
    [user, isLoading, error, login, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
