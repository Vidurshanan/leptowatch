"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { RainfallSeriesItem, SoilMoistureSeriesItem } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { TooltipPayloadItem } from "./custom-tooltip";

interface EnvironmentalChartProps {
  rainfallSeries: RainfallSeriesItem[];
  soilMoistureSeries: SoilMoistureSeriesItem[];
  height?: number;
}

interface CustomEnvTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomEnvTooltip({ active, payload, label }: CustomEnvTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const date = (payload[0]?.payload as Record<string, unknown> | undefined)?.date as string | undefined;
  return (
    <div className="rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-3 shadow-xl backdrop-blur-md text-xs">
      <p className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 mb-1.5">
        {label} {date ? `(${date})` : ""}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          if (entry.value === null || entry.value === undefined) return null;
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-mono font-semibold" style={{ color: entry.color }}>
                {entry.value} {entry.dataKey === "rainfall" ? "mm" : "% volumetric"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EnvironmentalChart({
  rainfallSeries,
  soilMoistureSeries,
  height = 300,
}: EnvironmentalChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Determine mode: dual, rainfall-only, soil-only
  const hasRain = rainfallSeries.length > 0;
  const hasSoil = soilMoistureSeries.length > 0;

  // Create lookup map of soil moisture by week_start
  const soilMap = new Map<string, number>();
  for (const s of soilMoistureSeries) {
    soilMap.set(s.week_start, s.volumetric_fraction);
  }

  let data: { week: string; date: string; rainfall: number | null; soilMoisture: number | null }[];

  if (hasRain) {
    // Build from rainfall series (may also include soil if dual mode)
    data = rainfallSeries.map((r, idx) => {
      const soilVal = soilMap.get(r.week_start);
      return {
        week: `W${idx + 1}`,
        date: r.week_start,
        rainfall: +r.rainfall_mm.toFixed(1),
        soilMoisture: soilVal !== undefined ? +(soilVal * 100).toFixed(1) : null,
      };
    });
  } else {
    // Soil-only mode: build from soil series
    data = soilMoistureSeries.map((s, idx) => ({
      week: `W${idx + 1}`,
      date: s.week_start,
      rainfall: null,
      soilMoisture: +(s.volumetric_fraction * 100).toFixed(1),
    }));
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="week"
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            interval={3}
          />
          {/* Left axis: rainfall (or soil if rainfall-only-off) */}
          <YAxis
            yAxisId="left"
            stroke={hasRain ? "#00C8E8" : "#10B981"}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit={hasRain ? " mm" : " %"}
          />
          {/* Right axis only needed in dual mode */}
          {hasRain && hasSoil && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#10B981"
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              unit=" %"
            />
          )}
          <Tooltip content={<CustomEnvTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
          />

          {/* Rainfall bars */}
          {hasRain && (
            <Bar
              yAxisId="left"
              dataKey="rainfall"
              name="CHIRPS Rainfall"
              fill="#00C8E8"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
            />
          )}

          {/* Soil moisture line */}
          {hasSoil && (
            <Line
              yAxisId={hasRain && hasSoil ? "right" : "left"}
              type="monotone"
              dataKey="soilMoisture"
              name="ERA5 Soil Moisture"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10B981" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
