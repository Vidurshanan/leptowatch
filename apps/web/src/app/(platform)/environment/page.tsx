"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CloudRain,
  Database,
  Droplets,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartCard,
  EnvironmentalChart,
} from "@/components/charts";
import {
  EnvironmentDetailResponse,
  EnvironmentOverviewResponse,
  EnvironmentSummaryResponse,
  RDHSEnvironmentSummaryItem,
  fetchEnvironmentDetail,
  fetchEnvironmentOverview,
  fetchEnvironmentSummary,
  fetchRDHSList,
  RDHSSummaryItem,
} from "@/lib/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function FreshnessChip({ status }: { status: string }) {
  const style: Record<string, string> = {
    FRESH:       "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    DELAYED:     "bg-amber-900/40 text-amber-300 border-amber-700/50",
    STALE:       "bg-rose-900/40 text-rose-300 border-rose-700/50",
    UNAVAILABLE: "bg-slate-800/60 text-slate-400 border-slate-600/40",
    PARTIAL:     "bg-amber-900/40 text-amber-300 border-amber-700/50",
  };
  const cls = style[status] ?? style["UNAVAILABLE"];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider border ${cls}`}>
      {status}
    </span>
  );
}

function SectionTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-cyan text-cyan"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

type ActiveTab = "rainfall" | "soil" | "combined";

// ─── Rainfall section ────────────────────────────────────────────────────────

function RainfallSection({
  data,
  summaryItems,
  selectedRDHS,
}: {
  data: EnvironmentDetailResponse | null;
  summaryItems: RDHSEnvironmentSummaryItem[];
  selectedRDHS: string;
}) {
  const [period, setPeriod] = useState<"7" | "14" | "30" | "all">("all");

  const rainfallSeries = data?.rainfall_series_2023 ?? [];

  const filteredSeries = useMemo(() => {
    if (period === "all" || rainfallSeries.length === 0) return rainfallSeries;
    const count = period === "7" ? 1 : period === "14" ? 2 : 4;
    return rainfallSeries.slice(-count);
  }, [rainfallSeries, period]);

  const totalMm = useMemo(
    () => filteredSeries.reduce((acc, r) => acc + r.rainfall_mm, 0),
    [filteredSeries]
  );

  return (
    <div className="space-y-4">
      {/* Period sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["7", "14", "30", "all"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-t transition-colors ${
              period === p
                ? "bg-cyan/10 text-cyan border border-b-transparent border-cyan/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "all" ? "Full 2023" : `${p}-day`}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground pr-1">
          {filteredSeries.length} week{filteredSeries.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Accumulated</div>
          <div className="text-xl font-bold font-mono text-cyan mt-0.5">
            {rainfallSeries.length > 0 ? `${totalMm.toFixed(0)} mm` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {period === "all" ? "Full year 2023" : `${period}-day window`}
          </div>
        </div>
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Peak week</div>
          <div className="text-xl font-bold font-mono text-foreground mt-0.5">
            {rainfallSeries.length > 0
              ? `${Math.max(...rainfallSeries.map((r) => r.rainfall_mm)).toFixed(0)} mm`
              : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Highest weekly total</div>
        </div>
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Weekly mean</div>
          <div className="text-xl font-bold font-mono text-foreground mt-0.5">
            {rainfallSeries.length > 0
              ? `${(rainfallSeries.reduce((a, r) => a + r.rainfall_mm, 0) / rainfallSeries.length).toFixed(1)} mm`
              : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Average across 2023</div>
        </div>
      </div>

      {/* Chart */}
      <ChartCard
        title={`Weekly CHIRPS Rainfall — ${selectedRDHS} RDHS`}
        subtitle="CHIRPS satellite-infrared rainfall estimates (mm), weekly resolution, 2023."
        badge={<Badge variant="staging">2023 Historical</Badge>}
        footnote="Source: UCSB-CHG/CHIRPS/DAILY at 0.05° resolution, aggregated to Sri Lanka administrative district."
        isLoading={!data}
        isEmpty={rainfallSeries.length === 0}
        emptyMessage={`No CHIRPS rainfall observations found for ${selectedRDHS} in the 2023 dataset.`}
      >
        {filteredSeries.length > 0 && (
          <EnvironmentalChart
            rainfallSeries={filteredSeries}
            soilMoistureSeries={[]}
            height={240}
          />
        )}
      </ChartCard>

      {/* RDHS comparison table */}
      {summaryItems.length > 0 && (
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan" />
              All-RDHS Rainfall Comparison — Total 2023 (mm)
            </CardTitle>
            <CardDescription className="text-xs">
              Ranked by annual accumulated rainfall. CHIRPS satellite-derived. District-level proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1.5 font-medium">RDHS</th>
                    <th className="text-left pb-1.5 font-medium">District</th>
                    <th className="text-right pb-1.5 font-medium">Total (mm)</th>
                    <th className="text-right pb-1.5 font-medium">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summaryItems]
                    .filter((i) => i.has_rain_data)
                    .sort((a, b) => (b.total_rainfall_2023_mm ?? 0) - (a.total_rainfall_2023_mm ?? 0))
                    .map((item) => {
                      const max = Math.max(...summaryItems.map((i) => i.total_rainfall_2023_mm ?? 0));
                      const pct = max > 0 ? ((item.total_rainfall_2023_mm ?? 0) / max) * 100 : 0;
                      const isSelected = item.rdhs === selectedRDHS;
                      return (
                        <tr
                          key={item.rdhs}
                          className={`border-b border-border/40 ${isSelected ? "bg-cyan/5" : ""}`}
                        >
                          <td className={`py-1.5 ${isSelected ? "text-cyan font-semibold" : "text-foreground"}`}>
                            {item.rdhs}
                          </td>
                          <td className="py-1.5 text-muted-foreground">{item.district}</td>
                          <td className="py-1.5 text-right font-mono text-foreground">
                            {item.total_rainfall_2023_mm?.toFixed(0) ?? "—"}
                          </td>
                          <td className="py-1.5 pl-3 w-24">
                            <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Soil Moisture section ───────────────────────────────────────────────────

function SoilMoistureSection({
  data,
  summaryItems,
  selectedRDHS,
}: {
  data: EnvironmentDetailResponse | null;
  summaryItems: RDHSEnvironmentSummaryItem[];
  selectedRDHS: string;
}) {
  const soilSeries = data?.soil_moisture_series_2023 ?? [];
  const mean =
    soilSeries.length > 0
      ? soilSeries.reduce((a, s) => a + s.volumetric_fraction, 0) / soilSeries.length
      : null;
  const peak =
    soilSeries.length > 0 ? Math.max(...soilSeries.map((s) => s.volumetric_fraction)) : null;
  const min =
    soilSeries.length > 0 ? Math.min(...soilSeries.map((s) => s.volumetric_fraction)) : null;

  // Determine the correct empty-state message based on what we know
  const soilEmptyMessage = !data
    ? "Loading environmental data…"
    : soilSeries.length === 0
    ? `No ERA5-Land soil moisture observations available for ${selectedRDHS} in the 2023 dataset. ` +
      `This district's ERA5-Land reanalysis grid returned all-null values for the 2023 period — ` +
      `this is a source-data gap, not a display error.`
    : undefined;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Annual mean</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
            {mean !== null ? `${(mean * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Volumetric water content</div>
        </div>
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Peak (wet)</div>
          <div className="text-xl font-bold font-mono text-foreground mt-0.5">
            {peak !== null ? `${(peak * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Highest weekly value</div>
        </div>
        <div className="rounded border border-border bg-surface-raised p-3">
          <div className="text-[11px] text-muted-foreground">Trough (dry)</div>
          <div className="text-xl font-bold font-mono text-foreground mt-0.5">
            {min !== null ? `${(min * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Lowest weekly value</div>
        </div>
        {soilSeries.length > 0 && (
          <>
            <div className="rounded border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">First observation</div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {soilSeries[0].week_start}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Week start date</div>
            </div>
            <div className="rounded border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">Latest observation</div>
              <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                {soilSeries[soilSeries.length - 1].week_start}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Week start date</div>
            </div>
            <div className="rounded border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">Observations</div>
              <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                {soilSeries.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Weekly records</div>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <ChartCard
        title={`ERA5-Land Soil Moisture Trajectory — ${selectedRDHS} RDHS`}
        subtitle="Volumetric root-zone soil water content (m³/m³), displayed as % — ERA5-Land climate reanalysis, 2023."
        badge={<Badge variant="staging">ERA5 Reanalysis · Not Direct Observation</Badge>}
        footnote="ERA5-Land is a climate reanalysis dataset produced by ECMWF. It is not a real-time operational sensor telemetry feed."
        isLoading={!data}
        isEmpty={soilSeries.length === 0}
        emptyMessage={soilEmptyMessage}
      >
        {soilSeries.length > 0 && (
          <EnvironmentalChart
            rainfallSeries={[]}
            soilMoistureSeries={soilSeries}
            height={240}
          />
        )}
      </ChartCard>

      {/* RDHS comparison table */}
      {summaryItems.length > 0 && (
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Droplets className="h-4 w-4 text-emerald-400" />
              All-RDHS Soil Moisture Comparison — Mean 2023
            </CardTitle>
            <CardDescription className="text-xs">
              Ranked by mean volumetric soil water content. ERA5-Land reanalysis. District-level proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-1.5 font-medium">RDHS</th>
                    <th className="text-left pb-1.5 font-medium">District</th>
                    <th className="text-right pb-1.5 font-medium">Mean VWC</th>
                    <th className="text-right pb-1.5 font-medium">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summaryItems]
                    .filter((i) => i.has_soil_data)
                    .sort((a, b) => (b.mean_soil_moisture_2023 ?? 0) - (a.mean_soil_moisture_2023 ?? 0))
                    .map((item) => {
                      const max = Math.max(...summaryItems.map((i) => i.mean_soil_moisture_2023 ?? 0));
                      const pct = max > 0 ? ((item.mean_soil_moisture_2023 ?? 0) / max) * 100 : 0;
                      const isSelected = item.rdhs === selectedRDHS;
                      return (
                        <tr
                          key={item.rdhs}
                          className={`border-b border-border/40 ${isSelected ? "bg-emerald-900/10" : ""}`}
                        >
                          <td className={`py-1.5 ${isSelected ? "text-emerald-400 font-semibold" : "text-foreground"}`}>
                            {item.rdhs}
                          </td>
                          <td className="py-1.5 text-muted-foreground">{item.district}</td>
                          <td className="py-1.5 text-right font-mono text-foreground">
                            {item.mean_soil_moisture_2023 !== null
                              ? `${(item.mean_soil_moisture_2023 * 100).toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="py-1.5 pl-3 w-24">
                            <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Combined section ────────────────────────────────────────────────────────

function CombinedSection({
  data,
  selectedRDHS,
}: {
  data: EnvironmentDetailResponse | null;
  selectedRDHS: string;
}) {
  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded border border-cyan/20 bg-surface-raised p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-cyan-bright mb-1">
          <Info className="h-3.5 w-3.5" />
          Combined Analysis — Epidemiological Context Only
        </div>
        Environmental indicators (rainfall, soil moisture, flood proxy) are model lag predictors.
        They support epidemiological context but do not independently determine risk tier.
        Environmental signals must not be used to trigger operational public-health alerts in isolation.
      </div>

      {/* Dual chart */}
      <ChartCard
        title={`Hydrometeorological Trajectory (2023) — ${selectedRDHS} RDHS`}
        subtitle="Dual-axis: CHIRPS precipitation (mm, left) and ERA5-Land volumetric soil moisture (%, right), 52-week series."
        badge={<Badge variant="staging">2023 Weekly · CHIRPS + ERA5-Land</Badge>}
        footnote="CHIRPS: satellite infrared with station calibration (0.05°). ERA5-Land: ECMWF climate reanalysis. Neither is a real-time sensor feed."
        isLoading={!data}
        isEmpty={
          !data?.rainfall_series_2023 || data.rainfall_series_2023.length === 0
        }
      >
        {data?.rainfall_series_2023 && data?.soil_moisture_series_2023 && (
          <EnvironmentalChart
            rainfallSeries={data.rainfall_series_2023}
            soilMoistureSeries={data.soil_moisture_series_2023}
            height={300}
          />
        )}
      </ChartCard>

      {/* Model lag features */}
      {data && Object.keys(data.latest_lag_features).length > 0 && (
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Model Lag Predictors (Latest Feature Vector)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Precipitation lags (rain_l0..rain_l11), soil moisture lags (soil_l0..soil_l7), and SAR flood flags (pflood_l0..pflood_l4).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(data.latest_lag_features).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded border border-border bg-surface-raised p-2 text-center"
                >
                  <div className="text-[11px] font-mono text-muted-foreground">{key}</div>
                  <div className="text-sm font-bold font-mono text-cyan-bright mt-0.5">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sentinel-1 flood summary */}
      {data?.flood_summary && (
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-amber" />
              <CardTitle className="text-sm font-semibold">
                Sentinel-1 SAR Flood Proxy Summary
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-border bg-surface-raised p-2.5">
                <div className="text-muted-foreground">Season</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data.flood_summary.season}
                </div>
              </div>
              <div className="rounded border border-border bg-surface-raised p-2.5">
                <div className="text-muted-foreground">Latest obs date</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data.flood_summary.latest_date}
                </div>
              </div>
              <div className="rounded border border-border bg-surface-raised p-2.5">
                <div className="text-muted-foreground">Paddy obs</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data.flood_summary.paddy_obs ?? "Unavailable"}
                </div>
              </div>
              <div className="rounded border border-border bg-surface-raised p-2.5">
                <div className="text-muted-foreground">Land obs</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data.flood_summary.land_obs ?? "Unavailable"}
                </div>
              </div>
            </div>
            <div className="rounded border border-border bg-surface-raised p-2.5">
              <div className="text-muted-foreground">Detector Safety Rule:</div>
              <div className="text-foreground font-mono mt-0.5 text-[11px]">
                {data.flood_summary.rule}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EnvironmentPage() {
  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [selectedRDHS, setSelectedRDHS] = useState<string>("Colombo");
  const [data, setData] = useState<EnvironmentDetailResponse | null>(null);
  const [overview, setOverview] = useState<EnvironmentOverviewResponse | null>(null);
  const [summary, setSummary] = useState<EnvironmentSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("rainfall");

  // Load RDHS list, overview, summary once
  useEffect(() => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const c3 = new AbortController();

    fetchRDHSList(c1.signal)
      .then((res) => setRdhsList(res.records))
      .catch((err) => {
        if (err.name !== "AbortError") console.error("RDHS list error:", err);
      });

    fetchEnvironmentOverview(c2.signal)
      .then(setOverview)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Overview error:", err);
      });

    fetchEnvironmentSummary(c3.signal)
      .then(setSummary)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Summary error:", err);
      });

    return () => {
      c1.abort();
      c2.abort();
      c3.abort();
    };
  }, []);

  // Load detail on RDHS change
  useEffect(() => {
    if (!selectedRDHS) return;
    const controller = new AbortController();
    setIsLoading(true);
    setData(null);

    fetchEnvironmentDetail(selectedRDHS, controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load environmental data");
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedRDHS]);

  const handleSelectRDHS = (val: string) => {
    setError(null);
    setSelectedRDHS(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Environmental Intelligence
            </h1>
            <Badge variant="unverified">Experimental Staging</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-source geospatial observations: CHIRPS precipitation, ERA5-Land volumetric soil moisture,
            and Sentinel-1 SAR flood proxies — 2023 historical vintage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="env-rdhs-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Health Area:
          </label>
          <select
            id="env-rdhs-select"
            value={selectedRDHS}
            onChange={(e) => handleSelectRDHS(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none min-w-[200px]"
          >
            {rdhsList.map((item) => (
              <option key={item.rdhs} value={item.rdhs}>
                {item.rdhs} {item.district ? `(${item.district})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Caveats banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="font-semibold text-foreground">
              Environmental Data Operational Caveats &amp; Attribution Integrity
            </div>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Climate Reanalysis Notice:</strong>{" "}
              {data?.reanalysis_notice ??
                "ERA5-Land is a climate reanalysis dataset, not a real-time operational sensor telemetry feed."}
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">SAR Flood Proxy &amp; Attribution Notice:</strong>{" "}
              {data?.flood_proxy_notice ??
                "Experimental SAR flood proxy. Optical cross-validation pixel F1 ~0.19 applies to Sentinel-2 reference experiments only. Flood alone must never trigger Warning. Not a validated field-level observation."}
            </p>
          </div>
        </div>
      </div>

      {/* District proxy notice */}
      {data?.is_district_proxy && (
        <div className="rounded-md border border-cyan/30 bg-surface-raised p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-cyan-bright">
            <Info className="h-4 w-4" />
            <span>District Aggregation Proxy Note</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {data.proxy_notes ??
              `${data.rdhs} environmental features are derived from whole-district administrative rasters (${data.district} District), not an area-specific sub-district sensor network.`}
          </p>
        </div>
      )}

      {/* ── SECTION A: Overview cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Rainfall freshness */}
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-cyan" />
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                CHIRPS Rainfall
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <FreshnessChip status={overview?.rainfall.freshness_status ?? "UNAVAILABLE"} />
            <p className="mt-2 text-xs text-muted-foreground">
              Latest: <span className="text-foreground font-mono">{overview?.rainfall.latest_date ?? "—"}</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{overview?.rainfall.data_vintage ?? "—"}</p>
          </CardContent>
        </Card>

        {/* Soil moisture freshness */}
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                ERA5-Land Soil Moisture
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <FreshnessChip status={overview?.soil_moisture.freshness_status ?? "UNAVAILABLE"} />
            <p className="mt-2 text-xs text-muted-foreground">
              Latest: <span className="text-foreground font-mono">{overview?.soil_moisture.latest_date ?? "—"}</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{overview?.soil_moisture.data_vintage ?? "—"}</p>
          </CardContent>
        </Card>

        {/* Geographic coverage */}
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan" />
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Geographic Coverage
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-cyan">
              {overview ? `26 RDHS areas` : "—"}
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
              <div>
                Rainfall:{" "}
                <span className="font-mono text-foreground">
                  {overview ? `${overview.rainfall.coverage_rdhs}/26` : "—"}
                </span>
                {" "}RDHS areas
              </div>
              <div>
                Soil moisture:{" "}
                <span className="font-mono text-foreground">
                  {overview ? `${overview.soil_moisture.coverage_rdhs}/26` : "—"}
                </span>
                {" "}RDHS areas
              </div>
              <div className="text-[10px] mt-1">
                25 administrative districts · Kalmunai represented via Ampara proxy
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SAR safety rule */}
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber" />
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                SAR Flood Safety Rule
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-amber">Strictly Constrained</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Flood proxy alone must never trigger Warning tier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs B/C/D ── */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="pb-0 border-b border-border">
          <div className="flex items-center gap-0 overflow-x-auto">
            <SectionTab
              label="Rainfall Intelligence"
              icon={CloudRain}
              active={activeTab === "rainfall"}
              onClick={() => setActiveTab("rainfall")}
            />
            <SectionTab
              label="Soil Moisture Intelligence"
              icon={Droplets}
              active={activeTab === "soil"}
              onClick={() => setActiveTab("soil")}
            />
            <SectionTab
              label="Combined Analysis"
              icon={Layers}
              active={activeTab === "combined"}
              onClick={() => setActiveTab("combined")}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {error && (
            <div className="py-4 text-center text-xs text-rose-400">{error}</div>
          )}
          {!error && (
            <>
              {activeTab === "rainfall" && (
                <RainfallSection
                  data={data}
                  summaryItems={summary?.items ?? []}
                  selectedRDHS={selectedRDHS}
                />
              )}
              {activeTab === "soil" && (
                <SoilMoistureSection
                  data={data}
                  summaryItems={summary?.items ?? []}
                  selectedRDHS={selectedRDHS}
                />
              )}
              {activeTab === "combined" && (
                <CombinedSection data={data} selectedRDHS={selectedRDHS} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Data Sources footer ── */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan" />
            <CardTitle className="text-sm font-semibold">Environmental Data Sources</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Earth observation and reanalysis products ingested into staging feature vectors.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2">
              <CloudRain className="h-4 w-4 shrink-0 text-cyan mt-0.5" />
              <div>
                <div className="font-medium text-foreground">CHIRPS Daily Rainfall</div>
                <div className="text-muted-foreground">
                  UCSB-CHG/CHIRPS/DAILY — 0.05° gridded satellite infrared with station calibration.
                  Aggregated to Sri Lanka administrative district boundaries (ADM2).
                  <span className="ml-1 text-amber">Satellite-derived estimate, not ground-truth rainfall.</span>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Droplets className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <div className="font-medium text-foreground">ERA5-Land Root-Zone Soil Moisture</div>
                <div className="text-muted-foreground">
                  ECMWF/ERA5_LAND/DAILY_AGGR — Layer 1–3 volumetric soil water content (m³/m³).
                  Climate reanalysis, not direct observation.
                  <span className="ml-1 text-amber">Not a real-time operational telemetry feed.</span>
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Waves className="h-4 w-4 shrink-0 text-amber mt-0.5" />
              <div>
                <div className="font-medium text-foreground">Sentinel-1 SAR Surface Water Flood Proxy</div>
                <div className="text-muted-foreground">
                  LFR v1.0 — Synthetic Aperture Radar dual-pol backscatter flood detection proxy.
                  Optical cross-validation F1 ~0.19 (Sentinel-2 reference experiments).
                  <span className="ml-1 text-rose-400">Not a validated field-level flood observation.</span>
                </div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
