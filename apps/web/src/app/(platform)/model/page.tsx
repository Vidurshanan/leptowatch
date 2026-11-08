"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  Lock,
  FileCheck,
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
  ChartCard,
  ModelComparisonChart,
} from "@/components/charts";
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
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Model Architecture &amp; Empirical Validation Scorecard
              </h1>
              <Badge variant="unverified">Experimental Staging</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Historical out-of-fold (OOF) cross-validation reliability scorecard across candidate models (B0, B1, B2, Detector A, Detector B) and primary ensemble blend.
            </p>
          </div>
        </div>
      </div>

      {/* Locked Test Holdout Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
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
              {" "}All metrics reflect cross-validated performance prior to the 2025 boundary. The held-out operational test partition remains strictly unaccessed.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Primary Ensemble Model
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

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
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

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Operational Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-rose-500">
              {data?.operational_approval ? "TRUE" : "FALSE"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {data?.model_status || "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              R² Metric Reporting
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

      {/* Primary Visualization: Model Comparison Chart */}
      <ChartCard
        title="Candidate Model Error Comparison (OOF Cross-Validation)"
        subtitle="Empirical comparison of Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE) across candidate baselines and ensemble blend."
        badge={<Badge variant="staging">OOF Benchmark</Badge>}
        footnote="Models ranked by validation loss. Blend achieves lowest overall MAE across historical out-of-fold evaluations."
        isLoading={isLoading}
        error={error}
        isEmpty={!data?.models || data.models.length === 0}
      >
        {data?.models && (
          <ModelComparisonChart models={data.models} height={290} />
        )}
      </ChartCard>

      {/* Scorecard Table */}
      <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
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
            <div className="py-8 text-center text-sm text-rose-400">{error}</div>
          ) : data && data.models ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Model Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">MAE</TableHead>
                    <TableHead className="text-right">RMSE</TableHead>
                    <TableHead className="text-right">R²</TableHead>
                    <TableHead className="text-right">WAPE</TableHead>
                    <TableHead className="text-right">Bias</TableHead>
                    <TableHead className="text-right">Samples</TableHead>
                    <TableHead>Source Dataset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.models.map((m: ModelMetric) => (
                    <TableRow key={m.model_name} className="hover:bg-surface-raised/60">
                      <TableCell className="font-mono text-xs font-bold text-cyan">
                        #{m.rank}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {m.model_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.code}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-cyan-bright">
                        {m.mae.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-400">
                        {m.rmse.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.r2 !== null && m.r2 !== undefined
                          ? m.r2.toFixed(3)
                          : <span className="text-slate-500 italic">Not Reported</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.wape !== null && m.wape !== undefined
                          ? `${(m.wape * 100).toFixed(1)}%`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.bias !== null && m.bias !== undefined
                          ? m.bias.toFixed(2)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {m.n_samples.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.source_dataset}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Model Calibration Summary Card */}
      {data?.calibration_summary && (
        <Card className="border-border/80 bg-surface shadow-[var(--shadow-panel)]">
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="size-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Calibration &amp; Reliability Protocol
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-3 text-xs leading-relaxed text-muted-foreground">
            <p>{data.calibration_summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
