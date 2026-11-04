/** Typed API client for LeptoWatch Read-Only Backend */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Common Types ---

export interface FreshnessInfo {
  latest_accepted_date: string | null;
  as_of_date: string;
  age_days: number | null;
  policy_threshold_days: number;
  is_fresh_under_policy: boolean | null;
  status: string;
  policy_caveat: string;
}

export interface PredictionInterval {
  lo: number;
  hi: number;
}

export interface QuantileForecast {
  q0_05: number;
  q0_5: number;
  q0_95: number;
}

// --- Geographic Types ---

export interface GeoRDHSProperties {
  rdhs: string;
  district: string;
  is_district_proxy: boolean;
  proxy_notes?: string | null;
  tier?: string | null;
  data_quality_status?: string | null;
  pE?: number | null;
  pH?: number | null;
  mu?: number | null;
  area_km2?: number | null;
  geometry_valid: boolean;
}

export interface GeoRDHSFeature {
  type: "Feature";
  id?: string | number;
  properties: GeoRDHSProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoRDHSResponse {
  type: "FeatureCollection";
  count: number;
  crs: string;
  geographic_source: string;
  boundary_validation_status: string;
  provisional_warning: string;
  staging_classification_notice: string;
  unparseable_geometries: string[];
  features: GeoRDHSFeature[];
}

// --- Dashboard Summary ---

export interface DashboardSummaryResponse {
  service: string;
  mode: string;
  operational_approval: boolean;
  issue_start: string | null;
  rdhs_count: number;
  tier_counts: Record<string, number>;
  data_quality_counts: Record<string, number>;
  freshness: FreshnessInfo;
  staging_banner: string;
  known_limitations: string[];
}

// --- RDHS Types ---

export interface RDHSSummaryItem {
  rdhs: string;
  district: string;
  tier: string;
  data_quality_status: string;
  pE: number | null;
  pH: number | null;
  mu: number | null;
  reasons: string | null;
}

export interface RDHSListResponse {
  count: number;
  records: RDHSSummaryItem[];
}

export interface RDHSDetailResponse {
  rdhs: string;
  district: string;
  issue_start: string | null;
  tier: string;
  data_quality_status: string;
  record_type: string;
  reasons: string | null;
  data_ok_staging: boolean | null;
  pE: number | null;
  pH: number | null;
  mu: number | null;
  interval: PredictionInterval | null;
  quantiles: QuantileForecast | null;
  nowcast_last3: number | null;
  thrE35: number | null;
  thrH35: number | null;
  C_fire: number | null;
  D_fire: number | null;
  cases_age_days: number | null;
  failures: string | null;
  rule: string | null;
  unverified: boolean | null;
  latest_accepted_case_week: string | null;
}

// --- Forecasts ---

export interface ForecastRecord {
  rdhs: string;
  issue_start: string | null;
  horizon_weeks: number | null;
  predicted_value: number | null;
  interval: PredictionInterval | null;
  quantiles: QuantileForecast | null;
  pE: number | null;
  pH: number | null;
  tier: string;
  data_quality_status: string;
  staging_status: string;
}

export interface ForecastListResponse {
  issue_start: string | null;
  count: number;
  staging_caveat: string;
  records: ForecastRecord[];
}

export interface ForecastDetailResponse {
  rdhs: string;
  issue_start: string | null;
  horizon_weeks: number | null;
  predicted_value: number | null;
  interval: PredictionInterval | null;
  quantiles: QuantileForecast | null;
  pE: number | null;
  pH: number | null;
  tier: string;
  data_quality_status: string;
  staging_status: string;
  operational_approval: boolean;
  cases_age_days: number | null;
  freshness_policy_limit: number;
  reasons: string | null;
}

// --- Alerts ---

export interface AlertRecord {
  rdhs: string;
  tier: string;
  verification_status: string;
  pE: number | null;
  pH: number | null;
  rule: string | null;
  reasons: string | null;
  failures: string | null;
  C_fire: number | null;
  D_fire: number | null;
  unverified: boolean | null;
  detector_safety_notice?: string | null;
}

export interface AlertListResponse {
  issue_start: string | null;
  count: number;
  provisional_notice: string;
  records: AlertRecord[];
}

// --- Environmental Types ---

export interface RainfallSeriesItem {
  week_start: string;
  rainfall_mm: number;
}

export interface SoilMoistureSeriesItem {
  week_start: string;
  volumetric_fraction: number;
}

export interface FloodSummary {
  latest_date: string;
  season: string;
  paddy_obs: number | null;
  land_obs: number | null;
  rule: string;
}

export interface EnvironmentDetailResponse {
  rdhs: string;
  district: string;
  is_district_proxy: boolean;
  proxy_notes: string | null;
  data_sources: string[];
  issue_time_availability_verified: boolean;
  model_inputs_as_of_status: string;
  flood_proxy_notice: string;
  reanalysis_notice: string;
  latest_lag_features: Record<string, number | null>;
  rainfall_series_2023: RainfallSeriesItem[];
  soil_moisture_series_2023: SoilMoistureSeriesItem[];
  flood_summary: FloodSummary | null;
}

// --- History Types ---

export interface HistoryRecord {
  week_start: string;
  year: number;
  week: number;
  t: number;
  cases: number | null;
  cases_ytd: number | null;
  status: "ok" | "nonreporting" | "no_accepted_report";
}

export interface HistorySummary {
  total_weeks: number;
  accepted_weeks_count: number;
  unaccepted_weeks_count: number;
  latest_accepted_week: string | null;
  latest_panel_week: string | null;
  safety_rule: string;
}

export interface HistoryResponse {
  rdhs: string;
  district: string;
  summary: HistorySummary;
  records: HistoryRecord[];
}

// --- Model Performance ---

export interface ModelMetric {
  model_name: string;
  code: string;
  file: string;
  n_samples: number;
  mae: number;
  rmse: number;
  r2: number | null;
  r2_status: string;
  wape: number | null;
  bias: number | null;
  rank: number;
  source_dataset: string;
}

export interface ModelPerformanceResponse {
  evaluation_scope: string;
  locked_test_boundary: string;
  locked_test_status: string;
  operational_approval: boolean;
  model_status: string;
  calibration_summary: string;
  models: ModelMetric[];
}

// --- Data Quality ---

export interface DataQualitySummary {
  total_reports: number;
  accepted_reports: number;
  missing_reports: number;
  nonreporting_reports: number;
  accepted_percentage: number;
  freshness: FreshnessInfo;
  operational_status: string;
  unaccepted_reports_rule: string;
}

export interface RDHSQualityItem {
  rdhs: string;
  total_weeks: number;
  accepted_weeks: number;
  missing_weeks: number;
  nonreporting_weeks: number;
  completeness_pct: number;
  latest_accepted_week: string | null;
  current_status: string;
}

export interface DataQualityResponse {
  national_summary: DataQualitySummary;
  rdhs_breakdown: RDHSQualityItem[];
}

// --- Health ---

export interface DataSourceItem {
  available: boolean;
  rows?: number;
  expected_rdhs_count?: number;
}

export interface HealthResponse {
  service: string;
  service_status: "OK";
  dataset_readiness: "READY" | "DEGRADED" | "UNAVAILABLE";
  version: string;
  mode: string;
  operational_approval: boolean;
  locked_test_evaluated: boolean;
  loading_errors: string[];
  data_sources: Record<string, DataSourceItem>;
  freshness_policy_days: number;
}

// --- Fetch Helper ---

async function fetchJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} at ${endpoint}`);
  }
  return res.json() as Promise<T>;
}

// --- API Methods ---

export function fetchGeoRDHS(signal?: AbortSignal): Promise<GeoRDHSResponse> {
  return fetchJson<GeoRDHSResponse>("/api/geo/rdhs", signal);
}

export function fetchDashboardSummary(signal?: AbortSignal): Promise<DashboardSummaryResponse> {
  return fetchJson<DashboardSummaryResponse>("/api/dashboard/summary", signal);
}

export function fetchRDHSList(signal?: AbortSignal): Promise<RDHSListResponse> {
  return fetchJson<RDHSListResponse>("/api/rdhs", signal);
}

export function fetchRDHSDetail(id: string, signal?: AbortSignal): Promise<RDHSDetailResponse> {
  return fetchJson<RDHSDetailResponse>(`/api/rdhs/${encodeURIComponent(id)}`, signal);
}

export function fetchForecastsLatest(signal?: AbortSignal): Promise<ForecastListResponse> {
  return fetchJson<ForecastListResponse>("/api/forecasts/latest", signal);
}

export function fetchForecastDetail(id: string, signal?: AbortSignal): Promise<ForecastDetailResponse> {
  return fetchJson<ForecastDetailResponse>(`/api/forecasts/${encodeURIComponent(id)}`, signal);
}

export function fetchAlertsLatest(signal?: AbortSignal): Promise<AlertListResponse> {
  return fetchJson<AlertListResponse>("/api/alerts/latest", signal);
}

export function fetchEnvironmentDetail(id: string, signal?: AbortSignal): Promise<EnvironmentDetailResponse> {
  return fetchJson<EnvironmentDetailResponse>(`/api/environment/${encodeURIComponent(id)}`, signal);
}

export function fetchHistory(id: string, limit?: number, signal?: AbortSignal): Promise<HistoryResponse> {
  const query = limit ? `?limit=${limit}` : "";
  return fetchJson<HistoryResponse>(`/api/history/${encodeURIComponent(id)}${query}`, signal);
}

export function fetchModelPerformance(signal?: AbortSignal): Promise<ModelPerformanceResponse> {
  return fetchJson<ModelPerformanceResponse>("/api/model/performance", signal);
}

export function fetchDataQuality(signal?: AbortSignal): Promise<DataQualityResponse> {
  return fetchJson<DataQualityResponse>("/api/data-quality", signal);
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/api/health", signal);
}
