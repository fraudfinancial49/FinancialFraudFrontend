// ---------------------------------------------------------------------------
// Mirrors backend/app/schemas/schemas.py exactly (Phase 4 FastAPI service).
// Keep in lock-step with the backend — these are not independently invented.
// ---------------------------------------------------------------------------
 
export type UserRole = "user" | "admin";
 
export interface UserOut {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}
 
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}
 
export type TransactionType = "CASH_IN" | "CASH_OUT" | "DEBIT" | "PAYMENT" | "TRANSFER";
 
export interface TransactionAssessRequest {
  nameOrig: string;
  nameDest: string;
  type: TransactionType;
  amount: number;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  step: number;
  simulated_ip?: string;
  user_agent?: string;
  browser_fingerprint?: string;
}
 
export type RoutingDecision = "approve" | "vault" | "honeypot";
 
export interface TransactionAssessResponse {
  transaction_id: string;
  final_risk_score: number;
  routing_decision: RoutingDecision;
  message: string;
  latency_ms: number;
  honeypot_session_id?: string | null;
  vault_id?: string | null;
}
 
export interface VaultOTPVerifyRequest {
  vault_id: string;
  otp_code: string;
}
 
export type VaultDecision = "approve" | "reject";
 
export interface VaultAdminReviewRequest {
  vault_id: string;
  decision: VaultDecision;
  reason?: string;
}
 
export interface VaultMoveRequest {
  transaction_id: string;
  reason: string;
}
 
export interface HoneypotStartRequest {
  transaction_id?: string;
  simulated_ip?: string;
  user_agent?: string;
  browser_fingerprint?: string;
  risk_score_at_entry?: number;
}
 
export interface HoneypotAdvanceRequest {
  session_id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}
 
export interface HoneypotCloseRequest {
  session_id: string;
}
 
export type ConfirmedOutcome = "fraud" | "legitimate" | "unknown";
 
export interface FeedbackSubmitRequest {
  transaction_id: string;
  confirmed_outcome: ConfirmedOutcome;
  notes?: string;
}
 
export interface GenericStatus<T = Record<string, unknown>> {
  status: string;
  message?: string;
  data?: T;
}
 
export interface ModelMetricRow {
  model_name?: string;
  [key: string]: unknown;
}
 
export interface ModelInfoResponse {
  status?: "not_loaded";
  best_model?: string;
  engines_loaded?: string[];
  tree_feature_count?: number;
  deep_feature_count?: number;
  model_metrics?: ModelMetricRow[];
}
 
export interface ReadyResponse {
  status: "ready" | "not_ready";
  checks: {
    database: boolean;
    models_loaded: boolean;
    graph_loaded: boolean;
  };
}
 
export interface AttackerProfilingResult {
  status: "completed" | "skipped_insufficient_data";
  n_profiles_updated: number;
  n_clusters?: number;
}
 
// -- Explainability (per-transaction SHAP) -------------------------------
// Requires a live backend route: GET /api/v1/transactions/{id}/explain
// returning the frozen SHAP explainer's base value plus a feature -> impact
// dictionary for that specific transaction. This is NOT part of the Phase 4
// service as originally documented elsewhere in this notebook — confirm the
// route is deployed before relying on this panel in a live demo.
export interface ShapFeatureContribution {
  feature: string;
  impact: number;
}
 
export interface ShapExplanationResponse {
  transaction_id: string;
  base_value: number;
  features: Record<string, number>;
  predicted_score?: number;
}
 
// -- Admin retrain trigger -------------------------------------------------
// Requires a live backend route: POST /api/v1/admin/retrain. Also not part
// of the Phase 4 service as originally documented — confirm deployment.
export interface RetrainTriggerResponse {
  status: string;
  message?: string;
  job_id?: string;
}
 
// ---------------------------------------------------------------------------
// System-wide analytics & history (NEW — requires new backend GET endpoints)
// ---------------------------------------------------------------------------
// These types back the Overview dashboard's date-wise analytics. They assume
// three backend routes that do not exist yet in the Phase 4 service:
//   GET /api/v1/analytics/summary?start_date=&end_date=
//   GET /api/v1/analytics/timeseries?start_date=&end_date=&interval=day
//   GET /api/v1/transactions?start_date=&end_date=&routing_decision=&page=&page_size=
// See the accompanying change document's "Backend requirements" section for
// the exact response shapes these types were written against. Do not treat
// this section as confirmation the routes exist — it is the contract the
// frontend needs the backend to satisfy.
 
export type TransactionSource = "system_auto" | "manual_sandbox";
 
export interface TransactionAnalyticsSummary {
  start_date: string;
  end_date: string;
  total_transactions: number;
  total_volume: number;
  approve_count: number;
  vault_count: number;
  honeypot_count: number;
  flagged_count: number; // vault_count + honeypot_count
  fraud_rate: number; // flagged_count / total_transactions, 0 when total is 0
  avg_risk_score: number;
  avg_latency_ms: number;
}
 
export interface TransactionTimeseriesPoint {
  date: string; // ISO date (YYYY-MM-DD), one bucket per day
  total: number;
  approve_count: number;
  vault_count: number;
  honeypot_count: number;
  flagged_count: number;
}
 
export interface TransactionListItem {
  transaction_id: string;
  name_orig: string;
  name_dest: string;
  type: TransactionType;
  amount: number;
  final_risk_score: number;
  routing_decision: RoutingDecision;
  timestamp: string;
  source: TransactionSource;
}
 
export interface TransactionListResponse {
  items: TransactionListItem[];
  total: number;
  page: number;
  page_size: number;
}
 
export interface DateRangeQuery {
  start_date?: string; // YYYY-MM-DD, inclusive
  end_date?: string; // YYYY-MM-DD, inclusive
}
 
// -- Locally-tracked (client-side) sandbox echo --------------------------
// IMPORTANT — scope change: this is no longer the admin dashboard's source
// of truth. It exists only so the Sandbox page (src/pages/Sandbox.tsx) can
// show an analyst an immediate, session-local echo of transactions THEY
// personally submitted for manual testing. Real system-wide figures on the
// Overview dashboard are now read from the analytics endpoints above.
// This still resets on reload by design — it was never meant to persist.
 
export interface AssessedTransactionRecord extends TransactionAssessResponse {
  id: string;
  timestamp: string;
  request: TransactionAssessRequest;
}
 
export interface VaultCaseRecord {
  vault_id: string;
  transaction_id: string;
  status: "frozen" | "otp_verified" | "released" | "rejected";
  reason?: string;
  created_at: string;
}
 
export interface ProfilingRunRecord {
  id: string;
  timestamp: string;
  result: AttackerProfilingResult;
}
 
