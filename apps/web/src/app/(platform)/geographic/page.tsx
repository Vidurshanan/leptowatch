"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Info,
  MapPin,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Layers,
  CheckCircle2,
  Clock,
  Activity,
  FileCheck2,
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
import { MapFrame } from "@/components/maps/map-frame";
import {
  fetchGeoRDHS,
  GeoRDHSFeature,
  GeoRDHSResponse,
  fetchHistory,
  HistoryResponse,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";
import { WeeklyCasesBarChart } from "@/components/charts/weekly-cases-bar-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";

export default function GeographicIntelligencePage() {
  const [geoData, setGeoData] = useState<GeoRDHSResponse | null>(null);
  const [selectedRDHS, setSelectedRDHS] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Layer toggles
  const [activeLayers, setActiveLayers] = useState({
    boundaries: true,
    activeStatus: true,
    historicalSignals: false,
    environmental: false,
    verification: false,
  });

  // Active sub-tab in right panel
  const [activePanelTab, setActivePanelTab] = useState<"insights" | "verification" | "layers">("insights");

  // Fetch 26-RDHS GeoPackage GeoJSON
  useEffect(() => {
    const controller = new AbortController();

    fetchGeoRDHS(controller.signal)
      .then((data) => {
        setGeoData(data);
        setError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS boundaries");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [resetTrigger]);

  // Fetch selected RDHS history whenever selectedRDHS changes
  useEffect(() => {
    if (!selectedRDHS) {
      setHistoryData(null);
      setHistoryLoading(false);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryData(null);

    fetchHistory(selectedRDHS, 16, controller.signal)
      .then((data) => {
        setHistoryData(data);
        setHistoryLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setHistoryData(null);
          setHistoryLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedRDHS]);

  const handleReset = () => {
    setSelectedRDHS(null);
    setHistoryData(null);
    setResetTrigger((prev) => prev + 1);
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setResetTrigger((prev) => prev + 1);
  };

  const selectedFeature = geoData?.features?.find(
    (f: GeoRDHSFeature) => f.properties.rdhs === selectedRDHS
  );

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A2840] pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="size-2 rounded-full bg-cyan animate-pulse" />
            Regional Geospatial Intelligence Dashboard
          </h2>
          <p className="text-xs text-slate-400">
            Natural satellite terrain cartography &middot; 26 RDHS health areas &middot; Multi-layer epidemiological overlay
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer Quick Toggles */}
          <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#1A2840] bg-[#08111F] p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveLayers((prev) => ({ ...prev, boundaries: !prev.boundaries }))}
              className={`rounded px-2 py-1 transition-colors ${
                activeLayers.boundaries
                  ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Boundaries
            </button>
            <button
              type="button"
              onClick={() => setActiveLayers((prev) => ({ ...prev, historicalSignals: !prev.historicalSignals }))}
              className={`rounded px-2 py-1 transition-colors ${
                activeLayers.historicalSignals
                  ? "bg-rose-500/20 text-rose-400 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Historical Signals
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-slate-700 bg-[#0B1628] text-xs text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Reset View
          </Button>
        </div>
      </div>

      {/* Main Grid: GIS Map (65%) + Intelligence Dossier (35%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[580px]">
        {/* Left Column: Interactive GIS Map */}
        <div className="lg:col-span-8 flex flex-col rounded-lg border border-[#1A2840] bg-[#08111F] p-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-cyan text-[11px]">ESRI WORLD IMAGERY</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-400 text-[11px]">Deep Navy Maritime &middot; Natural Green Topography</span>
            </div>
            {selectedRDHS && (
              <Badge variant="default" className="text-[10px] bg-cyan/20 text-cyan border-cyan/40">
                Focused: {selectedRDHS} RDHS
              </Badge>
            )}
          </div>

          <div className="flex-1 min-h-[500px]">
            <MapFrame
              geoData={geoData}
              selectedRDHS={selectedRDHS}
              onSelectRDHS={setSelectedRDHS}
              resetTrigger={resetTrigger}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              activeLayers={activeLayers}
            />
          </div>
        </div>

        {/* Right Column: Intelligence Dossier & Verification Panel */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Panel Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-md border border-[#1A2840] bg-[#08111F] p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActivePanelTab("insights")}
              className={`rounded py-1 text-center font-medium transition-colors ${
                activePanelTab === "insights"
                  ? "bg-cyan/15 text-cyan border border-cyan/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Regional Intel
            </button>
            <button
              type="button"
              onClick={() => setActivePanelTab("verification")}
              className={`rounded py-1 text-center font-medium transition-colors ${
                activePanelTab === "verification"
                  ? "bg-cyan/15 text-cyan border border-cyan/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Verification
            </button>
            <button
              type="button"
              onClick={() => setActivePanelTab("layers")}
              className={`rounded py-1 text-center font-medium transition-colors ${
                activePanelTab === "layers"
                  ? "bg-cyan/15 text-cyan border border-cyan/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              GIS Layers
            </button>
          </div>

          {/* TAB 1: REGIONAL INSIGHTS */}
          {activePanelTab === "insights" && (
            selectedFeature ? (
              <Card className="flex-1 border-[#1A2840] bg-[#0B1628] shadow-lg text-slate-200">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <MapPin className="size-4 text-cyan" />
                      {selectedFeature.properties.rdhs} RDHS
                    </CardTitle>
                    <Badge variant={getTierBadgeVariant(selectedFeature.properties.tier)}>
                      {selectedFeature.properties.tier || "Watch (Unverified)"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-400">
                    Administrative District: {selectedFeature.properties.district}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-3">
                  {/* Whole-District Proxy Banner */}
                  {selectedFeature.properties.is_district_proxy && (
                    <div className="rounded border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-300">
                      <p className="font-semibold text-white">Whole-District Spatial Proxy:</p>
                      <p className="mt-0.5 text-sky-200">
                        {selectedFeature.properties.proxy_notes ||
                          "Ampara district data is a whole-district proxy; not an area-specific observation for Kalmunai RDHS."}
                      </p>
                    </div>
                  )}

                  {/* Probability Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-slate-800 bg-[#07101E] p-2.5">
                      <span className="text-[10px] text-slate-400 block font-mono">EXCEEDANCE RISK (pE)</span>
                      <span className="text-base font-bold text-cyan">
                        {selectedFeature.properties.pE !== null && selectedFeature.properties.pE !== undefined
                          ? `${(selectedFeature.properties.pE * 100).toFixed(1)}%`
                          : "Unavailable"}
                      </span>
                    </div>

                    <div className="rounded border border-slate-800 bg-[#07101E] p-2.5">
                      <span className="text-[10px] text-slate-400 block font-mono">HIGH SURGE PROB (pH)</span>
                      <span className="text-base font-bold text-amber">
                        {selectedFeature.properties.pH !== null && selectedFeature.properties.pH !== undefined
                          ? `${(selectedFeature.properties.pH * 100).toFixed(1)}%`
                          : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* 16-Week Historical Trend Mini-Chart */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-cyan" />
                        16-Week Historical Trajectory
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">To 2026-08-10</span>
                    </div>

                    {historyLoading ? (
                      <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                        <span className="animate-pulse">Loading historical trajectory…</span>
                      </div>
                    ) : historyData && historyData.records && historyData.records.length > 0 ? (
                      <div className="h-32 w-full pt-1">
                        <WeeklyCasesBarChart
                          records={historyData.records}
                          height={120}
                        />
                      </div>
                    ) : (
                      <div className="h-28 flex flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-800 bg-[#07101E] text-center px-3">
                        <span className="text-xs text-slate-500">No accepted case records found</span>
                        <span className="text-[10px] text-slate-600">
                          {historyData
                            ? `Available records: ${historyData.summary?.total_weeks ?? 0} weeks — none with accepted status`
                            : "Data unavailable or outside historical coverage"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Deep Link */}
                  <div className="pt-2">
                    <Link
                      href={`/rdhs?id=${encodeURIComponent(selectedFeature.properties.rdhs)}`}
                      className="w-full flex items-center justify-center gap-1.5 rounded bg-cyan/15 hover:bg-cyan/25 border border-cyan/40 py-2 text-xs font-semibold text-cyan-bright transition-colors"
                    >
                      Open Full RDHS Surveillance Profile
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex-1 border-[#1A2840] bg-[#0B1628] shadow-lg text-slate-200">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="size-4 text-amber" />
                    National Surveillance Overview
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    26 RDHS Health Areas &middot; Sri Lanka
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-3 text-xs leading-relaxed">
                  <p className="text-slate-300">
                    Click any RDHS polygon or glowing geographic marker on the map to inspect regional risk probabilities, proxy attributes, and historical case trajectories.
                  </p>

                  <div className="rounded-lg border border-slate-800 bg-[#07101E] p-3 space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">HEALTH AREAS:</span>
                      <span className="text-white font-bold">26 RDHS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ACTIVE CLASSIFICATION:</span>
                      <span className="text-amber font-bold">26 WATCH (UNVERIFIED)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">LATEST ACCEPTED WEEK:</span>
                      <span className="text-cyan font-bold">2026-08-10</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">CANDIDATE STAGED WEEK:</span>
                      <span className="text-slate-200 font-bold">2026-09-14</span>
                    </div>
                  </div>

                  <div className="rounded border border-amber/30 bg-amber/10 p-3 text-amber text-[11px] space-y-1">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <Info className="size-3.5 text-amber" />
                      Provisional Staging Notice:
                    </p>
                    <p>
                      All 26 areas maintain Watch + UNVERIFIED status because current operational inference abstains per the 56-day internal freshness policy. Retrospective high-risk benchmarks are viewable via the Historical Signals layer.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* TAB 2: DATA VERIFICATION EXPERIENCE */}
          {activePanelTab === "verification" && (
            <Card className="flex-1 border-[#1A2840] bg-[#0B1628] shadow-lg text-slate-200">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck2 className="size-4 text-cyan" />
                  Data Verification Experience
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Audit status, candidate reconciliation and reporting gates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 text-xs">
                <div className="rounded border border-slate-800 bg-[#07101E] p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Latest Accepted Report:</span>
                    <span className="font-mono text-cyan font-bold">2026-08-10</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Latest Reconciled WER Candidate:</span>
                    <span className="font-mono text-amber font-bold">2026-09-14</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Accepted Records:</span>
                    <span className="font-mono text-slate-200 font-bold">26,936 verified</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Candidate Records Awaiting Review:</span>
                    <span className="font-mono text-amber font-bold">130 records</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Reporting Coverage:</span>
                    <span className="font-mono text-emerald-400 font-bold">26 / 26 RDHS (100%)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Freshness Gate Policy:</span>
                    <span className="font-mono text-slate-300">56 Days</span>
                  </div>
                </div>

                <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                  <p>
                    <strong className="text-white">Accepted vs. Candidate Records:</strong> The 130 candidate records spanning epidemiological weeks 2026-W34 to 2026-W38 have completed numerical reconciliation but remain classified as <code className="text-amber">no_accepted_report</code> until formal review approval.
                  </p>
                  <p>
                    <strong className="text-white">Decoupled Operational Approval:</strong> Freshness describes report recency; it does not confer production approval. The model strictly maintains <code className="text-rose-400">EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED</code>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: GIS LAYERS */}
          {activePanelTab === "layers" && (
            <Card className="flex-1 border-[#1A2840] bg-[#0B1628] shadow-lg text-slate-200">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="size-4 text-cyan" />
                  GIS Layer Management
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Toggleable intelligence layers with data provenance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-3 text-xs">
                {/* Layer 1: RDHS Boundaries */}
                <div className="rounded border border-slate-800 bg-[#07101E] p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block text-xs">1. RDHS Administrative Boundaries</span>
                    <span className="text-[10px] text-slate-400">Provisional borders &middot; 26 health divisions</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeLayers.boundaries}
                    onChange={(e) => setActiveLayers((prev) => ({ ...prev, boundaries: e.target.checked }))}
                    className="size-4 accent-cyan cursor-pointer"
                  />
                </div>

                {/* Layer 2: Historical Elevated Signals */}
                <div className="rounded border border-slate-800 bg-[#07101E] p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-rose-400 block text-xs">2. Historical High-Risk Signals</span>
                    <span className="text-[10px] text-slate-400">Pre-2025 out-of-fold benchmark signals &middot; Not live</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeLayers.historicalSignals}
                    onChange={(e) => setActiveLayers((prev) => ({ ...prev, historicalSignals: e.target.checked }))}
                    className="size-4 accent-red-500 cursor-pointer"
                  />
                </div>

                {/* Layer 3: Environmental Context */}
                <div className="rounded border border-slate-800 bg-[#07101E] p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sky-400 block text-xs">4. Environmental Information</span>
                    <span className="text-[10px] text-slate-400">CHIRPS rainfall &amp; ERA5-Land proxies &middot; Unvalidated for flood</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeLayers.environmental}
                    onChange={(e) => setActiveLayers((prev) => ({ ...prev, environmental: e.target.checked }))}
                    className="size-4 accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Layer 5: Data Verification Coverage */}
                <div className="rounded border border-slate-800 bg-[#07101E] p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-emerald-400 block text-xs">5. Data Verification Coverage</span>
                    <span className="text-[10px] text-slate-400">Accepted records vs. 130 candidate reviews</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeLayers.verification}
                    onChange={(e) => setActiveLayers((prev) => ({ ...prev, verification: e.target.checked }))}
                    className="size-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
