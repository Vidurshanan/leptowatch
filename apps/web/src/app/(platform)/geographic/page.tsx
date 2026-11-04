"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Info,
  MapPin,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapFrame } from "@/components/maps/map-frame";
import { fetchGeoRDHS, GeoRDHSFeature, GeoRDHSResponse } from "@/lib/api";
import { getTierBadgeVariant } from "@/lib/utils";

export default function GeographicIntelligencePage() {
  const [geoData, setGeoData] = useState<GeoRDHSResponse | null>(null);
  const [selectedRDHS, setSelectedRDHS] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Fetch 26-RDHS GeoPackage GeoJSON with AbortController
  useEffect(() => {
    const controller = new AbortController();

    fetchGeoRDHS(controller.signal)
      .then((data) => {
        setGeoData(data);
        setError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load RDHS boundaries");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [resetTrigger]);

  const handleReset = () => {
    setSelectedRDHS(null);
    setResetTrigger((prev) => prev + 1);
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setResetTrigger((prev) => prev + 1);
  };

  // Find selected feature properties
  const selectedFeature: GeoRDHSFeature | undefined = geoData?.features.find(
    (f) => String(f.id ?? f.properties.rdhs).toLowerCase() === selectedRDHS?.toLowerCase()
  );

  // Deterministic count aggregations from actual returned geoData features
  const totalCoverage = geoData?.count ?? (geoData?.features ? geoData.features.length : 0);
  const tierCounts: Record<string, number> = {
    Watch: 0,
    Advisory: 0,
    Warning: 0,
    Normal: 0,
  };
  let unverifiedCount = 0;

  if (geoData?.features) {
    for (const f of geoData.features) {
      const t = f.properties.tier || "Unspecified";
      if (t in tierCounts) {
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      } else {
        tierCounts[t] = 1;
      }

      const dq = (f.properties.data_quality_status || "").toUpperCase();
      if (dq === "UNVERIFIED" || dq === "") {
        unverifiedCount += 1;
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Platform Staging Disclaimer Banner */}
      <div className="rounded-md border border-cyan/30 bg-surface-raised p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Geographic Intelligence Workspace
                </h2>
                <Badge variant="unverified">Experimental Staging</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Interactive spatial visualization of all 26 RDHS health areas across Sri
                Lanka. Displays staging demonstration values derived from notebook
                38–40 data pipelines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-cyan" />
              Reset View
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Map (7 cols) + Right Info Panel (5 cols) */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Interactive Map */}
        <div className="lg:col-span-7 xl:col-span-8">
          <MapFrame
            title="Sri Lanka 26 RDHS Health Areas"
            geoData={geoData}
            selectedRDHS={selectedRDHS}
            onSelectRDHS={(rdhs) => setSelectedRDHS(rdhs)}
            onResetView={handleReset}
            onRetry={handleRetry}
            resetTrigger={resetTrigger}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Right Column: Geographic Detail & Surveillance Context */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          {/* Dynamic Selection Card or National Overview */}
          {selectedFeature ? (
            <Card className="border-cyan/40 bg-surface-raised">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan" />
                    <CardTitle className="text-base font-semibold">
                      {selectedFeature.properties.rdhs} RDHS
                    </CardTitle>
                  </div>
                  <Badge variant={getTierBadgeVariant(selectedFeature.properties.tier)}>
                    {selectedFeature.properties.tier || "Unknown"}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Administrative District: {selectedFeature.properties.district}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Kalmunai Whole-District Proxy Banner */}
                {selectedFeature.properties.is_district_proxy && (
                  <div className="rounded-md border border-cyan/40 bg-cyan/10 p-2.5 text-xs text-cyan-bright">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 text-cyan-bright" />
                      <span>Administrative Proxy Area:</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-cyan/90">
                      {selectedFeature.properties.proxy_notes ||
                        "Kalmunai is a distinct RDHS in Ampara district. District environmental indicators represent whole-district aggregates."}
                    </p>
                  </div>
                )}

                {/* Staging Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-amber/30 bg-amber/5 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-amber">
                      Data Quality
                    </span>
                    <p className="mt-1 text-base font-semibold text-amber">
                      {selectedFeature.properties.data_quality_status || "UNVERIFIED"}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background-deep p-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Elevated Prob (pE)
                    </span>
                    <p className="mt-1 font-mono text-sm font-medium text-foreground">
                      {selectedFeature.properties.pE !== null &&
                      selectedFeature.properties.pE !== undefined
                        ? selectedFeature.properties.pE.toFixed(3)
                        : "Unavailable"}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background-deep p-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      High Prob (pH)
                    </span>
                    <p className="mt-1 font-mono text-sm font-medium text-foreground">
                      {selectedFeature.properties.pH !== null &&
                      selectedFeature.properties.pH !== undefined
                        ? selectedFeature.properties.pH.toFixed(3)
                        : "Unavailable"}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background-deep p-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Predicted Cases (μ)
                    </span>
                    <p className="mt-1 font-mono text-sm font-bold text-cyan-bright">
                      {selectedFeature.properties.mu !== null &&
                      selectedFeature.properties.mu !== undefined
                        ? selectedFeature.properties.mu.toFixed(1)
                        : "Unavailable"}
                    </p>
                  </div>
                </div>

                {selectedFeature.properties.area_km2 && (
                  <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs flex justify-between">
                    <span className="text-muted-foreground">Geographic Area:</span>
                    <span className="font-mono text-foreground">
                      {selectedFeature.properties.area_km2.toLocaleString()} km²
                    </span>
                  </div>
                )}

                {/* Epidemiological separation note */}
                <div className="rounded-md border border-border/80 bg-background-deep p-3 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Provisional Classification Warning:
                  </p>
                  <p className="mt-1 leading-relaxed">
                    This tier is an internal model staging classification
                    under experimental review. It does not constitute an
                    official public-health advisory or verified disease
                    epidemic declaration.
                  </p>
                </div>

                {/* Link to Full Profile */}
                <div className="pt-1">
                  <Link href={`/rdhs?id=${encodeURIComponent(selectedFeature.properties.rdhs)}`}>
                    <Button variant="outline" className="w-full text-xs">
                      View Full {selectedFeature.properties.rdhs} Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-base font-semibold">
                  National Geographic Coverage
                </CardTitle>
                <CardDescription className="text-xs">
                  Summary counts derived from active staging boundary records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-cyan/30 bg-surface-muted p-3">
                    <span className="text-[10px] uppercase tracking-wider text-cyan">
                      RDHS Areas
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                      {isLoading ? "--" : totalCoverage}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Full coverage including Kalmunai
                    </span>
                  </div>

                  <div className="rounded-md border border-watch/30 bg-watch/5 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-watch">
                      Provisional Watch
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-watch">
                      {isLoading ? "--" : tierCounts["Watch"]}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Staging classification
                    </span>
                  </div>

                  <div className="rounded-md border border-amber/30 bg-amber/5 p-3">
                    <span className="text-[10px] uppercase tracking-wider text-amber">
                      Data Unverified
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-amber">
                      {isLoading ? "--" : unverifiedCount}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Input freshness gate
                    </span>
                  </div>

                  <div className="rounded-md border border-border bg-background-deep p-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Warning / Advisory
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                      {isLoading ? "--" : `${tierCounts["Warning"]} / ${tierCounts["Advisory"]}`}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      Active elevated tiers
                    </span>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-surface-muted p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Interactive Navigation Tip:
                  </p>
                  <p className="mt-1">
                    Click any health area polygon on the map to inspect its
                    specific model inputs, risk probabilities, and district proxies.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Boundaries Caveats Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber" />
                <CardTitle className="text-sm font-semibold">
                  GIS Boundary Validation Status
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Provisional Dissolved Polygons:</strong>{" "}
                RDHS health area boundaries are generated from 344 dissolved MOH
                administrative polygons. Authoritative gazetted RDHS polygons have
                not been published by the Ministry of Health.
              </p>
              <p>
                <strong className="text-foreground">Internal Freshness Gate:</strong>{" "}
                The 56-day surveillance freshness threshold is an internal
                project safety standard, not an official reporting-delay
                definition.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
