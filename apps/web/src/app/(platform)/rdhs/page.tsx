"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MapPin,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartCard,
  WeeklyCasesBarChart,
  TrendLineChart,
} from "@/components/charts";
import {
  fetchHistory,
  fetchRDHSDetail,
  fetchRDHSList,
  HistoryResponse,
  RDHSDetailResponse,
  RDHSSummaryItem,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

function RDHSProfilesContent() {
  const searchParams = useSearchParams();
  const [localRDHS, setLocalRDHS] = useState<string>("Colombo");
  const selectedRDHS = searchParams.get("id") || localRDHS;

  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [detail, setDetail] = useState<RDHSDetailResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load RDHS list once with cancellation
  useEffect(() => {
    const controller = new AbortController();

    fetchRDHSList(controller.signal)
      .then((res) => {
        setRdhsList(res.records);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS list");
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Load detail and history whenever selectedRDHS changes with AbortController
  useEffect(() => {
    if (!selectedRDHS) return;
    const controller = new AbortController();

    Promise.all([
      fetchRDHSDetail(selectedRDHS, controller.signal),
      fetchHistory(selectedRDHS, 52, controller.signal),
    ])
      .then(([detailData, historyData]) => {
        setDetail(detailData);
        setHistory(historyData);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS profile");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedRDHS]);

  const handleSelectRDHS = (name: string) => {
    setError(null);
    setDetail(null);
    setHistory(null);
    setIsLoading(true);
    setLocalRDHS(name);
  };

  return (
    <div className="space-y-6">
      {/* Header with Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              RDHS Health Area Surveillance Profiles
            </h1>
            <Badge variant="unverified">26 Health Areas</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Longitudinal surveillance, historical case records, and staging model metrics for
            all 26 RDHS health entities (Kalmunai separate from Ampara).
          </p>
        </div>

        {/* Dropdown / Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="rdhs-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Select RDHS:
          </label>
          <select
            id="rdhs-select"
            value={selectedRDHS}
            onChange={(e) => handleSelectRDHS(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none min-w-[200px]"
          >
            {rdhsList.map((item) => (
              <option key={item.rdhs} value={item.rdhs}>
                {item.rdhs} ({item.district})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground space-y-3">
          <div className="size-8 mx-auto animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p>Loading surveillance dossier for {selectedRDHS} RDHS...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md p-4">
          {error}
        </div>
      ) : detail ? (
        <div className="space-y-6">
          {/* Top Profile Card */}
          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-5 w-5 text-cyan" />
                    <CardTitle className="text-lg font-bold">
                      {detail.rdhs} RDHS
                    </CardTitle>
                    <Badge variant={getTierBadgeVariant(detail.tier)}>
                      {detail.tier || "Unknown"}
                    </Badge>
                    <Badge variant="unverified">
                      {detail.data_quality_status || "UNVERIFIED"}
                    </Badge>
                    {detail.rdhs.toLowerCase() === "kalmunai" && (
                      <Badge variant="staging">Whole-District Proxy Area</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1 text-xs text-muted-foreground">
                    Administrative District: {detail.district} &bull; Staging Issue
                    Week: {detail.issue_start || "Unavailable"}
                  </CardDescription>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Latest Accepted Case Week
                  </span>
                  <p className="font-mono text-sm font-semibold text-amber-400">
                    {detail.latest_accepted_case_week || "No accepted reports"}
                  </p>
                </div>
              </div>

              {/* Kalmunai Proxy Caveat */}
              {detail.rdhs.toLowerCase() === "kalmunai" && (
                <div className="mt-3 rounded-md border border-cyan/40 bg-cyan/10 p-3 text-xs text-cyan-bright">
                  <p className="font-semibold text-cyan-bright">
                    Whole-District Administrative Proxy Caveat:
                  </p>
                  <p className="mt-0.5 leading-relaxed text-cyan/90">
                    Kalmunai is a distinct RDHS located inside Ampara district.
                    Environmental indicators (rainfall, soil moisture, flood)
                    derived from Ampara ADM2 district represent a whole-district proxy,
                    not an area-specific observation for Kalmunai RDHS.
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {/* Metrics Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-surface-raised p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Predicted Mean (μ)
                  </span>
                  <p className="mt-1 text-xl font-bold font-mono text-cyan-bright">
                    {detail.mu !== null && detail.mu !== undefined ? detail.mu.toFixed(1) : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Model point prediction</p>
                </div>

                <div className="rounded-md border border-border bg-surface-raised p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Elevated / High Prob
                  </span>
                  <p className="mt-1 text-sm font-semibold font-mono text-foreground">
                    pE: {detail.pE !== null && detail.pE !== undefined ? `${(detail.pE * 100).toFixed(1)}%` : "--"} &bull; pH:{" "}
                    {detail.pH !== null && detail.pH !== undefined ? `${(detail.pH * 100).toFixed(1)}%` : "--"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Provisional model outputs</p>
                </div>

                <div className="rounded-md border border-border bg-surface-raised p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Prediction Interval [lo, hi]
                  </span>
                  <p className="mt-1 text-sm font-semibold font-mono text-cyan">
                    {detail.interval
                      ? `[${detail.interval.lo.toFixed(1)}, ${detail.interval.hi.toFixed(1)}]`
                      : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Empirical interval bounds (not CI)
                  </p>
                </div>

                <div className="rounded-md border border-border bg-surface-raised p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Data Freshness Age
                  </span>
                  <p className="mt-1 text-sm font-semibold font-mono text-amber-400">
                    {detail.cases_age_days !== null && detail.cases_age_days !== undefined
                      ? `${detail.cases_age_days} days`
                      : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Internal policy: 56-day limit
                  </p>
                </div>
              </div>

              {/* Diagnostic Reasons & Triggers */}
              <div className="mt-4 rounded-md border border-border bg-surface-raised/70 p-3 text-xs">
                <span className="font-semibold text-foreground">
                  Diagnostic Reasons &amp; Triggers:
                </span>
                <p className="mt-1 font-mono text-muted-foreground">
                  {detail.reasons || "No diagnostic triggers recorded for this health area."}
                </p>
                {detail.rule && (
                  <p className="mt-1.5 text-muted-foreground">
                    <span className="font-semibold text-slate-300">Rule Evaluated:</span>{" "}
                    <span className="font-mono text-amber-400/90">{detail.rule}</span>
                  </p>
                )}
                {detail.failures && (
                  <p className="mt-1.5 text-muted-foreground">
                    <span className="font-semibold text-rose-400">Gating Failures:</span>{" "}
                    <span className="font-mono text-rose-300/90">{detail.failures}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visualizations: Weekly Cases Bar Chart & Multi-Week Trend */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <ChartCard
                title={`Weekly Surveillance History — ${detail.rdhs} RDHS`}
                subtitle="Accepted weekly cases across 52 pre-2025 surveillance panel weeks."
                badge={<Badge variant="unverified">52 Weeks</Badge>}
                footnote="Missing reports ('no_accepted_report', 'nonreporting') are preserved strictly as null. Zero-filling missing reports is mathematically forbidden."
                isLoading={isLoading}
                isEmpty={!history?.records || history.records.length === 0}
              >
                {history?.records && (
                  <WeeklyCasesBarChart records={history.records} height={270} />
                )}
              </ChartCard>
            </div>

            <div className="lg:col-span-5">
              <ChartCard
                title="Historical Case Trajectory Trend"
                subtitle="Smoothed area trend for accepted weekly leptospirosis cases."
                badge={<Badge variant="staging">Trend Analysis</Badge>}
                footnote="Gaps in the trend line represent periods with unaccepted or missing surveillance submissions."
                isLoading={isLoading}
                isEmpty={!history?.records || history.records.length === 0}
              >
                {history?.records && (
                  <TrendLineChart records={history.records} height={270} strokeColor="#00C8E8" fillColor="#00C8E8" />
                )}
              </ChartCard>
            </div>
          </div>

          {/* Longitudinal Records Table */}
          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Surveillance Record Ledger ({detail.rdhs})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Weekly epidemiological submissions from pre-2025 verified panel
                  </CardDescription>
                </div>
                {history?.summary && (
                  <div className="text-xs font-mono text-muted-foreground">
                    Accepted: <span className="text-emerald-400 font-semibold">{history.summary.accepted_weeks_count}</span> / {history.summary.total_weeks} weeks
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week Start</TableHead>
                      <TableHead>Year / Week</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Accepted Cases</TableHead>
                      <TableHead className="text-right">Cases YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.records.slice(0, 20).map((row, idx) => (
                      <TableRow key={`${row.week_start}-${idx}`} className="hover:bg-surface-raised/60">
                        <TableCell className="font-mono text-xs text-foreground">
                          {row.week_start}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.year} W{row.week}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                              row.status === "ok"
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                : row.status === "nonreporting"
                                ? "bg-slate-500/15 text-slate-300 border border-slate-500/30"
                                : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.status === "ok" && row.cases !== null ? (
                            <span className="font-semibold text-foreground">{row.cases}</span>
                          ) : (
                            <span className="text-amber-400 text-[11px]">Unreported</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {row.cases_ytd !== null ? row.cases_ytd : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function RDHSProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-muted-foreground">
          Loading RDHS Profiles workspace...
        </div>
      }
    >
      <RDHSProfilesContent />
    </Suspense>
  );
}
