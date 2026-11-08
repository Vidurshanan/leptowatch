"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";

import { GeoRDHSFeature, GeoRDHSProperties, GeoRDHSResponse } from "@/lib/api";

// 26 RDHS Representative Geographic Coordinates [lat, lng]
export const RDHS_CENTROIDS: Record<string, [number, number]> = {
  Colombo: [6.9271, 79.8612],
  Gampaha: [7.0917, 79.9999],
  Kalutara: [6.5854, 79.9607],
  Kandy: [7.2906, 80.6337],
  Matale: [7.4675, 80.6234],
  "Nuwara Eliya": [6.9497, 80.7891],
  Galle: [6.0535, 80.2210],
  Hambantota: [6.1248, 81.1185],
  Matara: [5.9549, 80.5550],
  Jaffna: [9.6615, 80.0255],
  Kilinochchi: [9.3803, 80.3770],
  Mannar: [8.9810, 79.9044],
  Vavuniya: [8.7514, 80.4971],
  Mullaitivu: [9.2671, 80.8142],
  Batticaloa: [7.7102, 81.6924],
  Ampara: [7.2912, 81.6724],
  Trincomalee: [8.5874, 81.2152],
  Kurunegala: [7.4863, 80.3623],
  Puttalam: [8.0362, 79.8283],
  Anuradhapura: [8.3114, 80.4037],
  Polonnaruwa: [7.9403, 81.0188],
  Badulla: [6.9934, 81.0550],
  Monaragala: [6.8728, 81.3507],
  Ratnapura: [6.6828, 80.4000],
  Kegalle: [7.2513, 80.3464],
  Kalmunai: [7.4167, 81.8333],
};

// Verified Pre-2025 Historical Elevated Risk Signals (Out-of-fold evaluation records)
// These represent retrospective benchmark signals from historical validation, NOT current outbreaks.
export interface HistoricalSignal {
  rdhs: string;
  year: number;
  week: string;
  source: string;
  pE: number;
  actual_cases: number;
}

export const HISTORICAL_BENCHMARK_SIGNALS: HistoricalSignal[] = [
  {
    rdhs: "Kurunegala",
    year: 2024,
    week: "2024-W20",
    source: "Pre-2025 OOF Benchmark (y35 blend)",
    pE: 0.82,
    actual_cases: 19,
  },
  {
    rdhs: "Ratnapura",
    year: 2024,
    week: "2024-W22",
    source: "Pre-2025 OOF Benchmark (y35 blend)",
    pE: 0.79,
    actual_cases: 24,
  },
  {
    rdhs: "Colombo",
    year: 2024,
    week: "2024-W24",
    source: "Pre-2025 OOF Benchmark (y35 blend)",
    pE: 0.74,
    actual_cases: 18,
  },
  {
    rdhs: "Kalutara",
    year: 2023,
    week: "2023-W48",
    source: "Pre-2025 OOF Benchmark (y35 blend)",
    pE: 0.71,
    actual_cases: 15,
  },
  {
    rdhs: "Gampaha",
    year: 2024,
    week: "2024-W18",
    source: "Pre-2025 OOF Benchmark (y35 blend)",
    pE: 0.68,
    actual_cases: 16,
  },
];

interface LeafletMapProps {
  geoData: GeoRDHSResponse;
  selectedRDHS: string | null;
  onSelectRDHS: (rdhsName: string | null) => void;
  resetTrigger?: number;
  activeLayers?: {
    boundaries: boolean;
    activeStatus: boolean;
    historicalSignals: boolean;
    environmental: boolean;
    verification: boolean;
  };
}

// Sri Lanka National Bounding Box
const SRI_LANKA_BOUNDS: L.LatLngBoundsExpression = [
  [5.9, 79.5],
  [9.9, 81.9],
];

