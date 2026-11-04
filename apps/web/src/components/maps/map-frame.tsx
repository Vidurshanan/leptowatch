"use client";

import dynamic from "next/dynamic";
import { RotateCcw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GeoRDHSResponse } from "@/lib/api";

// Dynamically import LeafletMap with SSR disabled
const DynamicLeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="panel-grid relative flex h-[500px] w-full items-center justify-center rounded-md border border-border">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Loading Sri Lanka RDHS GeoPackage boundaries...
          </p>
        </div>
      </div>
    ),
  }
);

interface MapFrameProps {
  title?: string;
  geoData?: GeoRDHSResponse | null;
  selectedRDHS?: string | null;
  onSelectRDHS?: (rdhsName: string | null) => void;
  onResetView?: () => void;
  onRetry?: () => void;
  resetTrigger?: number;
  isLoading?: boolean;
  error?: string | null;
}

export function MapFrame({
  title = "Geographic Surveillance Map",
  geoData = null,
  selectedRDHS = null,
  onSelectRDHS = () => {},
  onResetView = () => {},
  onRetry,
  resetTrigger = 0,
  isLoading = false,
  error = null,
}: MapFrameProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-2 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <Badge variant="unverified">Provisional</Badge>
          </div>
          <CardDescription className="mt-0.5 text-xs text-muted-foreground">
            Click any of the 26 RDHS health areas to inspect local staging indicators.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {selectedRDHS && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetView}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-cyan" />
              Reset National View
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="relative flex-1 overflow-hidden rounded-md border border-border">
          {isLoading && (
            <div className="panel-grid absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  Fetching geographic boundaries...
                </p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="panel-grid flex h-[500px] items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <ShieldAlert className="mx-auto h-10 w-10 text-danger" />
                <p className="mt-3 font-semibold text-foreground">
                  Failed to load geographic dataset
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                {onRetry ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="mt-4 text-xs"
                  >
                    Retry Loading Boundaries
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResetView}
                    className="mt-4 text-xs"
                  >
                    Reset National View
                  </Button>
                )}
              </div>
            </div>
          )}

          {!isLoading && !error && geoData && (
            <DynamicLeafletMap
              geoData={geoData}
              selectedRDHS={selectedRDHS}
              onSelectRDHS={onSelectRDHS}
              resetTrigger={resetTrigger}
            />
          )}

          {!isLoading && !error && !geoData && (
            <div className="panel-grid relative flex h-[500px] items-center justify-center overflow-hidden rounded-md border border-border">
              <div className="absolute inset-6 rounded-md border border-cyan/20" />
              <div className="relative text-center">
                <p className="font-mono text-xs tracking-[0.2em] text-cyan">
                  SRI LANKA · 26 RDHS
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Staging RDHS boundaries unavailable or not loaded.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mandatory Safeguard: Persistent provisional boundary warning banner */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-amber">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
          <div>
            <span className="font-semibold uppercase tracking-wider">
              PROVISIONAL RDHS BOUNDARY VISUALIZATION
            </span>
            <span className="ml-1 text-amber/90">
              — Spatial overlap validation remains unresolved. Unverified
              boundaries must not be claimed as officially validated.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
