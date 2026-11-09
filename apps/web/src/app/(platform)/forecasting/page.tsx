"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ArrowRight,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartCard,
  PredictionBandChart,
  RDHSComparisonChart,
} from "@/components/charts";
import { ForecastSimulator } from "@/components/simulator/forecast-simulator";
import {
  fetchForecastsLatest,
  ForecastListResponse,
  ForecastRecord,
  fetchHistory,
  HistoryResponse,
  RDHSSummaryItem,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function ForecastingPage() {
  const [data, setData] = useState<ForecastListResponse | null>(null);
  const [selectedRDHS, setSelectedRDHS] = useState<string>("Colombo");
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchForecastsLatest(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load forecasts");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Fetch history for selected RDHS to power the forecast interval band visualization
  useEffect(() => {
    if (!selectedRDHS) return;
    const controller = new AbortController();

    fetchHistory(selectedRDHS, 16, controller.signal)
      .then((res) => {
        setHistoryData(res);
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

  const selectedForecastRecord = data?.records.find(
    (r) => r.rdhs.toLowerCase() === selectedRDHS.toLowerCase()
  );

  // Convert forecast records to RDHSSummaryItems for the comparison chart
  const comparisonItems: RDHSSummaryItem[] = (data?.records || []).map((r) => ({
    rdhs: r.rdhs,
    district: r.rdhs,
    tier: r.tier,
    data_quality_status: r.data_quality_status,
    pE: r.pE,
    pH: r.pH,
    mu: r.predicted_value,
    reasons: null,
  }));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">
                  Forecasting Centre &mdash; Staging Candidate Outputs
                </h1>
                <Badge variant="unverified">Experimental Staging</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Candidate point forecasts ($\mu$), empirical prediction interval bounds ($[lo, hi]$), and quantile distributions across all 26 RDHS health areas.
                Model status: <span className="font-mono text-cyan">EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="forecast-rdhs-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Inspect Area:
              </label>
              <select
                id="forecast-rdhs-select"
                value={selectedRDHS}
                onChange={(e) => setSelectedRDHS(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
              >
                {(data?.records || []).map((r) => (
                  <option key={r.rdhs} value={r.rdhs}>
                    {r.rdhs} RDHS
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Forecast Issue Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-cyan-bright">
              {isLoading ? "--" : data?.issue_start || "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Staging forecast issue point
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Forecast Horizon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground">
              {selectedForecastRecord?.horizon_weeks ? `+${selectedForecastRecord.horizon_weeks} Weeks` : "+1 Week (Candidate)"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Forward surveillance window
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Primary Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan">Ensemble Blend</div>
            <p className="mt-1 text-xs text-muted-foreground">
              LightGBM + NegBinomial + Baselines
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Operational Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-rose-500">FALSE</div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Research candidate only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Forecast Simulator Section */}
      <ForecastSimulator
        initialRDHS={selectedRDHS}
        onSelectRDHS={(rdhs) => setSelectedRDHS(rdhs)}
      />

      {/* Main Charts Row: Forecast Fan Chart + National Comparison */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Historical vs Predicted with Interval Band (7 cols) */}
        <div className="lg:col-span-7">
          <ChartCard
            title={`Trajectory & Prediction Interval — ${selectedRDHS} RDHS`}
            subtitle="Observed historical cases leading into point forecast and empirical prediction interval [q0.05, q0.95]."
            badge={<Badge variant="staging">Empirical Fan</Badge>}
            action={
              <Link href={`/rdhs?id=${encodeURIComponent(selectedRDHS)}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan gap-1">
                  RDHS Profile <ArrowRight className="size-3" />
                </Button>
              </Link>
            }
            footnote="Prediction intervals are empirical quantile bounds (5th to 95th percentile) from calibration splits. They are NOT Gaussian confidence intervals."
            isLoading={isLoading || historyLoading}
            error={error}
            isEmpty={!historyData?.records || historyData.records.length === 0}
          >
            {historyData?.records && (
              <PredictionBandChart
                historyRecords={historyData.records}
                forecastRecord={selectedForecastRecord}
                height={290}
              />
            )}
          </ChartCard>
        </div>

        {/* Right Column: National Predicted Incidence Comparison (5 cols) */}
        <div className="lg:col-span-5">
          <ChartCard
            title="National Predicted Mean Cases (μ)"
            subtitle="Top RDHS areas ranked by candidate point forecast value."
            badge={<Badge variant="unverified">Ranked</Badge>}
            footnote="Predicted values represent weekly mean cases (μ) from the ensemble candidate. Zero-filling of missing inputs was avoided."
            isLoading={isLoading}
            error={error}
            isEmpty={comparisonItems.length === 0}
          >
            <RDHSComparisonChart
              records={comparisonItems}
              metricKey="mu"
              metricLabel="Predicted Cases (μ)"
              unit=" cases"
              height={290}
              limit={9}
            />
          </ChartCard>
        </div>
      </div>

      {/* Forecast Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold">
            National Staging Forecast Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Point predictions (μ), empirical intervals [lo, hi], and quantile
            spreads [q0.05, q0.5, q0.95] across all 26 health administrative areas.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading forecast records...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-400">{error}</div>
          ) : data && data.records ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Data Quality</TableHead>
                    <TableHead className="text-right">Predicted (μ)</TableHead>
                    <TableHead className="text-right">Interval [lo, hi]</TableHead>
                    <TableHead className="text-right">Quantiles [q0.05, q0.5, q0.95]</TableHead>
                    <TableHead className="text-right">pE</TableHead>
                    <TableHead className="text-right">pH</TableHead>
                    <TableHead>Staging Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((rec: ForecastRecord) => (
                    <TableRow key={rec.rdhs} className="hover:bg-surface-raised/60">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/rdhs?id=${encodeURIComponent(rec.rdhs)}`}
                          className="hover:text-cyan hover:underline"
                        >
                          {rec.rdhs}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(rec.tier)}>
                          {rec.tier || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="unverified">
                          {rec.data_quality_status || "UNVERIFIED"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-cyan-bright">
                        {rec.predicted_value !== null && rec.predicted_value !== undefined
                          ? rec.predicted_value.toFixed(1)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {rec.interval
                          ? `[${rec.interval.lo.toFixed(1)}, ${rec.interval.hi.toFixed(1)}]`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {rec.quantiles
                          ? `[${rec.quantiles.q0_05.toFixed(1)}, ${rec.quantiles.q0_5.toFixed(1)}, ${rec.quantiles.q0_95.toFixed(1)}]`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-cyan">
                        {rec.pE !== null && rec.pE !== undefined
                          ? `${(rec.pE * 100).toFixed(1)}%`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-400">
                        {rec.pH !== null && rec.pH !== undefined
                          ? `${(rec.pH * 100).toFixed(1)}%`
                          : "--"}
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {rec.staging_status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
