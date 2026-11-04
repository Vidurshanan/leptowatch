"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Calendar,
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
  DashboardSummaryResponse,
  fetchDashboardSummary,
  fetchRDHSList,
  RDHSSummaryItem,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function OverviewPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchDashboardSummary(controller.signal),
      fetchRDHSList(controller.signal),
    ])
      .then(([summaryData, rdhsData]) => {
        setSummary(summaryData);
        setRdhsList(rdhsData.records);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard summary");
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner: Staging Notice */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  National Leptospirosis Surveillance Platform
                </h2>
                <Badge variant="unverified">Experimental Staging</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Reproducible staging demonstration for 26 RDHS health areas.
                Derived from verified pre-2025 pipeline data. Not approved for
                operational public-health action.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/geographic">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5 text-cyan" />
                Open Map
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              National Coverage
            </CardTitle>
            <Layers className="h-4 w-4 text-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-bright">
              {summary ? `${summary.rdhs_count} RDHS` : isLoading ? "Loading..." : "--"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes Kalmunai separate from Ampara
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Staging Alert Status
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-watch" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {summary?.tier_counts
                ? Object.entries(summary.tier_counts)
                    .map(([tier, count]) => `${count} ${tier}`)
                    .join(", ") || "No tier data"
                : isLoading
                  ? "Loading..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.data_quality_counts
                ? Object.entries(summary.data_quality_counts)
                    .map(([status, count]) => `${count} ${status}`)
                    .join(", ") || "Quality data unavailable"
                : "Input verification pending"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Case Reporting Freshness
            </CardTitle>
            <Clock className="h-4 w-4 text-amber" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber">
              {summary?.freshness?.age_days !== null && summary?.freshness?.age_days !== undefined
                ? `${summary.freshness.age_days} days`
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.freshness
                ? `Latest ok: ${summary.freshness.latest_accepted_date ?? "None"} (Threshold: ${summary.freshness.policy_threshold_days}d)`
                : "Freshness policy unavailable"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Operational Approval
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">
              {summary
                ? summary.operational_approval
                  ? "APPROVED"
                  : "FALSE"
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: RDHS Table + Limitations */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: RDHS Surveillance Overview (8 cols) */}
        <div className="lg:col-span-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  RDHS Area Surveillance Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Provisional alerts and predicted mean cases across all 26 health areas
                </CardDescription>
              </div>
              <Link href="/rdhs">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-cyan">
                  View All <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Loading staging surveillance data...
                </div>
              ) : error ? (
                <div className="py-8 text-center text-sm text-danger">{error}</div>
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
                        <TableRow key={row.rdhs}>
                          <TableCell className="font-medium text-foreground">
                            <Link
                              href={`/rdhs?id=${encodeURIComponent(row.rdhs)}`}
                              className="hover:text-cyan hover:underline"
                            >
                              {row.rdhs}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.district}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTierBadgeVariant(row.tier)}>
                              {row.tier || "Unavailable"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.data_quality_status === "VERIFIED" ? "teal" : "unverified"}>
                              {row.data_quality_status || "UNVERIFIED"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-cyan-bright">
                            {row.mu !== null ? row.mu.toFixed(1) : "--"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.pE !== null ? row.pE.toFixed(3) : "--"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.pH !== null ? row.pH.toFixed(3) : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="mt-3 text-right text-[11px] text-muted-foreground">
                    Showing 10 of 26 RDHS areas.{" "}
                    <Link href="/rdhs" className="text-cyan underline">
                      View complete table in RDHS Profiles &rarr;
                    </Link>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Known Limitations & Provenance (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber" />
                <CardTitle className="text-sm font-semibold">
                  Known Project Limitations
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Demonstration manifest constraints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>
                    Accepted case freshness gate (&gt;56 days) blocks operational
                    use.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>
                    Staging inference does not establish current-period predictive
                    validity.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>
                    Environmental predictor issue-time availability has not been
                    verified.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>
                    Alert thresholds are synthetic staging values, not production-approved.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>
                    Locked test period beginning 2025-01-01 has not been evaluated.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan" />
                <CardTitle className="text-sm font-semibold">
                  Demonstration Timeline
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Staging Issue Week:</span>
                <span className="font-mono text-cyan-bright">
                  {summary?.issue_start ?? (isLoading ? "Loading..." : "Unavailable")}
                </span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Latest Accepted Case:</span>
                <span className="font-mono text-amber">
                  {summary?.freshness?.latest_accepted_date ?? (isLoading ? "Loading..." : "Unavailable")}
                </span>
              </div>
              <div className="flex justify-between border-b border-border py-1">
                <span className="text-muted-foreground">Locked Test Boundary:</span>
                <span className="font-mono text-foreground">2025-01-01</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Evaluation Status:</span>
                <span className="font-mono text-muted-foreground">NOT_EVALUATED</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
