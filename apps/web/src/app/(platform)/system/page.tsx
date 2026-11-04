"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  HardDrive,
  Server,
  ShieldCheck,
  Terminal,
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
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
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
            <p className="mt-1 text-xs text-muted-foreground">
              FastAPI backend service status, registered staging dataset manifest, and operational safety guardrails.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              API Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-teal">
              {data?.service_status ?? (isLoading ? "Checking..." : "Unavailable")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.version ? `v${data.version}` : "Version unavailable"} &mdash; Read-Only Staging
            </p>
          </CardContent>
        </Card>

        <Card>
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
                ? "All staging files verified"
                : data?.dataset_readiness
                  ? `Readiness: ${data.dataset_readiness}`
                  : "Status unavailable"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Operational Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-danger">
              {data
                ? data.operational_approval
                  ? "TRUE"
                  : "FALSE"
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.mode ? `Mode: ${data.mode}` : isLoading ? "Loading mode..." : "Mode unavailable"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Freshness Policy Gate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {data?.freshness_policy_days !== undefined
                ? `${data.freshness_policy_days} Days`
                : isLoading
                  ? "Checking..."
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Max latency for live dispatch
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staging Data Sources Inventory Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-cyan" />
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
            <div className="py-8 text-center text-sm text-danger">{error}</div>
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
                    <TableRow key={key}>
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
                            ? `${source.expected_rdhs_count} RDHS areas`
                            : "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="font-mono text-[11px] text-cyan">
                          READ_ONLY
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

      {/* Safety Guardrails & Diagnostic Logs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal" />
              <CardTitle className="text-sm font-semibold">
                Operational Safety Safeguards
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <div>
              <strong className="text-foreground">Read-Only Isolation:</strong> The web platform and backend API operate in strict read-only mode against staged research artifacts. Ledger writes, database updates, retraining, and notification dispatch are strictly prevented.
            </div>
            <div>
              <strong className="text-foreground">Original Repository Protection:</strong> The primary upstream repository is completely detached from local runtime processes. All operations execute strictly within the development workspace copy.
            </div>
            <div>
              <strong className="text-foreground">Locked Test Period Boundary:</strong> Data from 2025-01-01 onwards is strictly isolated as a locked test partition.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Staging Initialization Diagnostics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            {isLoading ? (
              <div className="text-muted-foreground">Checking staging dataset mounting diagnostics...</div>
            ) : data?.loading_errors && data.loading_errors.length > 0 ? (
              <div className="space-y-1">
                <div className="font-semibold text-danger">Dataset Loading Warnings:</div>
                <ul className="list-disc pl-4 text-danger space-y-1">
                  {data.loading_errors.map((err, idx) => (
                    <li key={idx} className="font-mono text-[11px]">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            ) : data ? (
              <div className="flex items-center gap-2 rounded border border-border bg-surface-muted p-3 text-teal">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Zero staging dataset loading errors detected; all registered data files mounted cleanly.
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground">Staging diagnostics unavailable.</div>
            )}
            <p className="pt-2 text-muted-foreground">
              SQLite WKB boundary parser cached in memory.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
