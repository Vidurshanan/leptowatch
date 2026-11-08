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
import { RDHSSummaryItem } from "@/lib/api";
import { useIsMounted } from "@/lib/use-mounted";
import { CustomTooltip } from "./custom-tooltip";

interface RDHSComparisonChartProps {
  records: RDHSSummaryItem[];
  metricKey?: "pE" | "pH" | "mu";
  metricLabel?: string;
  unit?: string;
  height?: number;
  limit?: number;
}

export function RDHSComparisonChart({
  records,
  metricKey = "pE",
  metricLabel = "Exceedance Risk (pE)",
  unit = "%",
  height = 360,
  limit = 12,
}: RDHSComparisonChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  // Filter and sort by metric descending
  const validRecords = records
    .filter((r) => r[metricKey] !== null && r[metricKey] !== undefined)
    .sort((a, b) => ((b[metricKey] ?? 0) - (a[metricKey] ?? 0)))
    .slice(0, limit);

  const data = validRecords.map((r) => {
    const rawVal = r[metricKey] as number;
    const isPct = unit === "%";
    return {
      rdhs: r.rdhs,
      value: isPct ? +(rawVal * 100).toFixed(1) : +rawVal.toFixed(2),
      tier: r.tier,
      district: r.district,
    };
  });

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
            unit={unit}
          />
          <YAxis
            type="category"
            dataKey="rdhs"
            stroke="#64748B"
            tick={{ fill: "#CBD5E1", fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                titlePrefix="RDHS: "
                unit={unit}
              />
            }
          />
          <Bar
            dataKey="value"
            name={metricLabel}
            radius={[0, 4, 4, 0]}
          >
            {data.map((entry, index) => {
              const t = (entry.tier || "").toUpperCase();
              let fill = "#00C8E8";
              if (t === "CRITICAL") fill = "#EF4444";
              else if (t === "WARNING") fill = "#F97316";
              else if (t === "WATCH") fill = "#F59E0B";
              else if (t === "ADVISORY") fill = "#38BDF8";
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
