"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Database,
  ShieldAlert,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  StatusDonutChart,
  QualityBreakdownBarChart,
} from "@/components/charts";
import {
  DataQualityResponse,
  fetchDataQuality,
  RDHSQualityItem,
} from "@/lib/api";

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();

    fetchDataQuality(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load data quality metrics");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const summary = data?.national_summary;

  const filteredBreakdown = useMemo(() => {
    if (!data?.rdhs_breakdown) return [];
    if (!searchTerm) return data.rdhs_breakdown;
    return data.rdhs_breakdown.filter((r) =>
      r.rdhs.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // National reporting quality slices
  const qualitySlices = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Accepted Reports (ok)", value: summary.accepted_reports, color: "#10B981" },
      { name: "Missing (no accepted)", value: summary.missing_reports, color: "#F59E0B" },
      { name: "Nonreporting Status", value: summary.nonreporting_reports, color: "#64748B" },
    ];
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Data Quality &amp; Surveillance Integrity
              </h1>
              <Badge variant="unverified">Staging Audit</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Completeness, accepted report ratios, missing-value preservation, and dynamic freshness gates across all 26 RDHS health areas.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Zero-Fill Prohibition Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="font-semibold text-foreground">
              Epidemiological Integrity Rule: Zero-Fill Prohibition
            </div>
            <p className="text-muted-foreground">
              {summary?.unaccepted_reports_rule ||
                "Unaccepted reports are preserved as null. They are never filled with zero."}
            </p>
            <p className="text-muted-foreground">
              A recorded value of <code className="text-foreground">0</code> denotes a verified epidemiology report confirming zero clinical leptospirosis cases.
              Missing or delayed reports (<code className="text-amber">no_accepted_report</code> or <code className="text-amber">nonreporting</code>)
              represent absence of confirmed surveillance data and must remain <code className="text-cyan">null</code> to prevent downward artificial bias in disease modeling.
            </p>
          </div>
        </div>
      </div>

      {/* National Quality KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Total Surveillance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary ? summary.total_reports.toLocaleString() : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              National weekly returns
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Accepted Reports (ok)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {summary ? summary.accepted_reports.toLocaleString() : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary ? `${summary.accepted_percentage.toFixed(1)}% completeness` : "--"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Missing (No Accepted Report)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {summary ? summary.missing_reports.toLocaleString() : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preserved strictly as null
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Nonreporting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-300">
              {summary ? summary.nonreporting_reports : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preserved strictly as null
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Freshness Gate Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="unverified">
              {summary?.operational_status || (isLoading ? "--" : "Unavailable")}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary?.freshness?.age_days !== null && summary?.freshness?.age_days !== undefined
                ? `Age: ${summary.freshness.age_days}d (policy: ${summary.freshness.policy_threshold_days || 56}d)`
                : "Dataset age unavailable"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Row: Quality Donut + Completeness by RDHS Bar Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: National Completeness Donut Chart (5 cols) */}
        <div className="lg:col-span-5">
          <ChartCard
            title="National Historical Reporting Completeness"
            subtitle="Ratio of accepted 'ok' reports versus missing or nonreporting submissions across pre-2025 panel."
            badge={<Badge variant="staging">National Total</Badge>}
            footnote="Reports without verified status 'ok' are excluded from feature calculation and baseline training."
            isLoading={isLoading}
            error={error}
            isEmpty={qualitySlices.length === 0}
          >
            <StatusDonutChart
              slices={qualitySlices}
              centerLabel="Total Reports"
              centerValue={summary?.total_reports ? summary.total_reports.toLocaleString() : "--"}
              height={270}
            />
          </ChartCard>
        </div>

        {/* Right Column: Reporting Completeness by RDHS (7 cols) */}
        <div className="lg:col-span-7">
          <ChartCard
            title="Completeness Audit by Health Area (RDHS)"
            subtitle="Stacked reporting status breakdown across RDHS areas with lowest completeness."
            badge={<Badge variant="unverified">Stacked Audit</Badge>}
            footnote="Sorted ascending by completeness percentage to highlight health administrative areas with reporting gaps."
            isLoading={isLoading}
            error={error}
            isEmpty={!data?.rdhs_breakdown || data.rdhs_breakdown.length === 0}
          >
            {data?.rdhs_breakdown && (
              <QualityBreakdownBarChart items={data.rdhs_breakdown} height={270} limit={10} />
            )}
          </ChartCard>
        </div>
      </div>

      {/* RDHS Completeness Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                RDHS Surveillance Reporting Completeness Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Historical surveillance time-series panel audit across all 26 RDHS health areas
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter RDHS areas..."
                className="pl-8 text-xs h-8 bg-surface-raised"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading data quality audit...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-400">{error}</div>
          ) : filteredBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead className="text-right">Total Weeks</TableHead>
                    <TableHead className="text-right">Accepted (ok)</TableHead>
                    <TableHead className="text-right">Missing</TableHead>
                    <TableHead className="text-right">Nonreporting</TableHead>
                    <TableHead className="text-right">Completeness %</TableHead>
                    <TableHead>Latest Accepted Week</TableHead>
                    <TableHead>Current Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBreakdown.map((row: RDHSQualityItem) => (
                    <TableRow key={row.rdhs} className="hover:bg-surface-raised/60">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/rdhs?id=${encodeURIComponent(row.rdhs)}`}
                          className="hover:text-cyan hover:underline"
                        >
                          {row.rdhs}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.total_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-400 font-semibold">
                        {row.accepted_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber-400">
                        {row.missing_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-400">
                        {row.nonreporting_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-cyan">
                        {row.completeness_pct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.latest_accepted_week || "None"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="unverified">
                          {row.current_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No RDHS areas match the search filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
