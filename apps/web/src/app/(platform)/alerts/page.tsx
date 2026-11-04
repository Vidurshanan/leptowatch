"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Info,
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
import { AlertListResponse, AlertRecord, fetchAlertsLatest } from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function AlertsPage() {
  const [data, setData] = useState<AlertListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchAlertsLatest(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load alerts");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const recordsCount = data?.records ? data.records.length : null;
  const isFullNationalCoverage = recordsCount === 26;

  const watchCount = data?.records
    ? data.records.filter((r) => (r.tier || "").toLowerCase() === "watch").length
    : null;

  const unverifiedCount = data?.records
    ? data.records.filter(
        (r) => r.unverified === true || (r.verification_status || "").toUpperCase() === "UNVERIFIED"
      ).length
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Alert Management &mdash; Provisional Risk Classifications
              </h1>
              <Badge variant="staging">Provisional Staging</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {data?.provisional_notice ||
                "These tiers are provisional project classifications, not official public-health declarations. Watch-Unverified indicates input freshness or verification requirements were not met. Flood proxies alone never trigger Warning."}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Monitored RDHS Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {isLoading ? "--" : recordsCount !== null ? recordsCount : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFullNationalCoverage
                ? "Full national coverage (26/26 verified)"
                : recordsCount !== null
                  ? `Staging records received (${recordsCount} areas)`
                  : "Awaiting API response"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Provisional Watch Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-watch">
              {isLoading ? "--" : watchCount !== null ? watchCount : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Staging candidate tier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Unverified Classifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-unverified">
              {isLoading ? "--" : unverifiedCount !== null ? unverifiedCount : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Freshness/verification gate blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Public Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-danger">NOT OPERATIONAL</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Internal research staging only
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Safety Directive Callout */}
      <div className="rounded-md border border-border bg-surface-muted p-3 text-xs flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-cyan mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">
            Non-Negative Assertion Policy
          </div>
          <div className="text-muted-foreground">
            Missing or invalid detector flags must not be interpreted as evidence that no alert condition exists.
            Epidemiological confirmation and operational sign-off are required prior to public advisory release.
          </div>
        </div>
      </div>

      {/* Alert Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold">
            National Provisional Alert Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Provisional classifications, triggering rules, reasons, and detector flags derived from staging outputs.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading provisional alert records...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-danger">{error}</div>
          ) : data && data.records ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead>Provisional Tier</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Triggering Rule</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead>Failures / Freshness</TableHead>
                    <TableHead className="text-center">C_fire (Elevated)</TableHead>
                    <TableHead className="text-center">D_fire (High)</TableHead>
                    <TableHead className="text-right">pE / pH</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((rec: AlertRecord) => (
                    <TableRow key={rec.rdhs}>
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
                          {rec.verification_status || "UNVERIFIED"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        <span className="truncate block max-w-[200px]" title={rec.rule || ""}>
                          {rec.rule || "--"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="truncate block max-w-[240px]" title={rec.reasons || ""}>
                          {rec.reasons || "--"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {rec.failures === null || rec.failures === undefined ? (
                          <span className="text-muted-foreground italic">Unavailable</span>
                        ) : rec.failures.trim() === "" || rec.failures.toLowerCase() === "none" ? (
                          <span className="text-muted-foreground">None reported in record</span>
                        ) : (
                          <span className="truncate block max-w-[180px] text-amber" title={rec.failures}>
                            {rec.failures}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {rec.C_fire !== null && rec.C_fire !== undefined ? (
                          <span
                            className={
                              rec.C_fire === 1
                                ? "font-bold text-amber"
                                : "text-muted-foreground"
                            }
                          >
                            {rec.C_fire}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {rec.D_fire !== null && rec.D_fire !== undefined ? (
                          <span
                            className={
                              rec.D_fire === 1
                                ? "font-bold text-danger"
                                : "text-muted-foreground"
                            }
                          >
                            {rec.D_fire}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {rec.pE !== null && rec.pE !== undefined ? rec.pE.toFixed(2) : "--"} /{" "}
                        {rec.pH !== null && rec.pH !== undefined ? rec.pH.toFixed(2) : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Tier Architecture & Methodology */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Alert Tier Progression Architecture
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <div>
              <strong className="text-foreground">Normal:</strong> Baseline surveillance. Historical pattern within expected seasonal ranges.
            </div>
            <div>
              <strong className="text-watch">Watch:</strong> Low-to-moderate early warning or unverified inputs. Requires continued monitoring without public alert.
            </div>
            <div>
              <strong className="text-advisory">Advisory:</strong> Elevated risk probability (pE &ge; 0.50) or confirmed environmental co-triggers. MOH notification recommended.
            </div>
            <div>
              <strong className="text-warning-tier">Warning:</strong> High risk probability (pH &ge; 0.50) with multi-stream confirmation. Urgent epidemiological intervention.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber" />
              <CardTitle className="text-sm font-semibold">
                Detector Flags &amp; Safety Guardrails
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong className="text-foreground">Detector C (C_fire):</strong>{" "}
              Fires when model predicted cases exceed the 75th percentile of historical baseline distribution for the epidemiological week.
            </p>
            <p>
              <strong className="text-foreground">Detector D (D_fire):</strong>{" "}
              Fires when predicted cases exceed the 90th percentile of historical baseline distribution.
            </p>
            <p>
              <strong className="text-foreground">Flood Invariance:</strong> SAR flood proxies are strictly constrained; surface water detection alone cannot upgrade an area to Warning tier without concurrent clinical case elevation.
            </p>
            <p>
              <strong className="text-amber">Failure Record Caveat:</strong> An unrecorded failure detail or &quot;None reported in record&quot; does not prove that no data failure exists.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
