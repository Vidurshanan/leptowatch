"use client";

import React, { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { HistoryRecord } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { CustomTooltip } from "./custom-tooltip";

interface TrendLineChartProps {
  records: HistoryRecord[];
  height?: number;
  strokeColor?: string;
  fillColor?: string;
}

export function TrendLineChart({
  records,
  height = 260,
  strokeColor = "#00C8E8",
  fillColor = "#00C8E8",
}: TrendLineChartProps) {
  const mounted = useIsMounted();
  const rawId = useId();
  const gradientId = `trendGrad-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  const data = records.map((r) => ({
    week: `W${r.week} '${String(r.year).slice(2)}`,
    date: r.week_start,
    cases: r.status === "ok" ? r.cases : null,
    status: r.status,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="week"
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#64748B"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                titlePrefix="Week: "
                unit="cases"
                showNullAs="Unreported / No Data"
              />
            }
          />
          <Area
            type="monotone"
            dataKey="cases"
            name="Weekly Cases"
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            dot={{ r: 2, fill: strokeColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#FFFFFF", stroke: strokeColor, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
