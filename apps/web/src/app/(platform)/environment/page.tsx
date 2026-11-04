"use client";

import { useEffect, useState } from "react";
import {
  CloudRain,
  Database,
  Droplets,
  Info,
  Layers,
  ShieldAlert,
  Waves,
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
  EnvironmentDetailResponse,
  fetchEnvironmentDetail,
  fetchRDHSList,
  RDHSSummaryItem,
} from "@/lib/api";

export default function EnvironmentPage() {
  const [rdhsList, setRdhsList] = useState<RDHSSummaryItem[]>([]);
  const [selectedRDHS, setSelectedRDHS] = useState<string>("Colombo");
  const [data, setData] = useState<EnvironmentDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load RDHS list once
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

  // Load environmental data for selected RDHS with cancel lifecycle
  useEffect(() => {
    if (!selectedRDHS) return;
    const controller = new AbortController();

    fetchEnvironmentDetail(selectedRDHS, controller.signal)
      .then((res) => {
        setData(res);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load environmental data");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedRDHS]);

  const handleSelectRDHS = (val: string) => {
    setError(null);
    setData(null);
    setIsLoading(true);
    setSelectedRDHS(val);
  };

  return (
    <div className="space-y-6">
      {/* Header with Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Environmental Intelligence
            </h1>
            <Badge variant="unverified">Experimental Staging</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            CHIRPS precipitation, ERA5-Land soil moisture, and Sentinel-1 SAR flood proxy features.
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="env-rdhs-select" className="text-xs text-muted-foreground">
            Health Area:
          </label>
          <select
            id="env-rdhs-select"
            value={selectedRDHS}
            onChange={(e) => handleSelectRDHS(e.target.value)}
            className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
          >
            {rdhsList.map((item) => (
              <option key={item.rdhs} value={item.rdhs}>
                {item.rdhs} {item.district ? `(${item.district})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Critical Caveats Banner */}
      <div className="rounded-md border border-amber/40 bg-surface-raised p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="font-semibold text-foreground">
              Environmental Data Operational Caveats
            </div>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Climate Reanalysis Notice:</strong>{" "}
              {data?.reanalysis_notice ||
                "ERA5-Land is a climate reanalysis dataset, not a real-time operational sensor telemetry feed."}
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">SAR Flood Proxy &amp; Attribution Notice:</strong>{" "}
              {data?.flood_proxy_notice ||
                "Experimental SAR flood proxy. Note that the optical cross-validation pixel F1 score (~0.19) applies to Sentinel-2 optical reference experiments and must not be attributed directly to Sentinel-1 SAR alone. Flood alone must never trigger Warning. Not a validated field-level flood observation."}
            </p>
          </div>
        </div>
      </div>

      {/* District Proxy Notice (Kalmunai or others) */}
      {data?.is_district_proxy && (
        <div className="rounded-md border border-cyan/30 bg-surface-raised p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-cyan-bright">
            <Info className="h-4 w-4" />
            <span>District Aggregation Proxy Note</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {data.proxy_notes ||
              `${data.rdhs} environmental features are derived from whole-district administrative rasters (${data.district} District), not an area-specific sub-district sensor network.`}
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Selected RDHS / District
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {data?.rdhs || selectedRDHS}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              District: {data?.district || "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Model Inputs As-Of Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="unverified">
              {data?.model_inputs_as_of_status || (isLoading ? "--" : "UNAVAILABLE_AT_ISSUE_TIME")}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              Issue-time verified:{" "}
              <span className="font-semibold text-danger">
                {data?.issue_time_availability_verified ? "True" : "False"}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              SAR Flood Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-amber">
              Strictly Constrained
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Flood alone must never trigger Warning tier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Sentinel-1 Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono text-cyan">
              {data?.flood_summary?.season || (isLoading ? "--" : "Unavailable")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest obs: {data?.flood_summary?.latest_date || (isLoading ? "--" : "Unavailable")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Sources and Sentinel-1 Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Environmental Data Sources
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Earth observation and reanalysis products ingested into staging features.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-3 text-xs">
              <li className="flex items-start gap-2">
                <CloudRain className="h-4 w-4 shrink-0 text-cyan mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">
                    CHIRPS Daily Rainfall
                  </div>
                  <div className="text-muted-foreground">
                    UCSB-CHG/CHIRPS/DAILY &mdash; 0.05° gridded satellite infrared with station calibration.
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Droplets className="h-4 w-4 shrink-0 text-teal mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">
                    ERA5-Land Root-Zone Soil Moisture
                  </div>
                  <div className="text-muted-foreground">
                    ECMWF/ERA5_LAND/DAILY_AGGR &mdash; Layer 1-3 volumetric soil water content (climate reanalysis).
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Waves className="h-4 w-4 shrink-0 text-amber mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">
                    Sentinel-1 SAR Surface Water Flood Proxy
                  </div>
                  <div className="text-muted-foreground">
                    LFR v1.0 &mdash; Synthetic Aperture Radar dual-pol backscatter flood detection proxy.
                  </div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-amber" />
              <CardTitle className="text-sm font-semibold">
                Sentinel-1 SAR Flood Proxy Summary
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Area-level surface water observation summary from staging dataset.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-border bg-surface-muted p-2.5">
                <div className="text-muted-foreground">Paddy Observations</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data?.flood_summary?.paddy_obs !== null && data?.flood_summary?.paddy_obs !== undefined
                    ? data.flood_summary.paddy_obs === 0
                      ? "0 (no detections)"
                      : data.flood_summary.paddy_obs
                    : "Unavailable"}
                </div>
              </div>
              <div className="rounded border border-border bg-surface-muted p-2.5">
                <div className="text-muted-foreground">Land Observations</div>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {data?.flood_summary?.land_obs !== null && data?.flood_summary?.land_obs !== undefined
                    ? data.flood_summary.land_obs === 0
                      ? "0 (no detections)"
                      : data.flood_summary.land_obs
                    : "Unavailable"}
                </div>
              </div>
            </div>
            <div className="rounded border border-border bg-surface-muted p-2.5">
              <div className="text-muted-foreground">Detector Safety Rule:</div>
              <div className="text-foreground font-mono mt-0.5 text-[11px]">
                {data?.flood_summary?.rule ||
                  "Flood proxy condition requires concurrent epidemiological or rainfall trigger; cannot upgrade to Warning independently."}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Lag Features Matrix */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan" />
            <CardTitle className="text-base font-semibold">
              Model Lag Predictors (Latest Feature Vector)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Precipitation lags (rain_l0..rain_l11), soil moisture lags (soil_l0..soil_l7), and SAR flood flags (pflood_l0..pflood_l4).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading environmental lag features...
            </div>
          ) : error ? (
            <div className="py-6 text-center text-xs text-danger">{error}</div>
          ) : data && Object.keys(data.latest_lag_features).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(data.latest_lag_features).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded border border-border bg-surface-raised p-2 text-center"
                >
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {key}
                  </div>
                  <div className="text-sm font-bold font-mono text-cyan-bright mt-0.5">
                    {val !== null && val !== undefined ? Number(val).toFixed(2) : "Unavailable"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No lag features recorded for {selectedRDHS} in the staging feature store.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical 2023 Environmental Series */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Rainfall Series */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-cyan" />
              <CardTitle className="text-sm font-semibold">
                Historical CHIRPS Rainfall (2023 Weekly Series)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Total weekly rainfall in millimeters for {selectedRDHS}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data?.rainfall_series_2023 && data.rainfall_series_2023.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week Start</TableHead>
                      <TableHead className="text-right">Rainfall (mm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rainfall_series_2023.map((pt) => (
                      <TableRow key={pt.week_start}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pt.week_start}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-cyan-bright text-xs">
                          {pt.rainfall_mm.toFixed(1)} mm
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No 2023 weekly rainfall series available in staging dataset.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Soil Moisture Series */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-teal" />
              <CardTitle className="text-sm font-semibold">
                Historical ERA5-Land Soil Moisture (2023 Weekly Series)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Volumetric soil moisture fraction (m³/m³) for {selectedRDHS}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data?.soil_moisture_series_2023 && data.soil_moisture_series_2023.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week Start</TableHead>
                      <TableHead className="text-right">Volumetric Fraction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.soil_moisture_series_2023.map((pt) => (
                      <TableRow key={pt.week_start}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pt.week_start}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-teal text-xs">
                          {pt.volumetric_fraction.toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No 2023 weekly soil moisture series available in staging dataset.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