export function LeafletMap({
  geoData,
  selectedRDHS,
  onSelectRDHS,
  resetTrigger = 0,
  activeLayers = {
    boundaries: true,
    activeStatus: true,
    historicalSignals: false,
    environmental: false,
    verification: false,
  },
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const statusMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const historicalSignalsGroupRef = useRef<L.LayerGroup | null>(null);
  const environmentalGroupRef = useRef<L.LayerGroup | null>(null);

  const selectedRDHSRef = useRef<string | null>(selectedRDHS);
  const onSelectRDHSRef = useRef(onSelectRDHS);
  const activeLayersRef = useRef(activeLayers);

  // Synchronize refs
  useEffect(() => {
    selectedRDHSRef.current = selectedRDHS;
  }, [selectedRDHS]);

  useEffect(() => {
    onSelectRDHSRef.current = onSelectRDHS;
  }, [onSelectRDHS]);

  useEffect(() => {
    activeLayersRef.current = activeLayers;
  }, [activeLayers]);

  // Style function for RDHS boundaries: natural green terrain overlay with thin muted green borders
  const getFeatureStyle = (feature?: GeoRDHSFeature): L.PathOptions => {
    if (!feature) {
      return {
        color: "#10B981",
        weight: 1.2,
        fillColor: "#052e16",
        fillOpacity: 0.12,
      };
    }

    const rdhsName = feature.properties.rdhs;
    const isSelected = selectedRDHSRef.current === rdhsName;

    if (isSelected) {
      return {
        color: "#00C8E8", // Bright cyan outline for selected RDHS
        weight: 3.5,
        fillColor: "#00C8E8",
        fillOpacity: 0.28,
      };
    }

    // When verification layer is active, highlight candidate status
    if (activeLayersRef.current.verification) {
      return {
        color: "#10B981",
        weight: 1.2,
        fillColor: "#0B1628",
        fillOpacity: 0.25,
      };
    }

    // Default: thin muted green boundary lines over natural satellite terrain
    return {
      color: "#10B981", // Muted emerald green boundary
      weight: 1.2,
      fillColor: "#042F2E", // Very dark translucent forest green
      fillOpacity: 0.15,
    };
  };

  // Safe DOM Tooltip Construction
  const createSafeTooltipNode = (props: GeoRDHSProperties): HTMLElement => {
    const container = document.createElement("div");
    container.style.fontFamily = "inherit";
    container.style.fontSize = "12px";
    container.style.color = "#f8fafc";
    container.style.padding = "4px 8px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.gap = "8px";
    header.style.marginBottom = "3px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.color = "#00C8E8";
    title.textContent = `${props.rdhs} RDHS`;
    header.appendChild(title);

    const badge = document.createElement("span");
    badge.style.fontSize = "9px";
    badge.style.fontWeight = "600";
    badge.style.padding = "1px 5px";
    badge.style.borderRadius = "3px";
    badge.style.backgroundColor = "#F59E0B20";
    badge.style.color = "#F59E0B";
    badge.style.border = "1px solid #F59E0B40";
    badge.textContent = "WATCH (UNVERIFIED)";
    header.appendChild(badge);

    container.appendChild(header);

    const district = document.createElement("div");
    district.style.fontSize = "11px";
    district.style.color = "#94a3b8";
    district.textContent = `Administrative District: ${props.district || "Unknown"}`;
    container.appendChild(district);

    if (props.pE !== null && props.pE !== undefined) {
      const pe = document.createElement("div");
      pe.style.fontSize = "10px";
      pe.style.color = "#22d3ee";
      pe.style.fontFamily = "monospace";
      pe.style.marginTop = "2px";
      pe.textContent = `Historical Exceedance Risk (pE): ${(props.pE * 100).toFixed(1)}%`;
      container.appendChild(pe);
    }

    if (props.is_district_proxy) {
      const proxy = document.createElement("div");
      proxy.style.fontSize = "10px";
      proxy.style.color = "#38bdf8";
      proxy.style.marginTop = "3px";
      proxy.style.borderTop = "1px solid #1e293b";
      proxy.style.paddingTop = "2px";
      proxy.textContent = "Whole-district proxy (Kalmunai in Ampara)";
      container.appendChild(proxy);
    }

    return container;
  };

  // Safe DOM Tooltip for Historical Signals
  const createHistoricalSignalTooltip = (sig: HistoricalSignal): HTMLElement => {
    const el = document.createElement("div");
    el.style.fontSize = "11px";
    el.style.color = "#f8fafc";
    el.style.padding = "4px 6px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.color = "#EF4444";
    title.textContent = `Historical Signal: ${sig.rdhs} (${sig.week})`;
    el.appendChild(title);

    const note = document.createElement("div");
    note.style.fontSize = "10px";
    note.style.color = "#94a3b8";
    note.style.marginTop = "2px";
    note.textContent = `${sig.source} · Actual Cases: ${sig.actual_cases} · pE: ${(sig.pE * 100).toFixed(0)}%`;
    el.appendChild(note);

    const caveat = document.createElement("div");
    caveat.style.fontSize = "9px";
    caveat.style.color = "#EF4444";
    caveat.style.marginTop = "2px";
    caveat.style.fontWeight = "600";
    caveat.textContent = "Historical Benchmark Only — Not a Current Outbreak";
    el.appendChild(caveat);

    return el;
  };

  // Initialize Map (runs once)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [7.8731, 80.7718],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    // 1. Natural Green Satellite & Terrain Tile Layer: Esri World Imagery
    // Provides realistic vegetation, green topography, natural ground textures, and deep navy ocean.
    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution:
          'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a> &middot; Maxar, Earthstar Geographics',
      }
    );

    satelliteLayer.on("tileerror", () => {
      if (mapContainerRef.current) {
        mapContainerRef.current.style.backgroundColor = "#050b18";
      }
    });
    satelliteLayer.addTo(map);

    // 2. Subtle Reference Places and Boundaries Overlay (clean subtle white/grey labels)
    const referenceLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        opacity: 0.55,
        pane: "overlayPane",
      }
    );
    referenceLayer.addTo(map);

    map.fitBounds(SRI_LANKA_BOUNDS);

    // Single background click handler
    const handleMapBackgroundClick = () => {
      onSelectRDHSRef.current(null);
    };
    map.on("click", handleMapBackgroundClick);

    // Create Layer Groups
    const statusGroup = L.layerGroup().addTo(map);
    statusMarkersGroupRef.current = statusGroup;

    const histGroup = L.layerGroup().addTo(map);
    historicalSignalsGroupRef.current = histGroup;

    const envGroup = L.layerGroup().addTo(map);
    environmentalGroupRef.current = envGroup;

    mapInstanceRef.current = map;

    return () => {
      map.off("click", handleMapBackgroundClick);
      map.remove();
      mapInstanceRef.current = null;
      geoJsonLayerRef.current = null;
      statusMarkersGroupRef.current = null;
      historicalSignalsGroupRef.current = null;
      environmentalGroupRef.current = null;
    };
  }, []);

  // Update GeoJSON Boundaries and Markers Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoData || !geoData.features) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }
    if (statusMarkersGroupRef.current) {
      statusMarkersGroupRef.current.clearLayers();
    }
    if (historicalSignalsGroupRef.current) {
      historicalSignalsGroupRef.current.clearLayers();
    }
    if (environmentalGroupRef.current) {
      environmentalGroupRef.current.clearLayers();
    }

    // 1. Render RDHS Boundary Polygons
    if (activeLayers.boundaries) {
      const geoJsonObject = geoData as unknown as GeoJsonObject;
      const layer = L.geoJSON(geoJsonObject, {
        style: (feat) => getFeatureStyle(feat as unknown as GeoRDHSFeature),
        onEachFeature: (feature: Feature, polyLayer: L.Layer) => {
          const props = (feature.properties || {}) as unknown as GeoRDHSProperties;
          if (!props || !props.rdhs) return;

          const tooltipNode = createSafeTooltipNode(props);
          polyLayer.bindTooltip(tooltipNode, {
            sticky: true,
            direction: "top",
            className: "leaflet-dark-tooltip",
          });

          // Hover & Click Handlers
          polyLayer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const currentSelected = selectedRDHSRef.current;
              if (currentSelected !== props.rdhs) {
                const target = e.target as L.Path;
                target.setStyle({
                  color: "#22d3ee",
                  weight: 2.4,
                  fillColor: "#0284c7",
                  fillOpacity: 0.35,
                });
              }
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              const currentSelected = selectedRDHSRef.current;
              if (currentSelected !== props.rdhs) {
                const target = e.target as L.Path;
                target.setStyle(getFeatureStyle(feature as unknown as GeoRDHSFeature));
              }
            },
            click: (e: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e);
              const currentSelected = selectedRDHSRef.current;
              if (currentSelected === props.rdhs) {
                onSelectRDHSRef.current(null);
              } else {
                onSelectRDHSRef.current(props.rdhs);
                if ("getBounds" in e.target) {
                  const targetPath = e.target as L.Path & {
                    getBounds: () => L.LatLngBounds;
                  };
                  map.fitBounds(targetPath.getBounds(), {
                    padding: [40, 40],
                    maxZoom: 9,
                  });
                }
              }
            },
          });
        },
      });

      layer.addTo(map);
      geoJsonLayerRef.current = layer;
    }

    // 2. Render Historical Benchmark Signals (RED circular markers with explicit historical dates)
    if (activeLayers.historicalSignals && historicalSignalsGroupRef.current) {
      HISTORICAL_BENCHMARK_SIGNALS.forEach((sig) => {
        const coords = RDHS_CENTROIDS[sig.rdhs];
        if (!coords) return;

        // Red outer ring
        const outerHalo = L.circleMarker(coords, {
          radius: 14,
          fillColor: "#EF4444",
          fillOpacity: 0.3,
          color: "#EF4444",
          weight: 1.5,
          opacity: 0.8,
        });

        // Red inner core
        const innerCore = L.circleMarker(coords, {
          radius: 5,
          fillColor: "#EF4444",
          fillOpacity: 1,
          color: "#FFFFFF",
          weight: 1.5,
          opacity: 1,
        });

        const tooltip = createHistoricalSignalTooltip(sig);
        innerCore.bindTooltip(tooltip, { sticky: true, direction: "top" });
        outerHalo.bindTooltip(tooltip, { sticky: true, direction: "top" });

        historicalSignalsGroupRef.current?.addLayer(outerHalo);
        historicalSignalsGroupRef.current?.addLayer(innerCore);
      });
    }
  }, [geoData, activeLayers, selectedRDHS]);

  // Update styles when selection changes
  useEffect(() => {
    if (!geoJsonLayerRef.current) return;
    geoJsonLayerRef.current.eachLayer((layer: L.Layer) => {
      const pathLayer = layer as L.Path & { feature?: GeoRDHSFeature };
      if (pathLayer.feature && pathLayer.setStyle) {
        pathLayer.setStyle(getFeatureStyle(pathLayer.feature));
      }
    });
  }, [selectedRDHS]);

  // Handle national reset zoom
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.fitBounds(SRI_LANKA_BOUNDS);
  }, [resetTrigger]);

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-md bg-[#050B18]">
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        style={{ zIndex: 1 }}
      />

      {/* Floating Dark Map Legend & Layer Attribution */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-3 backdrop-blur-md shadow-2xl text-[11px] pointer-events-auto max-w-[280px]">
        <div className="font-semibold text-slate-100 border-b border-slate-700/60 pb-1.5 mb-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan animate-pulse" />
            Regional GIS Intelligence
          </span>
          <span className="text-[10px] font-mono text-cyan">26 RDHS</span>
        </div>

        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#00C8E8] border border-cyan/60 shrink-0" />
            <span className="text-slate-300">Selected RDHS Focus</span>
          </div>

          {activeLayers.historicalSignals && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <span className="size-2.5 rounded-full bg-[#EF4444] border border-red-500 shrink-0 animate-pulse" />
              <span className="text-rose-300 font-medium">
                Historical Benchmark Signals (Pre-2025, not live)
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="size-2.5 border border-[#10B981] bg-[#052e16]/60 shrink-0" />
            <span className="text-slate-300">RDHS Boundary (Provisional)</span>
          </div>
        </div>

        <div className="mt-2 text-[9px] text-slate-400 pt-1.5 border-t border-slate-800 space-y-0.5">
          <p>Terrain: Natural vegetation &amp; deep navy ocean</p>
          <p className="text-slate-500">Kalmunai: Whole-district proxy within Ampara</p>
        </div>
      </div>
    </div>
  );
}
