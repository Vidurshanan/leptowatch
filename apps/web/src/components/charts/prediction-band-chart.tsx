"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { HistoryRecord, ForecastRecord } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { TooltipPayloadItem } from "./custom-tooltip";

interface PredictionBandChartProps {
  historyRecords: HistoryRecord[];
  forecastRecord?: ForecastRecord | null;
  height?: number;
}

interface CustomForecastTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomForecastTooltip({ active, payload, label }: CustomForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-3 shadow-xl backdrop-blur-md text-xs">
      <p className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 mb-1.5">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          if (entry.dataKey === "band") {
            const val = entry.value as unknown as number[] | undefined;
            if (!val || !Array.isArray(val)) return null;
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-amber-400">Empirical Interval (q05-q95):</span>
                <span className="font-mono font-semibold text-amber-300">
                  [{val[0]} - {val[1]}]
                </span>
              </div>
            );
          }
          if (entry.value === null || entry.value === undefined) return null;
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-mono font-semibold text-slate-100">
                {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value} cases
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PredictionBandChart({
  historyRecords,
  forecastRecord,
  height = 300,
}: PredictionBandChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Take recent history points (e.g. last 16 weeks)
  const recentHistory = historyRecords.slice(-16);

  // Combine history and forecast
  const chartData = recentHistory.map((h) => ({
    week: `W${h.week} '${String(h.year).slice(2)}`,
    observed: h.status === "ok" ? h.cases : null,
    predicted: null as number | null,
    band: null as [number, number] | null,
    isForecast: false,
  }));

  if (forecastRecord && forecastRecord.predicted_value !== null) {
    const lo = forecastRecord.quantiles?.q0_05 ?? forecastRecord.interval?.lo ?? forecastRecord.predicted_value;
    const hi = forecastRecord.quantiles?.q0_95 ?? forecastRecord.interval?.hi ?? forecastRecord.predicted_value;
    const pVal = forecastRecord.predicted_value;

    if (chartData.length > 0) {
      const last = chartData[chartData.length - 1];
      last.predicted = last.observed;
      last.band = last.observed !== null ? [last.observed, last.observed] : null;
    }

    const forecastWeekLabel = forecastRecord.horizon_weeks
      ? `+${forecastRecord.horizon_weeks}w (Fcst)`
      : "Forecast";

    chartData.push({
      week: forecastWeekLabel,
      observed: null,
      predicted: +pVal.toFixed(1),
      band: [+lo.toFixed(1), +hi.toFixed(1)],
      isForecast: true,
    });
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="week"
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomForecastTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
          />

          {/* Shaded empirical prediction interval band */}
          <Area
            type="monotone"
            dataKey="band"
            name="Prediction Interval (Empirical Bounds)"
            stroke="#F59E0B"
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="#F59E0B"
            fillOpacity={0.18}
          />

          {/* Historical observed cases */}
          <Line
            type="monotone"
            dataKey="observed"
            name="Observed Weekly Cases"
            stroke="#00C8E8"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "#00C8E8" }}
            activeDot={{ r: 5, fill: "#FFFFFF", stroke: "#00C8E8", strokeWidth: 2 }}
            connectNulls={false}
          />

          {/* Point forecast line */}
          <Line
            type="monotone"
            dataKey="predicted"
            name="Point Forecast"
            stroke="#F59E0B"
            strokeWidth={2.5}
            strokeDasharray="4 4"
            dot={{ r: 4, fill: "#F59E0B" }}
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
