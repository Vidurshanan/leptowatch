"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  ShieldAlert,
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
  WeeklyCasesBarChart,
  RDHSComparisonChart,
  StatusDonutChart,
} from "@/components/charts";
import {
  DashboardSummaryResponse,
  fetchDashboardSummary,
  fetchRDHSList,
  RDHSSummaryItem,
  fetchDataQuality,
  DataQualityResponse,
  fetchHistory,
  HistoryResponse,
  fetchAlertsLatest,
  AlertListResponse,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [qualityData, setQualityData] = useState<DataQualityResponse | null>(null);
  const [referenceHistory, setReferenceHistory] = useState<HistoryResponse | null>(null);
  const [alertsData, setAlertsData] = useState<AlertListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      fetchDashboardSummary(controller.signal),
      fetchRDHSList(controller.signal),
      fetchDataQuality(controller.signal),
      fetchHistory("Colombo", 32, controller.signal),
      fetchAlertsLatest(controller.signal),
    ])
      .then(([summaryRes, rdhsRes, qualityRes, historyRes, alertsRes]) => {
        if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
        if (rdhsRes.status === "fulfilled") setRdhsList(rdhsRes.value.records);
        if (qualityRes.status === "fulfilled") setQualityData(qualityRes.value);
        if (historyRes.status === "fulfilled") setReferenceHistory(historyRes.value);
        if (alertsRes.status === "fulfilled") setAlertsData(alertsRes.value);

        if (summaryRes.status === "rejected" && summaryRes.reason?.name !== "AbortError") {
          setError(summaryRes.reason?.message || "Failed to load dashboard summary");
        }
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Build tier distribution slices for donut chart
  const tierSlices = (() => {
    if (!summary?.tier_counts) return [];
    const colors: Record<string, string> = {
      Critical: "#EF4444",
      Warning: "#F97316",
      Watch: "#F59E0B",
      Advisory: "#38BDF8",
      Normal: "#10B981",
      Clear: "#10B981",
    };
    return Object.entries(summary.tier_counts).map(([tier, count]) => ({
      name: tier,
      value: count,
      color: colors[tier] || "#64748B",
    }));
  })();

  // Build data quality breakdown slices
  const qualitySlices = (() => {
    if (!qualityData?.national_summary) return [];
    const s = qualityData.national_summary;
    return [
      { name: "Accepted Reports", value: s.accepted_reports, color: "#10B981" },
      { name: "Missing Reports", value: s.missing_reports, color: "#F59E0B" },
      { name: "Non-Reporting", value: s.nonreporting_reports, color: "#64748B" },
    ];
  })();

  return (
    <div className="space-y-6">
      {/* Top Banner: Staging Notice */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-foreground">
                  National Leptospirosis Surveillance Platform
                </h1>
                <Badge variant="unverified">Experimental Staging</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Reproducible epidemiological intelligence demonstration across all 26 RDHS health areas (including Kalmunai separate from Ampara).
                Derived strictly from pre-2025 verified pipelines. Model status: <span className="font-mono text-cyan">EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/geographic">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-cyan/40 hover:bg-cyan/10">
                <MapPin className="h-3.5 w-3.5 text-cyan" />
                GIS Intelligence Map
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              National Health Areas
            </CardTitle>
            <Layers className="h-4 w-4 text-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-cyan-bright">
              {summary ? `${summary.rdhs_count} RDHS` : isLoading ? "Loading..." : "26 RDHS"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              100% complete partition (Kalmunai separate)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Provisional Alerts
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {alertsData ? `${alertsData.count} Areas Active` : isLoading ? "Loading..." : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.tier_counts
                ? Object.entries(summary.tier_counts)
                    .map(([tier, count]) => `${count} ${tier}`)
                    .join(", ")
                : "Watch-Unverified status active"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Case Data Freshness
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {summary?.freshness?.age_days !== null && summary?.freshness?.age_days !== undefined
                ? `${summary.freshness.age_days} days`
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.freshness
                ? `Latest ok: ${summary.freshness.latest_accepted_date ?? "None"} (56d internal policy)`
                : "Policy: 56-day internal gating limit"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Operational Approval
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-500">
              {summary?.operational_approval ? "APPROVED" : "FALSE"}
            </div>
            <p className="mt-1 text-[11px] font-mono text-muted-foreground truncate">
              NOT_PRODUCTION_APPROVED
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Analytics Charts Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Historical Weekly Cases Chart (7 cols) */}
        <div className="lg:col-span-7">
          <ChartCard
            title="Weekly Surveillance Trajectory — High-Burden Reference (Colombo RDHS)"
            subtitle="Verified historical accepted case reports (pre-2025 panel). Missing reports preserved as null."
            badge={<Badge variant="unverified">Reference RDHS</Badge>}
            action={
              <Link href="/rdhs?id=Colombo">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan gap-1">
                  Detail <ExternalLink className="size-3" />
                </Button>
              </Link>
            }
            footnote="Zero-filling missing reports is strictly forbidden. Reports with status 'nonreporting' or 'no_accepted_report' are represented with gaps."
            isLoading={isLoading}
            error={error}
            isEmpty={!referenceHistory?.records || referenceHistory.records.length === 0}
          >
            {referenceHistory && (
              <WeeklyCasesBarChart records={referenceHistory.records} height={270} />
            )}
          </ChartCard>
        </div>

        {/* Right Column: RDHS Risk Comparison Bar Chart (5 cols) */}
        <div className="lg:col-span-5">
          <ChartCard
            title="Exceedance Risk Comparison (pE)"
            subtitle="Top RDHS areas ranked by probability of elevated incidence (pE)."
            badge={<Badge variant="staging">Staging Scores</Badge>}
            action={
              <Link href="/rdhs">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan gap-1">
                  All 26 <ExternalLink className="size-3" />
                </Button>
              </Link>
            }
            footnote="pE represents the probability of exceeding the historical threshold. Derived from baseline B2 / detector fusion."
            isLoading={isLoading}
            error={error}
            isEmpty={rdhsList.length === 0}
          >
            <RDHSComparisonChart records={rdhsList} metricKey="pE" unit="%" height={270} limit={8} />
          </ChartCard>
        </div>
      </div>

      {/* Secondary Row: Donut Charts for Status & Quality */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-12">
        {/* Donut 1: Tier Distribution (6 cols) */}
        <div className="lg:col-span-6">
          <ChartCard
            title="Surveillance Tier Distribution"
            subtitle="Provisional classification across all 26 health administrative areas."
            badge={<Badge variant="staging">26 Areas</Badge>}
            footnote="Classifications are provisional. Watch-Unverified indicates telemetry freshness gating failed."
            isLoading={isLoading}
            error={error}
            isEmpty={tierSlices.length === 0}
          >
            <StatusDonutChart
              slices={tierSlices}
              centerLabel="RDHS Areas"
              centerValue={summary?.rdhs_count ?? 26}
              height={220}
            />
          </ChartCard>
        </div>

        {/* Donut 2: Reporting Quality Breakdown (6 cols) */}
        <div className="lg:col-span-6">
          <ChartCard
            title="National Historical Reporting Quality"
            subtitle="Total historical reports recorded across pre-2025 surveillance panel."
            badge={<Badge variant="unverified">Audit</Badge>}
            action={
              <Link href="/data-quality">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan gap-1">
                  Quality Audit <ExternalLink className="size-3" />
                </Button>
              </Link>
            }
            footnote="Only reports with verified status 'ok' are accepted into feature extraction and baseline evaluation."
            isLoading={isLoading}
            error={error}
            isEmpty={qualitySlices.length === 0}
          >
            <StatusDonutChart
              slices={qualitySlices}
              centerLabel="Reports"
              centerValue={qualityData?.national_summary?.total_reports ? qualityData.national_summary.total_reports.toLocaleString() : "--"}
              height={220}
            />
          </ChartCard>
        </div>
      </div>

      {/* RDHS Area Surveillance Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              RDHS Area Surveillance Status
            </CardTitle>
            <CardDescription className="text-xs">
              Provisional alerts, data quality verification, and predicted incidence across all 26 RDHS entities
            </CardDescription>
          </div>
          <Link href="/rdhs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-cyan">
              View All 26 Profiles <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading staging surveillance data...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Data Quality</TableHead>
                    <TableHead className="text-right">Predicted (μ)</TableHead>
                    <TableHead className="text-right">Elevated (pE)</TableHead>
                    <TableHead className="text-right">High (pH)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rdhsList.slice(0, 10).map((row) => (
                    <TableRow key={row.rdhs} className="hover:bg-surface-raised/60">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/rdhs?id=${encodeURIComponent(row.rdhs)}`}
                          className="hover:text-cyan hover:underline flex items-center gap-1.5"
                        >
                          {row.rdhs}
                          {row.rdhs === "Kalmunai" && (
                            <span className="text-[10px] text-cyan bg-cyan/10 px-1 py-0.2 rounded font-mono">
                              Separate RDHS
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.district}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(row.tier)}>
                          {row.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-mono">
                          {row.data_quality_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.mu !== null && row.mu !== undefined
                          ? row.mu.toFixed(2)
                          : <span className="text-muted-foreground">Unavailable</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-cyan">
                        {row.pE !== null && row.pE !== undefined
                          ? `${(row.pE * 100).toFixed(1)}%`
                          : <span className="text-muted-foreground">Unavailable</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-400">
                        {row.pH !== null && row.pH !== undefined
                          ? `${(row.pH * 100).toFixed(1)}%`
                          : <span className="text-muted-foreground">Unavailable</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
