"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
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
  fetchHistory,
  fetchRDHSDetail,
  fetchRDHSList,
  HistoryRecord,
  HistoryResponse,
  RDHSDetailResponse,
  RDHSSummaryItem,
} from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function RDHSProfilesPage() {
  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [selectedRDHS, setSelectedRDHS] = useState<string>("Colombo");
  const [detail, setDetail] = useState<RDHSDetailResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load RDHS list once with cancellation
  useEffect(() => {
    const controller = new AbortController();

    fetchRDHSList(controller.signal)
      .then((res) => {
        setRdhsList(res.records);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS list");
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Load detail and history whenever selectedRDHS changes with AbortController
  useEffect(() => {
    if (!selectedRDHS) return;
    const controller = new AbortController();

    Promise.all([
      fetchRDHSDetail(selectedRDHS, controller.signal),
      fetchHistory(selectedRDHS, 52, controller.signal),
    ])
      .then(([detailData, historyData]) => {
        setDetail(detailData);
        setHistory(historyData);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS profile");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedRDHS]);

  const handleSelectRDHS = (name: string) => {
    setError(null);
    setDetail(null);
    setHistory(null);
    setIsLoading(true);
    setSelectedRDHS(name);
  };

  return (
    <div className="space-y-6">
      {/* Header with Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            RDHS Health Area Profiles
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Detailed surveillance, case histories, and staging model metrics for
            all 26 health administrative areas.
          </p>
        </div>

        {/* Dropdown / Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="rdhs-select" className="text-xs text-muted-foreground">
            Select Area:
          </label>
          <select
            id="rdhs-select"
            value={selectedRDHS}
            onChange={(e) => handleSelectRDHS(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
          >
            {rdhsList.map((item) => (
              <option key={item.rdhs} value={item.rdhs}>
                {item.rdhs} ({item.district})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading profile for {selectedRDHS}...
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-danger">{error}</div>
      ) : detail ? (
        <div className="space-y-6">
          {/* Top Profile Card */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-cyan" />
                    <CardTitle className="text-lg font-bold">
                      {detail.rdhs} RDHS
                    </CardTitle>
                    <Badge variant={getTierBadgeVariant(detail.tier)}>
                      {detail.tier || "Unknown"}
                    </Badge>
                    <Badge variant="unverified">
                      {detail.data_quality_status || "UNVERIFIED"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1 text-xs text-muted-foreground">
                    Administrative District: {detail.district} &bull; Staging Issue
                    Week: {detail.issue_start || "Unavailable"}
                  </CardDescription>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Latest Accepted Case Week
                  </span>
                  <p className="font-mono text-sm font-semibold text-amber">
                    {detail.latest_accepted_case_week || "No accepted reports"}
                  </p>
                </div>
              </div>

              {/* Kalmunai Proxy Alert */}
              {detail.rdhs.toLowerCase() === "kalmunai" && (
                <div className="mt-3 rounded-md border border-cyan/30 bg-cyan/5 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-cyan-bright">
                    Whole-District Administrative Proxy Caveat:
                  </p>
                  <p className="mt-0.5 leading-relaxed">
                    Kalmunai is a distinct RDHS located inside Ampara district.
                    Environmental indicators (rainfall, soil moisture, flood)
                    derived from Ampara ADM2 district represent a whole-district proxy,
                    not an area-specific observation for Kalmunai RDHS.
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-4">
              {/* Metrics Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-background-deep p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Predicted Mean (μ)
                  </span>
                  <p className="mt-1 text-xl font-bold font-mono text-cyan-bright">
                    {detail.mu !== null && detail.mu !== undefined ? detail.mu.toFixed(1) : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Weekly case prediction</p>
                </div>

                <div className="rounded-md border border-border bg-background-deep p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Elevated / High Prob
                  </span>
                  <p className="mt-1 text-base font-semibold font-mono text-foreground">
                    pE: {detail.pE !== null && detail.pE !== undefined ? detail.pE.toFixed(3) : "--"} &bull; pH:{" "}
                    {detail.pH !== null && detail.pH !== undefined ? detail.pH.toFixed(3) : "--"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Provisional model outputs</p>
                </div>

                <div className="rounded-md border border-border bg-background-deep p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Prediction Interval [lo, hi]
                  </span>
                  <p className="mt-1 text-base font-semibold font-mono text-cyan">
                    {detail.interval
                      ? `[${detail.interval.lo.toFixed(1)}, ${detail.interval.hi.toFixed(1)}]`
                      : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Model interval bounds (not CI)
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background-deep p-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Data Freshness Age
                  </span>
                  <p className="mt-1 text-base font-semibold font-mono text-amber">
                    {detail.cases_age_days !== null && detail.cases_age_days !== undefined
                      ? `${detail.cases_age_days} days`
                      : "Unavailable"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Policy threshold: 56 days
                  </p>
                </div>
              </div>

              {/* Reasons & Diagnostics */}
              <div className="mt-4 rounded-md border border-border bg-surface-muted p-3 text-xs">
                <span className="font-semibold text-foreground">
                  Diagnostic Reasons &amp; Triggers:
                </span>
                <p className="mt-1 font-mono text-muted-foreground">
                  {detail.reasons || "No diagnostic triggers recorded for this health area."}
                </p>
                {detail.rule && (
                  <p className="mt-1 text-muted-foreground">
                    <strong className="text-foreground">Triggering Rule:</strong> {detail.rule}
                  </p>
                )}
                {detail.failures && (
                  <p className="mt-1 text-amber">
                    <strong className="text-foreground">Validation Failures:</strong> {detail.failures}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Historical Surveillance Table */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Historical Surveillance Returns (Past 52 Weeks)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Weekly cases reported by {detail.rdhs} RDHS unit. Unaccepted reports are preserved strictly as null.
                  </CardDescription>
                </div>
                {history?.summary && (
                  <div className="text-xs text-muted-foreground">
                    Accepted weeks:{" "}
                    <span className="font-semibold text-cyan">
                      {history.summary.accepted_weeks_count}
                    </span>{" "}
                    / {history.summary.total_weeks}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {history && history.records && history.records.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week Start</TableHead>
                        <TableHead>Epidemiological Week</TableHead>
                        <TableHead>Time Index (t)</TableHead>
                        <TableHead>Reporting Status</TableHead>
                        <TableHead className="text-right">Reported Cases</TableHead>
                        <TableHead className="text-right">Cumulative YTD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.records.map((rec: HistoryRecord) => (
                        <TableRow key={`${rec.year}-${rec.week}-${rec.t}`}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {rec.week_start}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {rec.year}-W{String(rec.week).padStart(2, "0")}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {rec.t}
                          </TableCell>
                          <TableCell>
                            {rec.status === "ok" ? (
                              <Badge variant="teal">
                                Accepted (ok)
                              </Badge>
                            ) : rec.status === "nonreporting" ? (
                              <Badge variant="unverified" className="text-amber">
                                Nonreporting
                              </Badge>
                            ) : (
                              <Badge variant="unverified">No Accepted Report</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {rec.cases !== null && rec.cases !== undefined ? (
                              <span className="text-foreground">{rec.cases}</span>
                            ) : (
                              <span className="text-muted-foreground italic">
                                null (unaccepted)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {rec.cases_ytd !== null && rec.cases_ytd !== undefined
                              ? rec.cases_ytd
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No historical surveillance records available for {detail.rdhs}.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
