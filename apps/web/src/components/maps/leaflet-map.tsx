"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";

import { GeoRDHSFeature, GeoRDHSProperties, GeoRDHSResponse } from "@/lib/api";

interface LeafletMapProps {
  geoData: GeoRDHSResponse;
  selectedRDHS: string | null;
  onSelectRDHS: (rdhsName: string | null) => void;
  resetTrigger?: number;
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
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedRDHSRef = useRef<string | null>(selectedRDHS);
  const onSelectRDHSRef = useRef(onSelectRDHS);

  // Synchronize refs in effect, never during render
  useEffect(() => {
    selectedRDHSRef.current = selectedRDHS;
  }, [selectedRDHS]);

  useEffect(() => {
    onSelectRDHSRef.current = onSelectRDHS;
  }, [onSelectRDHS]);

  // Style function for RDHS polygons based on actual tier and selection state
  const getFeatureStyle = (feature?: GeoRDHSFeature): L.PathOptions => {
    if (!feature) {
      return {
        color: "#0891b2",
        weight: 1.5,
        fillColor: "#0b1628",
        fillOpacity: 0.5,
      };
    }

    const rdhsName = feature.properties.rdhs;
    const isSelected = selectedRDHSRef.current === rdhsName;

    if (isSelected) {
      return {
        color: "#f59e0b", // Amber accent outline for selected area
        weight: 3,
        fillColor: "#f59e0b",
        fillOpacity: 0.35,
      };
    }

    const tier = (feature.properties.tier || "").toLowerCase().trim();
    let strokeColor = "#06b6d4"; // Default cyan
    let fillColor = "#0a192f";

    if (tier === "warning") {
      strokeColor = "#ef4444";
      fillColor = "#450a0a";
    } else if (tier === "advisory") {
      strokeColor = "#f59e0b";
      fillColor = "#451a03";
    } else if (tier === "watch") {
      strokeColor = "#06b6d4";
      fillColor = "#0a192f";
    }

    return {
      color: strokeColor,
      weight: 1.5,
      fillColor: fillColor,
      fillOpacity: 0.45,
    };
  };

  // Safe DOM Tooltip Construction (prevents HTML injection vulnerabilities)
  const createSafeTooltipNode = (props: GeoRDHSProperties): HTMLElement => {
    const container = document.createElement("div");
    container.style.fontFamily = "inherit";
    container.style.fontSize = "12px";
    container.style.color = "#f8fafc";
    container.style.padding = "2px";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.style.color = "#22d3ee";
    title.style.marginBottom = "2px";
    title.textContent = `${props.rdhs} RDHS`;
    container.appendChild(title);

    const district = document.createElement("div");
    district.style.fontSize = "11px";
    district.style.color = "#94a3b8";
    district.textContent = `District: ${props.district || "Unknown"}`;
    container.appendChild(district);

    if (props.tier) {
      const tier = document.createElement("div");
      tier.style.fontSize = "11px";
      tier.style.marginTop = "2px";
      tier.style.color = "#f59e0b";
      tier.textContent = `Provisional Tier: ${props.tier}`;
      container.appendChild(tier);
    }

    if (props.is_district_proxy) {
      const proxy = document.createElement("div");
      proxy.style.fontSize = "10px";
      proxy.style.color = "#38bdf8";
      proxy.style.marginTop = "2px";
      proxy.textContent = "Whole-district proxy";
      container.appendChild(proxy);
    }

    return container;
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

    // Reliable dark canvas tile layer: Esri World Dark Gray Base (watermark-free)
    const tileLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution:
          'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
      }
    );

    tileLayer.on("tileerror", () => {
      if (mapContainerRef.current) {
        mapContainerRef.current.style.backgroundColor = "#050b18";
      }
    });

    tileLayer.addTo(map);
    map.fitBounds(SRI_LANKA_BOUNDS);

    // Register map background click handler ONCE with proper cleanup
    const handleMapBackgroundClick = () => {
      onSelectRDHSRef.current(null);
    };
    map.on("click", handleMapBackgroundClick);

    mapInstanceRef.current = map;

    return () => {
      map.off("click", handleMapBackgroundClick);
      map.remove();
      mapInstanceRef.current = null;
      geoJsonLayerRef.current = null;
    };
  }, []);

  // Update GeoJSON Layer when geoData changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoData || !geoData.features) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    const geoJsonObject = geoData as unknown as GeoJsonObject;
    const layer = L.geoJSON(geoJsonObject, {
      style: (feat) => getFeatureStyle(feat as unknown as GeoRDHSFeature),
      onEachFeature: (feature: Feature, polyLayer: L.Layer) => {
        const props = (feature.properties || {}) as unknown as GeoRDHSProperties;
        if (!props || !props.rdhs) return;

        // Safe DOM Tooltip
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
                weight: 2.5,
                fillColor: "#0284c7",
                fillOpacity: 0.55,
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
                const targetPath = e.target as L.Path & { getBounds: () => L.LatLngBounds };
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
  }, [geoData]);

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
    <div
      ref={mapContainerRef}
      className="relative h-full min-h-[460px] w-full overflow-hidden rounded-md bg-[#050b18]"
      style={{ zIndex: 1 }}
    />
  );
}
