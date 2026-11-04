"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BarChart3,
  Cpu,
  Lock,
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
  fetchModelPerformance,
  ModelMetric,
  ModelPerformanceResponse,
} from "@/lib/api";

export default function ModelPerformancePage() {
  const [data, setData] = useState<ModelPerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchModelPerformance(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load model performance");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const primaryModel: ModelMetric | undefined =
    data?.models?.find((m) => m.rank === 1) || data?.models?.[0];

  const sampleCountDisplay =
    primaryModel && typeof primaryModel.n_samples === "number"
      ? primaryModel.n_samples.toLocaleString()
      : isLoading
        ? "--"
        : "Unavailable";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Model Architecture &amp; Empirical Validation
              </h1>
              <Badge variant="unverified">Experimental Staging</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Historical out-of-fold cross-validation reliability scorecard across candidate models and primary ensemble.
            </p>
          </div>
        </div>
      </div>

      {/* Locked Test Holdout Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                Locked Test Boundary: {data?.locked_test_boundary || "2025-01-01"}
              </span>
              <Badge variant="staging">Locked Holdout</Badge>
            </div>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Status:</strong>{" "}
              {data?.locked_test_status ||
                "NOT_EVALUATED — Locked test data was not accessed."}
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Scope:</strong>{" "}
              {data?.evaluation_scope ||
                "Historical Out-of-Fold (OOF) cross-validation on pre-2025 training panel."}
              {" "}All metrics below reflect cross-validated performance prior to the 2025 boundary. The held-out operational test partition remains strictly unaccessed.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Primary Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-bright">
              {isLoading
                ? "--"
                : primaryModel
                  ? primaryModel.model_name
                  : "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {primaryModel
                ? `Scorecard Rank #${primaryModel.rank}`
                : "No ranked models in staging scorecard"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              OOF Validation Samples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground">
              {sampleCountDisplay}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-2025 panel cross-validation
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
            <div className="text-xl font-bold text-danger">
              {data?.operational_approval ? "TRUE" : "FALSE"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.model_status || "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              R² Provenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="muted">Not Reported</Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              OOF source scorecard omits R²
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scorecard Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold">
            Out-of-Fold Model Performance Reliability Scorecard
          </CardTitle>
          <CardDescription className="text-xs">
            Empirical evaluation metrics from verified staging scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading model performance scorecard...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-danger">{error}</div>
          ) : data && data.models && data.models.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Model Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Samples (n)</TableHead>
                    <TableHead className="text-right">MAE</TableHead>
                    <TableHead className="text-right">RMSE</TableHead>
                    <TableHead className="text-right">WAPE</TableHead>
                    <TableHead className="text-right">Bias</TableHead>
                    <TableHead className="text-center">R² Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.models.map((m: ModelMetric) => (
                    <TableRow
                      key={m.code}
                      className={m.rank === 1 ? "bg-cyan/5" : undefined}
                    >
                      <TableCell className="font-mono text-xs">
                        {m.rank === 1 ? (
                          <span className="flex items-center gap-1 font-bold text-cyan-bright">
                            <Award className="h-3.5 w-3.5 text-cyan" /> #{m.rank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">#{m.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {m.model_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.code}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {typeof m.n_samples === "number" ? m.n_samples.toLocaleString() : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                        {typeof m.mae === "number" ? m.mae.toFixed(3) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                        {typeof m.rmse === "number" ? m.rmse.toFixed(3) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.wape !== null && m.wape !== undefined ? `${(m.wape * 100).toFixed(1)}%` : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.bias !== null && m.bias !== undefined ? m.bias.toFixed(3) : "--"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="muted" className="text-[10px]">
                          {m.r2 !== null && m.r2 !== undefined
                            ? m.r2.toFixed(3)
                            : m.r2_status || "Not reported in scorecard"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No model scorecard records available in staging repository.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Calibration & Architecture Methodology Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Probability Calibration Diagnostics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong className="text-foreground">Calibration Report Summary:</strong>{" "}
              {data?.calibration_summary ||
                "Calibration summary unavailable in staging record."}
            </p>
            <p>
              Probability predictions (pE, pH) reflect empirical thresholds from staging validation folds.
              Because empirical disease surges exhibit heavy-tailed distributions, conservative decision bounds are evaluated.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber" />
              <CardTitle className="text-sm font-semibold">
                Model Governance &amp; Test Isolation
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong className="text-foreground">Holdout Isolation Safeguard:</strong> The locked holdout dataset spanning 2025 onwards remains completely untouched during all exploratory and development iterations.
            </p>
            <p>
              Automated pipelines reject any code paths that attempt evaluation against or model parameter optimization on dates on or after 2025-01-01.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
