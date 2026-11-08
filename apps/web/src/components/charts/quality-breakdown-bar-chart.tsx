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
import { RDHSQualityItem } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { TooltipPayloadItem } from "./custom-tooltip";

interface QualityBreakdownBarChartProps {
  items: RDHSQualityItem[];
  height?: number;
  limit?: number;
}

interface CustomQualityTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomQualityTooltip({ active, payload, label }: CustomQualityTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload as { completeness?: number; accepted?: number; missing?: number; nonreporting?: number } | undefined;
  return (
    <div className="rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-3 shadow-xl backdrop-blur-md text-xs">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1 mb-1.5 gap-4">
        <span className="font-semibold text-slate-200">{label} RDHS</span>
        <span className="font-mono text-cyan text-[11px] font-bold">{item?.completeness}% complete</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-emerald-400">Accepted Weeks:</span>
          <span className="font-mono font-semibold text-slate-100">{item?.accepted}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-amber-400">Missing Weeks:</span>
          <span className="font-mono font-semibold text-slate-100">{item?.missing}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Non-Reporting:</span>
          <span className="font-mono font-semibold text-slate-100">{item?.nonreporting}</span>
        </div>
      </div>
    </div>
  );
}

export function QualityBreakdownBarChart({
  items,
  height = 360,
  limit = 13,
}: QualityBreakdownBarChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Sort by completeness ascending (to highlight areas needing data quality attention)
  const sorted = [...items]
    .sort((a, b) => a.completeness_pct - b.completeness_pct)
    .slice(0, limit);

  const data = sorted.map((d) => ({
    rdhs: d.rdhs,
    accepted: d.accepted_weeks,
    missing: d.missing_weeks,
    nonreporting: d.nonreporting_weeks,
    completeness: +d.completeness_pct.toFixed(1),
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="rdhs"
            stroke="#64748B"
            tick={{ fill: "#CBD5E1", fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomQualityTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
          />

          <Bar
            dataKey="accepted"
            name="Accepted Reports"
            stackId="a"
            fill="#10B981"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="missing"
            name="Missing Reports"
            stackId="a"
            fill="#F59E0B"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="nonreporting"
            name="Nonreporting Reports"
            stackId="a"
            fill="#64748B"
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
