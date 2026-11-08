"use client";

import { useEffect, useState } from "react";
import {
  HardDrive,
  Server,
  ShieldCheck,
  Database,
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
  DataSourceItem,
  fetchHealth,
  HealthResponse,
} from "@/lib/api";

export default function SystemPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load system health");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                System Telemetry &amp; Staging Governance
              </h1>
              <Badge variant={data?.service_status === "OK" ? "teal" : "unverified"}>
                {data?.service_status ?? (isLoading ? "CHECKING" : "UNAVAILABLE")}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              FastAPI backend service status, registered staging dataset manifest, and operational safety guardrails.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              API Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {data?.service_status ?? (isLoading ? "Checking..." : "Unavailable")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.version ? `v${data.version}` : "v1.0.0"} &mdash; Read-Only Staging
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Dataset Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-cyan-bright">
              {data?.dataset_readiness ?? (isLoading ? "Checking..." : "Unavailable")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.dataset_readiness === "READY"
                ? "All 6 staging datasets verified"
                : data?.dataset_readiness
                  ? `Readiness: ${data.dataset_readiness}`
                  : "Status unavailable"}
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
            <div className="text-2xl font-bold font-mono text-rose-500">
              {data
                ? data.operational_approval
                  ? "TRUE"
                  : "FALSE"
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {data?.mode ? `Mode: ${data.mode}` : "READ_ONLY_STAGING"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Freshness Policy Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {data?.freshness_policy_days !== undefined
                ? `${data.freshness_policy_days} Days`
                : isLoading
                  ? "Checking..."
                  : "56 Days"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Internal gating threshold
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dataset Readiness Cards Grid */}
      {data?.data_sources && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <HardDrive className="size-4 text-cyan" />
            <span>Staging Dataset Source Readiness</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.data_sources).map(([key, source]: [string, DataSourceItem]) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-panel)] flex items-start justify-between gap-2"
              >
                <div>
                  <span className="font-mono text-xs font-semibold text-foreground block">
                    {key}
                  </span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    {source.rows !== undefined
                      ? `${source.rows.toLocaleString()} records`
                      : source.expected_rdhs_count !== undefined
                      ? `${source.expected_rdhs_count} health areas`
                      : "Verified asset"}
                  </span>
                </div>
                <Badge variant={source.available ? "teal" : "unverified"} className="text-[10px]">
                  {source.available ? "READY" : "MISSING"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staging Data Sources Inventory Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan" />
            <CardTitle className="text-base font-semibold">
              Registered Staging Data Sources Inventory
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Physical staging file assets registered in application configuration and verified at service initialization.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Checking staging dataset inventory...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-400">{error}</div>
          ) : data && data.data_sources ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Source Asset</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Observed Records / Extent</TableHead>
                    <TableHead>Access Policy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.data_sources).map(([key, source]: [string, DataSourceItem]) => (
                    <TableRow key={key} className="hover:bg-surface-raised/60">
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {key}
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.available ? "teal" : "unverified"}>
                          {source.available ? "AVAILABLE" : "MISSING"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {source.rows !== undefined
                          ? `${source.rows.toLocaleString()} rows`
                          : source.expected_rdhs_count !== undefined
                            ? `${source.expected_rdhs_count} RDHS features`
                            : "Verified asset"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Read-Only Staging Manifest
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Operational Safety Guardrails */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-base font-semibold">
              Operational Safety Guardrails &amp; Governance Rules
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Mandatory architectural principles enforced across all API endpoints and frontend visualizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
          <div className="rounded-md border border-border bg-surface-raised p-3">
            <div className="font-semibold text-foreground">
              1. Non-Execution of Model Retraining &amp; Recalibration
            </div>
            <p className="mt-0.5">
              Backend is strictly read-only. Methods <code className="text-cyan">weekly()</code>,{" "}
              <code className="text-cyan">prepare()</code>, <code className="text-cyan">train_final()</code>,
              and retraining pipelines are disabled. Responses are served from immutable pre-computed Parquet and JSON files.
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-raised p-3">
            <div className="font-semibold text-foreground">
              2. Strict Locked Holdout Boundary Enforcement
            </div>
            <p className="mt-0.5">
              Surveillance data from <code className="text-amber">2025-01-01</code> onwards is quarantined as locked holdout test partition.
              The API never calculates metrics, loss, or predictions against locked test data.
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-raised p-3">
            <div className="font-semibold text-foreground">
              3. Missing Report Preservation (Zero-Fill Forbidden)
            </div>
            <p className="mt-0.5">
              Unaccepted surveillance submissions (<code className="text-amber">no_accepted_report</code>,{" "}
              <code className="text-amber">nonreporting</code>) are serialized strictly as <code className="text-cyan">null</code>.
              Replacing missing reports with zero is forbidden to prevent artificial downward bias.
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-raised p-3">
            <div className="font-semibold text-foreground">
              4. 26-RDHS Partition Integrity (Kalmunai Distinction)
            </div>
            <p className="mt-0.5">
              Sri Lanka is partitioned into 26 RDHS health administrative units. Kalmunai is maintained as an independent health entity separate from Ampara,
              with environmental indicators appropriately flagged as whole-district proxies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
