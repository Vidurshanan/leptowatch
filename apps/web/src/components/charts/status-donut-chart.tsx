"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { useIsMounted } from "@/lib/use-mounted";
import { CustomTooltip } from "./custom-tooltip";

interface SliceItem {
  name: string;
  value: number;
  color: string;
}

interface StatusDonutChartProps {
  slices: SliceItem[];
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
}

export function StatusDonutChart({
  slices,
  centerLabel = "Total",
  centerValue,
  height = 240,
}: StatusDonutChartProps) {
  const mounted = useIsMounted();

  if (!mounted) {
    return <div style={{ height }} className="w-full animate-pulse bg-surface-raised rounded" />;
  }

  const total = centerValue !== undefined
    ? centerValue
    : slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <CustomTooltip
                  titlePrefix="Status: "
                  unit="entities"
                />
              }
            />
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              stroke="#0B1628"
              strokeWidth={2}
            >
              {slices.map((entry, index) => (
                <Cell key={`donut-cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center overlay label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono text-foreground">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 px-2 text-xs">
        {slices.map((slice, idx) => (
          <div key={`legend-${idx}`} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-muted-foreground text-[11px]">{slice.name}:</span>
            <span className="font-mono font-semibold text-foreground text-[11px]">{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
