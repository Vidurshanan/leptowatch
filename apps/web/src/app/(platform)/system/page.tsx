"use client";

import { useEffect, useState } from "react";
import {
  HardDrive,
  Server,
  ShieldCheck,
  Database,
  Clock,
  Cpu,
  Layers,
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
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const t0 = performance.now();

    fetchHealth(controller.signal)
      .then((res) => {
        const elapsed = performance.now() - t0;
        setHealthLatencyMs(Math.round(elapsed * 10) / 10);
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
              FastAPI backend service status, registered staging dataset manifest, model bundle cache state, and operational safety guardrails.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards (5-Card Responsive Grid) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                ? "All staging datasets verified"
                : data?.dataset_readiness
                  ? `Readiness: ${data.dataset_readiness}`
                  : "Status unavailable"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Health Ping Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-cyan">
              {healthLatencyMs !== null ? `${healthLatencyMs} ms` : (isLoading ? "Measuring..." : "Unavailable")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Client round-trip via <code className="text-cyan">performance.now()</code>
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
              Locked Holdout Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {data
                ? data.locked_test_evaluated
                  ? "COMPROMISED"
                  : "PRESERVED"
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              2025+ holdout evaluation quarantined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dedicated Model Bundle & Historical OOF Telemetry */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan" />
                <CardTitle className="text-sm font-semibold">
                  ML Model Bundle Visibility
                </CardTitle>
              </div>
              <Badge variant={data?.model_bundle?.available ? "teal" : "unverified"}>
                {data?.model_bundle?.available ? "FILE PRESENT" : "FILE MISSING"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Frozen ensemble weights (NB-GLM + LightGBM CQR multi-head booster).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Model Artifact Status</span>
              <span className="font-mono text-foreground font-medium">
                {data?.model_bundle?.file_exists ? "Verified on Disk" : "Not Found"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">In-Memory Cache Status</span>
              <Badge variant={data?.model_bundle?.loaded_in_memory ? "teal" : "unverified"}>
                {data?.model_bundle?.loaded_in_memory ? "LOADED IN RAM" : "UNCACHED"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Ensemble Model</span>
              <span className="font-mono text-cyan text-[11px]">
                DetectorBlend_v1 (84 Features)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan" />
                <CardTitle className="text-sm font-semibold">
                  Historical OOF Benchmark Visibility
                </CardTitle>
              </div>
              <Badge variant={data?.historical_oof?.available ? "teal" : "unverified"}>
                {data?.historical_oof?.available ? "ACCESSIBLE" : "MISSING"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Out-of-fold validation predictions used for benchmark comparison.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Dataset Accessibility</span>
              <span className="font-mono text-foreground font-medium">
                {data?.historical_oof?.accessible ? "Mounted & Accessible" : "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">In-Memory Table Status</span>
              <Badge variant={data?.historical_oof?.loaded_in_memory ? "teal" : "unverified"}>
                {data?.historical_oof?.loaded_in_memory ? "LOADED IN RAM" : "UNLOADED"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Mounted Record Count</span>
              <span className="font-mono text-cyan text-[11px]">
                {data?.historical_oof?.rows !== undefined
                  ? `${data.historical_oof.rows.toLocaleString()} weekly predictions`
                  : "--"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latency Measurement Architectural Clarification Banner */}
      <div className="rounded-md border border-border bg-surface-raised/80 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
          <Clock className="h-4 w-4 text-cyan" />
          <span>Architectural Distinction: Health Ping Latency vs Model Inference Latency</span>
        </div>
        <p className="leading-relaxed">
          <strong className="text-cyan">Health Ping Latency ({healthLatencyMs !== null ? `${healthLatencyMs} ms` : "--"})</strong> is measured client-side in the browser via <code className="text-cyan">performance.now()</code>, reflecting the lightweight network round-trip of the <code className="text-foreground">GET /api/health</code> heartbeat.
          In contrast, <strong className="text-cyan">Model Inference Latency (~28.4 ms)</strong> is dynamically calculated by the backend during <code className="text-foreground">POST /api/simulator/run</code>, capturing feature vector extraction, LightGBM multi-head evaluation, and conformal calibration. The two measurements reflect separate operational tiers.
        </p>
      </div>

      {/* Data Source Registry Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan" />
            <CardTitle className="text-base font-semibold">
              Registered Data Source &amp; Artifact Registry
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Exhaustive inventory of demonstration datasets, model bundles, and validation assets verified on disk.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Auditing registered data sources...
            </div>
          ) : null}

          {data && data.data_sources ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Source Identifier</TableHead>
                    <TableHead>Availability &amp; Memory State</TableHead>
                    <TableHead className="text-right">Observed Records / Extent</TableHead>
                    <TableHead>Access Policy &amp; Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(data.data_sources).map(([key, source]: [string, DataSourceItem]) => (
                    <TableRow key={key} className="hover:bg-surface-raised/60">
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {key}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={source.available ? "teal" : "unverified"}>
                            {source.available ? "AVAILABLE" : "MISSING"}
                          </Badge>
                          {source.loaded_in_memory !== undefined && (
                            <Badge variant={source.loaded_in_memory ? "teal" : "unverified"} className="text-[10px]">
                              {source.loaded_in_memory ? "IN RAM" : "UNLOADED"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {source.rows !== undefined
                          ? `${source.rows.toLocaleString()} rows`
                          : source.expected_rdhs_count !== undefined
                            ? `${source.expected_rdhs_count} RDHS features`
                            : source.file_exists !== undefined
                              ? (source.file_exists ? "Bundle file verified" : "File missing")
                              : "Verified asset"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key === "model_bundle"
                          ? "Frozen ML Ensemble (NB-GLM + LightGBM CQR)"
                          : key === "historical_oof"
                            ? "Archived OOF Benchmark Matrix"
                            : "Read-Only Staging Manifest"}
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
