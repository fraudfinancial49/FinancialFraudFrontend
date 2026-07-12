import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type {
  DateRangeQuery,
  TransactionAnalyticsSummary,
  TransactionTimeseriesPoint,
  TransactionListResponse,
  RoutingDecision,
} from "@/types/api";
 
export const TOKEN_STORAGE_KEY = "fraud_admin_access_token";
export const USER_STORAGE_KEY = "fraud_admin_user";
 
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}
 
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}
 
export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}
 
// Deployed Phase 4 FastAPI backend (Render). Override at build time with a
// VITE_API_BASE_URL env var (see frontend/.env) if you deploy the backend
// somewhere else — no code change needed, just a different env value.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://financialfraudbackend.onrender.com";
 
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});
 
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
 
// Type for the callback the AuthContext registers so the interceptor can
// trigger a clean logout + redirect without a circular import into React.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
 
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}
 
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearStoredSession();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      } else if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
 
// Login uses OAuth2PasswordRequestForm on the backend (application/x-www-form-urlencoded),
// so it needs its own content-type rather than the shared JSON client default.
export async function loginRequest(username: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);
  const response = await apiClient.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return response.data;
}
 
// ---------------------------------------------------------------------------
// System-wide analytics & transaction history (NEW)
// ---------------------------------------------------------------------------
// These call backend routes that need to be built to match — see the
// "Backend requirements" section of the accompanying change document.
// All three fail gracefully from the caller's side (Overview.tsx catches and
// shows an empty/error state) so the app doesn't crash while the matching
// backend routes are still pending.
 
export async function fetchAnalyticsSummary(
  params: DateRangeQuery
): Promise<TransactionAnalyticsSummary> {
  const response = await apiClient.get<TransactionAnalyticsSummary>(
    "/api/v1/analytics/summary",
    { params }
  );
  return response.data;
}
 
export async function fetchAnalyticsTimeseries(
  params: DateRangeQuery & { interval?: "day" | "week" }
): Promise<TransactionTimeseriesPoint[]> {
  const response = await apiClient.get<TransactionTimeseriesPoint[]>(
    "/api/v1/analytics/timeseries",
    { params }
  );
  return response.data;
}
 
export async function fetchTransactions(
  params: DateRangeQuery & {
    routing_decision?: RoutingDecision;
    page?: number;
    page_size?: number;
  }
): Promise<TransactionListResponse> {
  const response = await apiClient.get<TransactionListResponse>(
    "/api/v1/transactions",
    { params }
  );
  return response.data;
}
 
export default apiClient;
 
