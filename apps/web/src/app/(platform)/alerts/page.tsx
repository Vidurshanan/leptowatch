"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  Info,
  Search,
  ExternalLink,
  LayoutGrid,
  List,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/charts";
import { AlertListResponse, AlertRecord, fetchAlertsLatest } from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const [data, setData] = useState<AlertListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

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

  const elevatedCount = data?.records
    ? data.records.filter((r) => {
        const t = (r.tier || "").toLowerCase();
        return t === "warning" || t === "critical";
      }).length
    : 0;

  const unverifiedCount = data?.records
    ? data.records.filter(
        (r) => r.unverified === true || (r.verification_status || "").toUpperCase() === "UNVERIFIED"
      ).length
    : null;

  // Filtered alerts
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    return data.records.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.rdhs.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.reasons && r.reasons.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.rule && r.rule.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedTierFilter === "ALL") return true;
      if (selectedTierFilter === "ELEVATED") {
        const t = (r.tier || "").toLowerCase();
        return t === "warning" || t === "critical";
      }
      if (selectedTierFilter === "WATCH") {
        return (r.tier || "").toLowerCase() === "watch";
      }
      if (selectedTierFilter === "UNVERIFIED") {
        return r.unverified === true || (r.verification_status || "").toUpperCase() === "UNVERIFIED";
      }
      return true;
    });
  }, [data, searchTerm, selectedTierFilter]);

  // Donut chart slices
  const tierSlices = useMemo(() => {
    if (!data?.records) return [];
    const counts: Record<string, number> = {};
    for (const r of data.records) {
      const t = r.tier || "Other";
      counts[t] = (counts[t] || 0) + 1;
    }
    const colors: Record<string, string> = {
      Critical: "#EF4444",
      Warning: "#F97316",
      Watch: "#F59E0B",
      Advisory: "#38BDF8",
      Normal: "#10B981",
    };
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: colors[name] || "#64748B",
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
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

      {/* Top Metrics & Status Donut */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-8 grid gap-4 sm:grid-cols-2">
          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Monitored RDHS Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-cyan-bright">
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

          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Elevated Risk Tiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-rose-500">
                {isLoading ? "--" : elevatedCount}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Critical or Warning declarations
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Provisional Watch Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {isLoading ? "--" : watchCount !== null ? watchCount : "Unavailable"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Provisional surveillance watch
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Public Health Approval Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold font-mono text-rose-500">NOT OPERATIONAL</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Research staging demonstration only
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Donut Chart (4 cols) */}
        <div className="lg:col-span-4">
          <ChartCard
            title="Active Alert Tiers"
            subtitle="National distribution across 26 areas"
            isLoading={isLoading}
            error={error}
            isEmpty={tierSlices.length === 0}
            className="h-full"
          >
            <StatusDonutChart
              slices={tierSlices}
              centerLabel="Active Alerts"
              centerValue={data?.count ?? 26}
              height={160}
            />
          </ChartCard>
        </div>
      </div>

      {/* Safety Directive Callout */}
      <div className="rounded-md border border-border bg-surface-raised p-3 text-xs flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-cyan mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">
            Non-Negative Assertion Policy &amp; Detector Integrity
          </div>
          <div className="text-muted-foreground">
            Missing or invalid detector flags must not be interpreted as evidence that no alert condition exists.
            Epidemiological confirmation and operational sign-off are required prior to public advisory release.
          </div>
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by RDHS or trigger..."
              className="pl-8 text-xs h-8 bg-surface"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={selectedTierFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTierFilter("ALL")}
              className="h-8 text-xs px-2.5"
            >
              All ({data?.records.length ?? 0})
            </Button>
            <Button
              variant={selectedTierFilter === "ELEVATED" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTierFilter("ELEVATED")}
              className="h-8 text-xs px-2.5"
            >
              Elevated ({elevatedCount})
            </Button>
            <Button
              variant={selectedTierFilter === "WATCH" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTierFilter("WATCH")}
              className="h-8 text-xs px-2.5"
            >
              Watch ({watchCount ?? 0})
            </Button>
            <Button
              variant={selectedTierFilter === "UNVERIFIED" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTierFilter("UNVERIFIED")}
              className="h-8 text-xs px-2.5"
            >
              Unverified ({unverifiedCount ?? 0})
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}
            className="h-8 text-xs gap-1.5"
            aria-label="Cards View"
          >
            <LayoutGrid className="size-3.5" />
            <span>Cards</span>
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-8 text-xs gap-1.5"
            aria-label="Table View"
          >
            <List className="size-3.5" />
            <span>Table</span>
          </Button>
        </div>
      </div>

      {/* Main Alert Content: Cards vs Table */}
      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground space-y-3">
          <div className="size-8 mx-auto animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p>Loading provisional surveillance alerts...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md p-4">
          {error}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground bg-surface border border-border rounded-md">
          No alert records match the selected filter.
        </div>
      ) : viewMode === "cards" ? (
        /* Redesigned Severity-Bordered Alert Dossier Cards */
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRecords.map((r: AlertRecord) => {
            const tierUpper = (r.tier || "").toUpperCase();
            const isCritical = tierUpper === "CRITICAL";
            const isWarning = tierUpper === "WARNING";
            const isWatch = tierUpper === "WATCH";
            const isAdvisory = tierUpper === "ADVISORY";

            // Left-border color depending on severity
            const borderLeftClass = isCritical
              ? "border-l-4 border-l-rose-500"
              : isWarning
              ? "border-l-4 border-l-orange-500"
              : isWatch
              ? "border-l-4 border-l-amber-400"
              : isAdvisory
              ? "border-l-4 border-l-cyan"
              : "border-l-4 border-l-slate-600";

            return (
              <div
                key={r.rdhs}
                className={cn(
                  "rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-panel)] transition-all hover:border-cyan/40",
                  borderLeftClass
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/rdhs?id=${encodeURIComponent(r.rdhs)}`}
                        className="text-base font-semibold text-foreground hover:text-cyan transition-colors flex items-center gap-1.5"
                      >
                        <span>{r.rdhs} RDHS</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Link>
                      <Badge variant={getTierBadgeVariant(r.tier)}>
                        {r.tier || "Unknown"}
                      </Badge>
                      {r.unverified && (
                        <Badge variant="unverified">Unverified</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verification Status: <span className="font-mono text-slate-300">{r.verification_status}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Exceedance Risk (pE)
                    </span>
                    <span className="text-base font-mono font-bold text-cyan">
                      {r.pE !== null ? `${(r.pE * 100).toFixed(1)}%` : "--"}
                    </span>
                  </div>
                </div>

                {/* Body Diagnostics */}
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-300">Epidemiological Trigger Reasons:</span>
                    <p className="mt-0.5 text-muted-foreground leading-relaxed">
                      {r.reasons || "No specific trigger reasons logged."}
                    </p>
                  </div>

                  {r.rule && (
                    <div className="rounded bg-surface-raised p-2 text-[11px] font-mono text-slate-300 border border-border/50">
                      <span className="text-cyan font-semibold">Rule:</span> {r.rule}
                    </div>
                  )}

                  {r.failures && (
                    <div className="rounded bg-rose-500/10 p-2 text-[11px] font-mono text-rose-300 border border-rose-500/20">
                      <span className="font-semibold text-rose-400">Gating Block:</span> {r.failures}
                    </div>
                  )}

                  {/* Quantitative Flags Footer */}
                  <div className="pt-2 border-t border-border/40 grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                    <div className="rounded bg-surface-raised p-1.5 border border-border/40">
                      <span className="text-muted-foreground block text-[10px]">pE / pH</span>
                      <span className="text-cyan font-semibold">
                        {r.pE !== null ? (r.pE * 100).toFixed(0) : "-"}% / {r.pH !== null ? (r.pH * 100).toFixed(0) : "-"}%
                      </span>
                    </div>
                    <div className="rounded bg-surface-raised p-1.5 border border-border/40">
                      <span className="text-muted-foreground block text-[10px]">C_fire (Elev)</span>
                      <span className={cn("font-semibold", r.C_fire === 1 ? "text-rose-400" : "text-slate-400")}>
                        {r.C_fire !== null ? r.C_fire : "--"}
                      </span>
                    </div>
                    <div className="rounded bg-surface-raised p-1.5 border border-border/40">
                      <span className="text-muted-foreground block text-[10px]">D_fire (High)</span>
                      <span className={cn("font-semibold", r.D_fire === 1 ? "text-rose-400" : "text-slate-400")}>
                        {r.D_fire !== null ? r.D_fire : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Ledger Table View */
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">
              National Provisional Alert Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Provisional classifications, triggering rules, reasons, and detector flags derived from staging outputs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
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
                    <TableHead className="text-center">C_fire</TableHead>
                    <TableHead className="text-center">D_fire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r: AlertRecord) => (
                    <TableRow key={r.rdhs} className="hover:bg-surface-raised/60">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/rdhs?id=${encodeURIComponent(r.rdhs)}`}
                          className="hover:text-cyan hover:underline"
                        >
                          {r.rdhs}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTierBadgeVariant(r.tier)}>
                          {r.tier || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="unverified">
                          {r.verification_status || (r.unverified ? "UNVERIFIED" : "VERIFIED")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">
                        {r.rule || "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                        {r.reasons || "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {r.failures || (r.failures === null ? "Unavailable" : "None")}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {r.C_fire !== null && r.C_fire !== undefined ? r.C_fire : "--"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {r.D_fire !== null && r.D_fire !== undefined ? r.D_fire : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
