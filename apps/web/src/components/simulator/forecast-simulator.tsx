"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CloudRain,
  Database,
  Droplets,
  Info,
  Layers,
  Play,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchHistoricalSimulation,
  fetchLatestSnapshotForecast,
  fetchScenarioSimulation,
  fetchSimulatorDiscovery,
  HistoricalSimulationResponse,
  LatestSnapshotForecastResponse,
  PresetScenarioOption,
  ScenarioSimulationRequest,
  ScenarioSimulationResponse,
  SimulatorDiscoveryResponse,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

type SimulatorTab = "historical" | "snapshot" | "scenario";

const FALLBACK_PRESETS: PresetScenarioOption[] = [
  {
    id: "baseline",
    name: "Baseline Conditions (1.0x)",
    description: "Observed historical environmental conditions without modification.",
    rainfall_factor: 1.0,
    rainfall_anomaly_offset_mm: 0.0,
    soil_moisture_offset: 0.0,
    category: "Baseline",
  },
  {
    id: "monsoon_moderate",
    name: "Moderate Monsoonal Surge (+25% Rain)",
    description: "A 25% increase in antecedent rainfall across recent 4–12 weeks with mild root-zone soil saturation.",
    rainfall_factor: 1.25,
    rainfall_anomaly_offset_mm: 25.0,
    soil_moisture_offset: 0.03,
    category: "Rainfall",
  },
  {
    id: "monsoon_heavy",
    name: "Heavy Monsoonal Precipitation (+50% Rain)",
    description: "A 50% increase in antecedent rainfall accompanied by elevated soil water content (+0.07 m³/m³).",
    rainfall_factor: 1.50,
    rainfall_anomaly_offset_mm: 60.0,
    soil_moisture_offset: 0.07,
    category: "Rainfall",
  },
  {
    id: "extreme_flood",
    name: "Extreme Precipitation & Flood Event (+100% Rain)",
    description: "Doubled cumulative precipitation simulating tropical depression / severe monsoon inundation (+0.12 m³/m³ soil moisture).",
    rainfall_factor: 2.00,
    rainfall_anomaly_offset_mm: 120.0,
    soil_moisture_offset: 0.12,
    category: "Extreme",
  },
  {
    id: "soil_saturation",
    name: "Saturated Root-Zone Soil (+0.10 m³/m³)",
    description: "Elevated soil moisture holding constant baseline rainfall, testing hydrological reservoir retention effects.",
    rainfall_factor: 1.0,
    rainfall_anomaly_offset_mm: 0.0,
    soil_moisture_offset: 0.10,
    category: "Soil Moisture",
  },
  {
    id: "drought_deficit",
    name: "Severe Rainfall Deficit / Drought (-50% Rain)",
    description: "A 50% suppression in antecedent precipitation with depleted soil moisture (-0.06 m³/m³).",
    rainfall_factor: 0.50,
    rainfall_anomaly_offset_mm: -50.0,
    soil_moisture_offset: -0.06,
    category: "Drought",
  },
];

interface ForecastSimulatorProps {
  initialRDHS?: string;
  onSelectRDHS?: (rdhs: string) => void;
}

