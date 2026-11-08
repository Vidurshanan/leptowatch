"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ModelMetric } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { TooltipPayloadItem } from "./custom-tooltip";

interface ModelComparisonChartProps {
  models: ModelMetric[];
  height?: number;
}

interface CustomModelTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomModelTooltip({ active, payload, label }: CustomModelTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload as { fullName?: string; rank?: number; mae?: number; rmse?: number; samples?: number } | undefined;
  return (
    <div className="rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-3 shadow-xl backdrop-blur-md text-xs">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1 mb-1.5 gap-4">
        <span className="font-semibold text-slate-200">{item?.fullName || label}</span>
        <span className="font-mono text-cyan text-[11px]">Rank #{item?.rank}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">MAE:</span>
          <span className="font-mono font-semibold text-cyan">{item?.mae}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">RMSE:</span>
          <span className="font-mono font-semibold text-amber-400">{item?.rmse}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[10px] text-muted-foreground pt-1 border-t border-slate-800">
          <span>Validation Samples:</span>
          <span className="font-mono">{item?.samples?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export function ModelComparisonChart({
  models,
  height = 300,
}: ModelComparisonChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Sort by rank ascending
  const sorted = [...models].sort((a, b) => a.rank - b.rank);

  const data = sorted.map((m) => ({
    name: m.code || m.model_name,
    fullName: m.model_name,
    mae: +m.mae.toFixed(2),
    rmse: +m.rmse.toFixed(2),
    rank: m.rank,
    samples: m.n_samples,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={true}
          />
          <Tooltip content={<CustomModelTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
          />

          <Bar
            dataKey="mae"
            name="MAE (Mean Absolute Error)"
            fill="#00C8E8"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="rmse"
            name="RMSE (Root Mean Squared Error)"
            fill="#F59E0B"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
