"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Database,
  ShieldAlert,
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
  DataQualityResponse,
  fetchDataQuality,
  RDHSQualityItem,
} from "@/lib/api";

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Data Quality &amp; Surveillance Integrity
              </h1>
              <Badge variant="unverified">Staging Audit</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Completeness, accepted report ratios, missing-value preservation, and dynamic freshness gates across 26 RDHS health areas.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Zero-Fill Prohibition Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4">
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
        <Card>
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
              {summary ? "National weekly returns" : "Awaiting API response"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Accepted Reports (ok)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-teal">
              {summary ? summary.accepted_reports.toLocaleString() : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary ? `${summary.accepted_percentage.toFixed(1)}% completeness` : "Awaiting API response"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Missing (no accepted report)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber">
              {summary ? summary.missing_reports.toLocaleString() : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary ? "Preserved strictly as null" : "Awaiting API response"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Nonreporting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {summary ? summary.nonreporting_reports : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary ? "Preserved strictly as null" : "Awaiting API response"}
            </p>
          </CardContent>
        </Card>

        <Card>
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
                ? `Age: ${summary.freshness.age_days}d (policy limit: ${summary.freshness.policy_threshold_days || 56}d)`
                : "Dataset age unavailable"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RDHS Completeness Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold">
            RDHS Surveillance Reporting Completeness
          </CardTitle>
          <CardDescription className="text-xs">
            Historical surveillance time-series panel audit across all 26 RDHS health areas.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading data quality audit...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-danger">{error}</div>
          ) : data && data.rdhs_breakdown ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead className="text-right">Total Weeks</TableHead>
                    <TableHead className="text-right">Accepted (ok)</TableHead>
                    <TableHead className="text-right">Missing (null)</TableHead>
                    <TableHead className="text-right">Nonreporting</TableHead>
                    <TableHead className="text-right">Completeness %</TableHead>
                    <TableHead>Latest Accepted Week</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rdhs_breakdown.map((item: RDHSQualityItem) => (
                    <TableRow key={item.rdhs}>
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/rdhs?id=${encodeURIComponent(item.rdhs)}`}
                          className="hover:text-cyan hover:underline"
                        >
                          {item.rdhs}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {item.total_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-teal">
                        {item.accepted_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-amber">
                        {item.missing_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {item.nonreporting_weeks}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        {item.completeness_pct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.latest_accepted_week || "None"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.current_status === "ok"
                              ? "teal"
                              : item.current_status === "nonreporting"
                                ? "unverified"
                                : "staging"
                          }
                        >
                          {item.current_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Surveillance Integrity Taxonomy Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              <CardTitle className="text-sm font-semibold">
                Surveillance Record Taxonomy
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <div>
              <strong className="text-teal">status = ok:</strong> Formally accepted surveillance record received from RDHS reporting unit. Case count may be 0 or positive integer.
            </div>
            <div>
              <strong className="text-amber">status = no_accepted_report:</strong> Weekly bulletin did not contain an accepted return for this RDHS. Handled as <code className="text-cyan">null</code> in feature generation and model scoring.
            </div>
            <div>
              <strong className="text-foreground">status = nonreporting:</strong> Unit officially designated as nonreporting for the period. Handled as <code className="text-cyan">null</code>.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Dynamic Freshness Policy Gate
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              The platform enforces a strict <strong className="text-foreground">56-day internal freshness policy limit</strong> on clinical surveillance data.
            </p>
            <p>
              When the time elapsed since the latest accepted case report exceeds 56 days, operational dispatch is automatically blocked and all forward model outputs are restricted to <code className="text-amber">EXPERIMENTAL_STAGING</code>.
            </p>
            <p className="text-amber">
              <em>Note:</em> Data freshness evaluates calendar recency only; fresh data does not grant operational public-health approval.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