export function ForecastSimulator({
  initialRDHS = "Kurunegala",
  onSelectRDHS,
}: ForecastSimulatorProps) {
  const [activeTab, setActiveTab] = useState<SimulatorTab>("historical");
  const [discovery, setDiscovery] = useState<SimulatorDiscoveryResponse | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState<boolean>(true);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Common selector
  const [selectedRDHS, setSelectedRDHS] = useState<string>(initialRDHS);

  // Mode A: Historical Replay State
  const [historicalDate, setHistoricalDate] = useState<string>("2024-03-30");
  const [historicalMode, setHistoricalMode] = useState<string>("both");
  const [historicalResult, setHistoricalResult] = useState<HistoricalSimulationResponse | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState<boolean>(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  // Mode B: Latest Snapshot State
  const [snapshotResult, setSnapshotResult] = useState<LatestSnapshotForecastResponse | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // Mode C: Scenario Simulation State
  const [scenarioDate, setScenarioDate] = useState<string>("2024-03-30");
  const [scenarioName, setScenarioName] = useState<string>("Heavy Monsoonal Precipitation (+50% Rain)");
  const [rainfallFactor, setRainfallFactor] = useState<number>(1.5);
  const [rainfallAnomalyOffset, setRainfallAnomalyOffset] = useState<number>(50.0);
  const [soilMoistureOffset, setSoilMoistureOffset] = useState<number>(0.07);
  const [scenarioResult, setScenarioResult] = useState<ScenarioSimulationResponse | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState<boolean>(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Sync initial RDHS if prop changes
  useEffect(() => {
    if (initialRDHS) setSelectedRDHS(initialRDHS);
  }, [initialRDHS]);

  // Load discovery data on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchSimulatorDiscovery(controller.signal)
      .then((data) => {
        setDiscovery(data);
        setDiscoveryLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setDiscoveryError(err instanceof Error ? err.message : "Failed to load simulator metadata");
          setDiscoveryLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  // Handle RDHS change
  const handleRDHSChange = (newRDHS: string) => {
    setSelectedRDHS(newRDHS);
    if (onSelectRDHS) onSelectRDHS(newRDHS);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: MODE A — RUN HISTORICAL SIMULATION
  // ─────────────────────────────────────────────────────────────────────────
  const handleRunHistorical = () => {
    setHistoricalLoading(true);
    setHistoricalError(null);
    fetchHistoricalSimulation(selectedRDHS, historicalDate, historicalMode)
      .then((res) => {
        setHistoricalResult(res);
        setHistoricalLoading(false);
      })
      .catch((err) => {
        setHistoricalError(err instanceof Error ? err.message : "Historical simulation failed");
        setHistoricalLoading(false);
      });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: MODE B — EVALUATE LATEST SNAPSHOT
  // ─────────────────────────────────────────────────────────────────────────
  const handleRunSnapshot = () => {
    setSnapshotLoading(true);
    setSnapshotError(null);
    fetchLatestSnapshotForecast(selectedRDHS)
      .then((res) => {
        setSnapshotResult(res);
        setSnapshotLoading(false);
      })
      .catch((err) => {
        setSnapshotError(err instanceof Error ? err.message : "Failed to evaluate snapshot");
        setSnapshotLoading(false);
      });
  };

  // Auto-run snapshot when switching to Tab B if empty
  useEffect(() => {
    if (activeTab === "snapshot" && !snapshotResult && !snapshotLoading) {
      handleRunSnapshot();
    }
  }, [activeTab, selectedRDHS]);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: MODE C — RUN SCENARIO SIMULATION
  // ─────────────────────────────────────────────────────────────────────────
  const handleRunScenario = () => {
    setScenarioLoading(true);
    setScenarioError(null);

    const payload: ScenarioSimulationRequest = {
      rdhs: selectedRDHS,
      baseline_date: scenarioDate,
      scenario_name: scenarioName,
      rainfall_factor: rainfallFactor,
      rainfall_anomaly_offset_mm: rainfallAnomalyOffset,
      soil_moisture_offset: soilMoistureOffset,
    };

    fetchScenarioSimulation(payload)
      .then((res) => {
        setScenarioResult(res);
        setScenarioLoading(false);
      })
      .catch((err) => {
        setScenarioError(err instanceof Error ? err.message : "Scenario simulation failed");
        setScenarioLoading(false);
      });
  };

  // Apply scenario preset
  const handleApplyPreset = (preset: PresetScenarioOption) => {
    setScenarioName(preset.name);
    setRainfallFactor(preset.rainfall_factor);
    setRainfallAnomalyOffset(preset.rainfall_anomaly_offset_mm);
    setSoilMoistureOffset(preset.soil_moisture_offset);
  };

  return (
    <div className="space-y-4">
      {/* Simulator Section Header Card */}
      <Card className="border-cyan/40 bg-gradient-to-r from-surface via-surface-raised to-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-cyan/40 bg-cyan/10 p-2 text-cyan">
                <Sparkles className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold text-foreground tracking-tight">
                    Interactive Forecast Simulator
                  </CardTitle>
                  <Badge variant="staging">Backend Inference</Badge>
                  <Badge variant="teal" className="border-cyan/30 text-cyan text-[10px]">
                    Model v1.0.0
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Live backend demonstration combining historical real-time replay, operational freshness audits, and hydrological what-if scenarios.
                </CardDescription>
              </div>
            </div>

            {/* Area Selector */}
            <div className="flex items-center gap-2 self-start lg:self-center">
              <label htmlFor="sim-rdhs-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Selected Area:
              </label>
              <select
                id="sim-rdhs-select"
                value={selectedRDHS}
                onChange={(e) => handleRDHSChange(e.target.value)}
                className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-foreground focus:border-cyan focus:outline-none"
              >
                {(discovery?.rdhs_areas || [selectedRDHS]).map((rdhs) => (
                  <option key={rdhs} value={rdhs}>
                    {rdhs} RDHS
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Three Internal Tabs */}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/80 pt-3">
            <Button
              variant={activeTab === "historical" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("historical")}
              className={`h-8 gap-2 text-xs ${
                activeTab === "historical"
                  ? "bg-cyan text-slate-950 hover:bg-cyan-bright font-semibold shadow-sm"
                  : "border-border text-foreground hover:bg-surface-raised hover:text-cyan"
              }`}
            >
              <Clock className="size-3.5" />
              1. Simulated Real-Time (Mode A)
            </Button>

            <Button
              variant={activeTab === "snapshot" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("snapshot")}
              className={`h-8 gap-2 text-xs ${
                activeTab === "snapshot"
                  ? "bg-cyan text-slate-950 hover:bg-cyan-bright font-semibold shadow-sm"
                  : "border-border text-foreground hover:bg-surface-raised hover:text-cyan"
              }`}
            >
              <ShieldAlert className="size-3.5" />
              2. Latest Accepted Snapshot (Mode B)
            </Button>

            <Button
              variant={activeTab === "scenario" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("scenario")}
              className={`h-8 gap-2 text-xs ${
                activeTab === "scenario"
                  ? "bg-cyan text-slate-950 hover:bg-cyan-bright font-semibold shadow-sm"
                  : "border-border text-foreground hover:bg-surface-raised hover:text-cyan"
              }`}
            >
              <Sliders className="size-3.5" />
              3. Environmental Scenarios (Mode C)
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────────
          TAB 1: MODE A — SIMULATED REAL-TIME FORECASTING
      ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "historical" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-12 md:items-end">
                {/* Historical Date Selector */}
                <div className="space-y-1.5 md:col-span-5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-cyan" />
                    Eligible Historical Issue Date (Pre-2025):
                  </label>
                  <select
                    value={historicalDate}
                    onChange={(e) => setHistoricalDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
                  >
                    {(discovery?.sample_dates || []).map((d) => (
                      <option key={d.date} value={d.date}>
                        {d.label}
                      </option>
                    ))}
                    {!discovery?.sample_dates?.some((d) => d.date === historicalDate) && (
                      <option value={historicalDate}>{historicalDate} (Custom Pre-2025 Date)</option>
                    )}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Strict pre-2025 constraint prevents leakage; locked test period (2025+) is blocked.
                  </p>
                </div>

                {/* Execution Mode */}
                <div className="space-y-1.5 md:col-span-4">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-cyan" />
                    Execution & Verification Mode:
                  </label>
                  <select
                    value={historicalMode}
                    onChange={(e) => setHistoricalMode(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
                  >
                    <option value="both">Live Inference + Archived OOF Benchmark</option>
                    <option value="live_inference">Live Model Inference Only</option>
                    <option value="archived_oof">Archived OOF Benchmark Record Only</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Compare newly computed inference against frozen OOF artifacts.
                  </p>
                </div>

                {/* Submit Button */}
                <div className="md:col-span-3">
                  <Button
                    onClick={handleRunHistorical}
                    disabled={historicalLoading}
                    className="w-full h-9 bg-cyan text-slate-950 hover:bg-cyan-bright font-semibold text-xs gap-1.5 shadow-sm"
                  >
                    {historicalLoading ? (
                      <>Executing Live Inference...</>
                    ) : (
                      <>
                        <Play className="size-3.5 fill-current" />
                        Generate Forecast
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {historicalError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-rose-400" />
              <span>{historicalError}</span>
            </div>
          )}

          {/* Results Display */}
          {historicalResult && (
            <div className="space-y-4">
              {/* Top Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Predicted Cases (μ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-cyan-bright">
                      {historicalResult.live_inference?.mu.toFixed(1) ?? "--"}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Horizon: +3 to +5 Weeks Ahead ({historicalResult.forecast_target.split("(")[0]})
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      CQR Prediction Interval
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-foreground">
                      {historicalResult.live_inference?.interval
                        ? `[${historicalResult.live_inference.interval.lo.toFixed(1)}, ${historicalResult.live_inference.interval.hi.toFixed(1)}]`
                        : "--"}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Empirical 90% Conformal Quantile Bounds
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Surge Probability & Tier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold font-mono text-amber-400">
                        {historicalResult.live_inference?.pE !== null && historicalResult.live_inference?.pE !== undefined
                          ? `${(historicalResult.live_inference.pE * 100).toFixed(1)}%`
                          : "--"}
                      </span>
                      <Badge variant={getTierBadgeVariant(historicalResult.live_inference?.tier || "Watch")}>
                        {historicalResult.live_inference?.tier || "Watch"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      p(E) early surge: {((historicalResult.live_inference?.pE || 0) * 100).toFixed(0)}% | p(H) high surge: {((historicalResult.live_inference?.pH || 0) * 100).toFixed(0)}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actual Historical Ground Truth
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      {historicalResult.actual_outcome.is_available
                        ? `${historicalResult.actual_outcome.actual_cases?.toFixed(1)} cases`
                        : "Pending (Future Window)"}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {historicalResult.actual_outcome.is_available
                        ? `Prediction Error: ${historicalResult.actual_outcome.error! > 0 ? "+" : ""}${historicalResult.actual_outcome.error} (${historicalResult.actual_outcome.pct_error}%)`
                        : "Outcome unrecorded at simulation point"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Side-by-Side Live vs Archived Benchmark Comparison */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Live Model Inference */}
                <Card className="border-border/80 bg-surface">
                  <CardHeader className="border-b border-border pb-2.5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Activity className="size-4 text-cyan" />
                        Live Backend Model Inference
                      </CardTitle>
                      <Badge variant="teal" className="border-cyan/40 text-cyan text-[10px]">
                        Dynamic Compute
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 text-xs space-y-2">
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground">Model Architecture:</span>
                      <span className="font-mono text-foreground font-medium">
                        {historicalResult.live_inference?.model_name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground">Predicted Point Mean (μ):</span>
                      <span className="font-mono font-bold text-cyan-bright">
                        {historicalResult.live_inference?.mu.toFixed(2)} cases
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground">CQR Prediction Interval [lo, hi]:</span>
                      <span className="font-mono text-foreground">
                        [{historicalResult.live_inference?.interval?.lo.toFixed(2)}, {historicalResult.live_inference?.interval?.hi.toFixed(2)}]
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground">Quantile Distribution [q0.05, q0.5, q0.95]:</span>
                      <span className="font-mono text-muted-foreground">
                        [{historicalResult.live_inference?.quantiles?.q0_05.toFixed(1)}, {historicalResult.live_inference?.quantiles?.q0_5.toFixed(1)}, {historicalResult.live_inference?.quantiles?.q0_95.toFixed(1)}]
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground italic pt-1">
                      {historicalResult.live_inference?.provenance_note}
                    </div>
                  </CardContent>
                </Card>

                {/* Archived Out-of-Fold Benchmark Record */}
                <Card className="border-border/80 bg-surface">
                  <CardHeader className="border-b border-border pb-2.5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Database className="size-4 text-amber-400" />
                        Archived OOF Benchmark Prediction
                      </CardTitle>
                      <Badge variant="staging" className="border-amber-400/40 text-amber-400 text-[10px]">
                        Historical Artifact
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 text-xs space-y-2">
                    {historicalResult.archived_oof ? (
                      <>
                        <div className="flex justify-between border-b border-border/60 pb-1.5">
                          <span className="text-muted-foreground">Benchmark Model:</span>
                          <span className="font-mono text-foreground font-medium">
                            {historicalResult.archived_oof.model_name}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/60 pb-1.5">
                          <span className="text-muted-foreground">Archived Point Prediction:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {historicalResult.archived_oof.mu.toFixed(2)} cases
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/60 pb-1.5">
                          <span className="text-muted-foreground">Archived Interval [lo, hi]:</span>
                          <span className="font-mono text-foreground">
                            [{historicalResult.archived_oof.interval?.lo.toFixed(2)}, {historicalResult.archived_oof.interval?.hi.toFixed(2)}]
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/60 pb-1.5">
                          <span className="text-muted-foreground">Surge Probabilities [pE, pH]:</span>
                          <span className="font-mono text-muted-foreground">
                            [{(historicalResult.archived_oof.pE! * 100).toFixed(1)}%, {(historicalResult.archived_oof.pH! * 100).toFixed(1)}%]
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground italic pt-1">
                          {historicalResult.archived_oof.provenance_note}
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center text-muted-foreground">
                        No archived OOF benchmark record for this specific week.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Input Feature Snapshot & Outcome Validation Card */}
              <Card className="border-border/80 bg-surface">
                <CardHeader className="border-b border-border pb-2.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      Historical Input Snapshot (t={historicalResult.t}, {historicalResult.issue_date})
                    </CardTitle>
                    {historicalResult.actual_outcome.is_available && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        Interval Coverage: {historicalResult.actual_outcome.inside_interval ? "Target Inside Bounds" : "Target Outside Bounds"}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">c_last1 (Last Week)</div>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                        {historicalResult.input_snapshot.c_last1 ?? "--"}
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">c_last4 (4-Week Total)</div>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                        {historicalResult.input_snapshot.c_last4 ?? "--"}
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">c_trend4 (Trajectory)</div>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                        {historicalResult.input_snapshot.c_trend4?.toFixed(2) ?? "--"}
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">b1_clim_mean</div>
                      <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                        {historicalResult.input_snapshot.b1_clim_mean?.toFixed(1) ?? "--"}
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">thrE35 (Early Threshold)</div>
                      <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                        {historicalResult.input_snapshot.thrE35?.toFixed(1) ?? "--"}
                      </div>
                    </div>
                    <div className="rounded border border-border/60 bg-surface-raised p-2">
                      <div className="text-[10px] text-muted-foreground">thrH35 (High Threshold)</div>
                      <div className="font-mono font-bold text-rose-400 text-sm mt-0.5">
                        {historicalResult.input_snapshot.thrH35?.toFixed(1) ?? "--"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!historicalResult && !historicalLoading && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              Select an eligible pre-2025 historical issue date above and click{" "}
              <strong className="text-cyan">Generate Forecast</strong> to execute live model inference and compare against ground truth outcomes.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          TAB 2: MODE B — LATEST ACCEPTED SURVEILLANCE SNAPSHOT
      ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "snapshot" && (
        <div className="space-y-4">
          {/* Operational Freshness Gate Warning Banner */}
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-xs text-amber-200 shadow-[var(--shadow-panel)]">
            <div className="flex items-start gap-3">
              <ShieldAlert className="size-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wide uppercase text-amber-300">
                    EXPERIMENTAL FORECAST — STALE SURVEILLANCE INPUTS
                  </span>
                  <Badge variant="unverified">56-Day Gate Active</Badge>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  The latest officially accepted surveillance report is dated{" "}
                  <strong className="text-amber-100 font-mono">
                    {snapshotResult?.latest_accepted_date || "2026-08-10"}
                  </strong>{" "}
                  ({snapshotResult?.age_days ?? 90} days old). Because this delay exceeds the project safety limit of 56 days, operational public-health release and automated alert dispatch remain strictly gated.
                </p>
              </div>
            </div>
          </div>

          {/* Status Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Latest Accepted Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono text-cyan">
                  {snapshotResult?.latest_accepted_date || "2026-08-10"}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Epidemiological surveillance week
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reporting Delay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono text-rose-400">
                  {snapshotResult?.age_days ?? "--"} Days
                </div>
                <p className="mt-1 text-[11px] text-rose-300/80">
                  Policy Threshold: {snapshotResult?.policy_threshold_days ?? 56} Days (Exceeded)
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Operational Release
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono text-rose-500">
                  BLOCKED
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                  Gated by Freshness Policy
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Experimental Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold font-mono text-cyan-bright">
                  {snapshotResult?.forecast_record?.predicted_value !== undefined && snapshotResult.forecast_record.predicted_value !== null
                    ? `${snapshotResult.forecast_record.predicted_value.toFixed(1)} cases`
                    : "--"}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Staging candidate ({snapshotResult?.forecast_record?.tier || "Watch"} tier)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Staging Forecast Detail & Input Completeness Audit */}
          {snapshotResult && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/80 bg-surface">
                <CardHeader className="border-b border-border pb-2.5">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="size-4 text-cyan" />
                    Snapshot Candidate Forecast — {selectedRDHS} RDHS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 text-xs space-y-2.5">
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Forecast Issue Week:</span>
                    <span className="font-mono text-foreground font-medium">
                      {snapshotResult.forecast_record?.issue_start || "--"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Forward Horizon:</span>
                    <span className="font-mono text-foreground">
                      +{snapshotResult.forecast_record?.horizon_weeks || 1} Week(s)
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Predicted Incidence (μ):</span>
                    <span className="font-mono font-bold text-cyan-bright">
                      {snapshotResult.forecast_record?.predicted_value?.toFixed(1) ?? "--"} cases
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Empirical Interval [lo, hi]:</span>
                    <span className="font-mono text-foreground">
                      {snapshotResult.forecast_record?.interval
                        ? `[${snapshotResult.forecast_record.interval.lo.toFixed(1)}, ${snapshotResult.forecast_record.interval.hi.toFixed(1)}]`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Early Surge p(E):</span>
                    <span className="font-mono text-amber-400">
                      {snapshotResult.forecast_record?.pE !== null && snapshotResult.forecast_record?.pE !== undefined
                        ? `${(snapshotResult.forecast_record.pE * 100).toFixed(1)}%`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Quality Status:</span>
                    <Badge variant="unverified">
                      {snapshotResult.forecast_record?.data_quality_status || "UNVERIFIED"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-surface">
                <CardHeader className="border-b border-border pb-2.5">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Info className="size-4 text-cyan" />
                    Input Completeness & Governance Audit
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 text-xs space-y-2.5">
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-1">Governance Policy:</span>
                    <p className="text-foreground leading-relaxed">
                      {snapshotResult.operational_gating_reason}
                    </p>
                  </div>
                  <div className="border-t border-border/60 pt-2 space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Environmental Stream Vintage:</span>
                    <p className="text-cyan font-mono">
                      CHIRPS 2023 validated baseline & ERA5-Land validated reanalysis
                    </p>
                  </div>
                  <div className="border-t border-border/60 pt-2 space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Unresolved Surveillance Gaps:</span>
                    <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                      <li>Epidemiology Unit WER bulletins pending verification since August 2026.</li>
                      <li>Zero-filling of missing reports is strictly prohibited by scientific design.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          TAB 3: MODE C — ENVIRONMENTAL SCENARIO SIMULATOR
      ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "scenario" && (
        <div className="space-y-4">
          {/* Scenario Controls Panel */}
          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sliders className="size-4 text-cyan" />
                    Hydrological Perturbation Controls
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Perturb antecedent rainfall and root-zone soil moisture on in-memory feature vectors to evaluate tree-based model sensitivity.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Baseline Date:</label>
                  <select
                    value={scenarioDate}
                    onChange={(e) => setScenarioDate(e.target.value)}
                    className="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-cyan focus:outline-none"
                  >
                    {(discovery?.sample_dates || []).map((d) => (
                      <option key={d.date} value={d.date}>
                        {d.date} (W{d.week})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs text-muted-foreground self-center mr-1">Presets:</span>
                {(discovery?.scenario_presets || FALLBACK_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                      scenarioName === preset.name
                        ? "border-cyan bg-cyan/15 text-cyan font-semibold"
                        : "border-border/80 bg-surface-raised text-muted-foreground hover:border-cyan/40 hover:text-foreground"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Rainfall Factor Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <CloudRain className="size-3.5 text-cyan" />
                      Rainfall Scaling Factor:
                    </span>
                    <span className="font-mono font-bold text-cyan">
                      {rainfallFactor.toFixed(2)}x ({(rainfallFactor * 100 - 100) >= 0 ? "+" : ""}{(rainfallFactor * 100 - 100).toFixed(0)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.05"
                    value={rainfallFactor}
                    onChange={(e) => setRainfallFactor(parseFloat(e.target.value))}
                    className="w-full accent-cyan cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>0.0x (Drought)</span>
                    <span>1.0x (Baseline)</span>
                    <span>2.0x (+100%)</span>
                    <span>3.0x (Extreme)</span>
                  </div>
                </div>

                {/* Soil Moisture Offset Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Droplets className="size-3.5 text-cyan" />
                      Volumetric Soil Moisture Shift:
                    </span>
                    <span className="font-mono font-bold text-cyan">
                      {soilMoistureOffset >= 0 ? "+" : ""}{soilMoistureOffset.toFixed(2)} m³/m³
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.15"
                    max="0.20"
                    step="0.01"
                    value={soilMoistureOffset}
                    onChange={(e) => setSoilMoistureOffset(parseFloat(e.target.value))}
                    className="w-full accent-cyan cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>-0.15 (Desiccated)</span>
                    <span>0.00 (Baseline)</span>
                    <span>+0.10 (Saturated)</span>
                    <span>+0.20 (Waterlogged)</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2 border-t border-border/60">
                <Button
                  onClick={handleRunScenario}
                  disabled={scenarioLoading}
                  className="h-9 bg-cyan text-slate-950 hover:bg-cyan-bright font-semibold text-xs gap-1.5 shadow-sm px-6"
                >
                  {scenarioLoading ? (
                    <>Running Hydrological Simulation...</>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      Run Scenario Simulation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scenario Error */}
          {scenarioError && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-rose-400" />
              <span>{scenarioError}</span>
            </div>
          )}

          {/* Scenario Simulation Results */}
          {scenarioResult && (
            <div className="space-y-4">
              {/* Comparison Metric Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Baseline Forecast (μ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-muted-foreground">
                      {scenarioResult.baseline_forecast.mu.toFixed(1)}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Interval: [{scenarioResult.baseline_forecast.interval?.lo.toFixed(1)}, {scenarioResult.baseline_forecast.interval?.hi.toFixed(1)}]
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Scenario Forecast (μ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-cyan-bright">
                      {scenarioResult.scenario_forecast.mu.toFixed(1)}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Interval: [{scenarioResult.scenario_forecast.interval?.lo.toFixed(1)}, {scenarioResult.scenario_forecast.interval?.hi.toFixed(1)}]
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Net Response (Δμ)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold font-mono ${
                      scenarioResult.comparison.delta_mu > 0
                        ? "text-rose-400"
                        : scenarioResult.comparison.delta_mu < 0
                        ? "text-emerald-400"
                        : "text-foreground"
                    }`}>
                      {scenarioResult.comparison.delta_mu > 0 ? "+" : ""}
                      {scenarioResult.comparison.delta_mu.toFixed(1)} cases
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Relative shift: {scenarioResult.comparison.pct_change_mu > 0 ? "+" : ""}
                      {scenarioResult.comparison.pct_change_mu.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Surge Probability Shift
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-amber-400">
                      {scenarioResult.comparison.delta_pE > 0 ? "+" : ""}
                      {(scenarioResult.comparison.delta_pE * 100).toFixed(1)}%
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      p(E): {(scenarioResult.baseline_forecast.pE! * 100).toFixed(0)}% → {(scenarioResult.scenario_forecast.pE! * 100).toFixed(0)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Environmental Condition Comparison Table */}
              <Card className="border-border/80 bg-surface">
                <CardHeader className="border-b border-border pb-2.5">
                  <CardTitle className="text-sm font-semibold">
                    Hydrological & Case Input State Audit
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Environmental Variable</th>
                          <th className="pb-2 font-medium">Baseline Observed</th>
                          <th className="pb-2 font-medium">Scenario Modified</th>
                          <th className="pb-2 font-medium">Net Delta</th>
                          <th className="pb-2 font-medium">Feature Role in Model</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        <tr>
                          <td className="py-2 font-medium text-foreground">4-Week Cumulative Rainfall</td>
                          <td className="py-2 font-mono text-muted-foreground">{scenarioResult.baseline_conditions.rainfall_4w_mm.toFixed(1)} mm</td>
                          <td className="py-2 font-mono font-bold text-cyan">{scenarioResult.scenario_conditions.rainfall_4w_mm.toFixed(1)} mm</td>
                          <td className="py-2 font-mono text-foreground">
                            {(scenarioResult.scenario_conditions.rainfall_4w_mm - scenarioResult.baseline_conditions.rainfall_4w_mm) >= 0 ? "+" : ""}
                            {(scenarioResult.scenario_conditions.rainfall_4w_mm - scenarioResult.baseline_conditions.rainfall_4w_mm).toFixed(1)} mm
                          </td>
                          <td className="py-2 text-muted-foreground">rain_4w (LightGBM decision splits)</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-foreground">8-Week Cumulative Rainfall</td>
                          <td className="py-2 font-mono text-muted-foreground">{scenarioResult.baseline_conditions.rainfall_8w_mm.toFixed(1)} mm</td>
                          <td className="py-2 font-mono font-bold text-cyan">{scenarioResult.scenario_conditions.rainfall_8w_mm.toFixed(1)} mm</td>
                          <td className="py-2 font-mono text-foreground">
                            {(scenarioResult.scenario_conditions.rainfall_8w_mm - scenarioResult.baseline_conditions.rainfall_8w_mm) >= 0 ? "+" : ""}
                            {(scenarioResult.scenario_conditions.rainfall_8w_mm - scenarioResult.baseline_conditions.rainfall_8w_mm).toFixed(1)} mm
                          </td>
                          <td className="py-2 text-muted-foreground">rain_8w (Primary environmental tree splitter)</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-foreground">Root-Zone Soil Moisture</td>
                          <td className="py-2 font-mono text-muted-foreground">{scenarioResult.baseline_conditions.soil_moisture_m3_m3.toFixed(3)} m³/m³</td>
                          <td className="py-2 font-mono font-bold text-cyan">{scenarioResult.scenario_conditions.soil_moisture_m3_m3.toFixed(3)} m³/m³</td>
                          <td className="py-2 font-mono text-foreground">
                            {(scenarioResult.scenario_conditions.soil_moisture_m3_m3 - scenarioResult.baseline_conditions.soil_moisture_m3_m3) >= 0 ? "+" : ""}
                            {(scenarioResult.scenario_conditions.soil_moisture_m3_m3 - scenarioResult.baseline_conditions.soil_moisture_m3_m3).toFixed(3)} m³/m³
                          </td>
                          <td className="py-2 text-muted-foreground">soil_4w / ERA5-Land volumetric fraction</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-foreground">Epidemiological Case History</td>
                          <td className="py-2 font-mono text-muted-foreground">{scenarioResult.baseline_conditions.case_history_c_last4.toFixed(0)} cases</td>
                          <td className="py-2 font-mono text-muted-foreground">{scenarioResult.scenario_conditions.case_history_c_last4.toFixed(0)} cases</td>
                          <td className="py-2 font-mono text-emerald-400">0.0 (Preserved)</td>
                          <td className="py-2 text-muted-foreground">c_last4 (Preserved without modification)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Scientific Interpretation & Disclosure Card */}
              <Card className="border-border/80 bg-surface">
                <CardHeader className="border-b border-border pb-2.5">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Info className="size-4 text-cyan" />
                    Model Interpretation & Scientific Disclosure
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 text-xs space-y-2.5">
                  <p className="text-foreground leading-relaxed">
                    {scenarioResult.comparison.interpretation}
                  </p>
                  <p className="text-muted-foreground leading-relaxed border-t border-border/60 pt-2 text-[11px]">
                    {scenarioResult.scientific_disclosure}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {!scenarioResult && !scenarioLoading && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              Select or customize a hydrological scenario above and click{" "}
              <strong className="text-cyan">Run Scenario Simulation</strong> to evaluate live tree-based model sensitivity.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
