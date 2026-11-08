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
  Cell,
} from "recharts";
import { HistoryRecord } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { CustomTooltip } from "./custom-tooltip";

interface WeeklyCasesBarChartProps {
  records?: HistoryRecord[];
  height?: number;
  highlightLatestCount?: number;
}

export function WeeklyCasesBarChart({
  records = [],
  height = 260,
  highlightLatestCount = 4,
}: WeeklyCasesBarChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Guard against undefined or null records
  const safeRecords = records ?? [];

  // Empty state
  if (safeRecords.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-500" style={{ height }}>
        No historical case records available
      </div>
    );
  }

  // Format data for chart
  const data = safeRecords.map((r, idx) => {
    const isRecent = idx >= safeRecords.length - highlightLatestCount;
    const isOk = r.status === "ok";
    return {
      week: `W${r.week} '${String(r.year).slice(2)}`,
      fullDate: r.week_start,
      cases: isOk ? r.cases : null,
      status: r.status,
      isRecent,
    };
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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
                showNullAs="Unreported / Missing"
              />
            }
          />
          <Bar dataKey="cases" name="Accepted Cases" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => {
              const fill = entry.cases === null
                ? "#334155"
                : entry.isRecent
                ? "#00C8E8"
                : "#0284C7";
              return <Cell key={`bar-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
