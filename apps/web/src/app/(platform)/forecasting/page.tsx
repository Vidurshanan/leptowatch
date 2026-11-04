"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Info,
  LineChart,
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
import { fetchForecastsLatest, ForecastListResponse, ForecastRecord } from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function ForecastingPage() {
  const [data, setData] = useState<ForecastListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchForecastsLatest(controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load forecasts");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <LineChart className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-foreground">
                Forecasting Centre &mdash; Staging Candidate Outputs
              </h1>
              <Badge variant="unverified">Experimental Staging</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Ensemble Blend (Primary Model) point predictions, empirical
              intervals, and quantile distributions across 26 RDHS health areas.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Forecast Issue Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-cyan-bright">
              {isLoading ? "--" : data?.issue_start || "Unavailable"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.issue_start ? "Staging forecast issue week" : "Issue index unspecified in staging source"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Forecast Horizon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground">
              Unspecified
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Not declared in staging source
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Model Ensemble
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan">Blend Primary</div>
            <p className="mt-1 text-xs text-muted-foreground">
              LightGBM + NegBinomial + Baselines
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
            <div className="text-xl font-bold text-danger">FALSE</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Experimental research outputs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold">
            National Staging Forecast Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Point predictions (μ), empirical intervals [lo, hi], and quantile
            spreads [q0.05, q0.5, q0.95].
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading forecast records...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-danger">{error}</div>
          ) : data && data.records ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RDHS Area</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Data Quality</TableHead>
                    <TableHead className="text-right">Predicted (μ)</TableHead>
                    <TableHead className="text-right">Interval [lo, hi]</TableHead>
                    <TableHead className="text-right">Quantiles [q0.05, q0.5, q0.95]</TableHead>
                    <TableHead className="text-right">pE</TableHead>
                    <TableHead className="text-right">pH</TableHead>
                    <TableHead>Staging Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((rec: ForecastRecord) => (
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
                          {rec.data_quality_status || "UNVERIFIED"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-cyan-bright">
                        {rec.predicted_value !== null && rec.predicted_value !== undefined
                          ? rec.predicted_value.toFixed(1)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground">
                        {rec.interval
                          ? `[${rec.interval.lo.toFixed(1)}, ${rec.interval.hi.toFixed(1)}]`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {rec.quantiles
                          ? `${rec.quantiles.q0_05.toFixed(1)} / ${rec.quantiles.q0_5.toFixed(1)} / ${rec.quantiles.q0_95.toFixed(1)}`
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {rec.pE !== null && rec.pE !== undefined ? rec.pE.toFixed(3) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {rec.pH !== null && rec.pH !== undefined ? rec.pH.toFixed(3) : "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="truncate block max-w-[180px]">
                          {rec.staging_status || "--"}
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

      {/* Safety & Methodology Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber" />
              <CardTitle className="text-sm font-semibold">
                Interval &amp; Quantile Interpretation
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong className="text-foreground">Prediction Intervals are not Confidence Intervals:</strong>{" "}
              The intervals [lo, hi] represent empirical bounds generated by
              quantile regression, capturing predictive dispersion rather than
              parameter estimation certainty.
            </p>
            <p>
              Quantiles satisfy monotonicity ordering (q0.05 &le; q0.50 &le; q0.95)
              verified across all 26 RDHS rows in staging tests.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Locked Test Isolation
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <strong className="text-foreground">Test Period Boundary: 2025-01-01</strong>
            </p>
            <p>
              All displayed predictions and validation performance statistics
              originate from pre-2025 training panel cross-validation.
              The locked holdout evaluation has not been conducted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
