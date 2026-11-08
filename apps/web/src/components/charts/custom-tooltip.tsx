"use client";

import React from "react";

export interface TooltipPayloadItem {
  value?: number | string | null;
  name?: string;
  color?: string;
  stroke?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  titlePrefix?: string;
  unit?: string;
  showNullAs?: string;
}

export function CustomTooltip({
  active,
  payload,
  label,
  titlePrefix = "Period: ",
  unit = "",
  showNullAs = "Unavailable / Unreported",
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-[#1A2840] bg-[#0B1628]/95 p-2.5 shadow-xl backdrop-blur-md text-xs z-50">
      {label && (
        <div className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 mb-1.5 flex items-center justify-between gap-3">
          <span>{titlePrefix}{label}</span>
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const val = entry.value;
          const isNull = val === null || val === undefined;
          return (
            <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: entry.color || entry.stroke || "#00C8E8" }}
                />
                <span className="text-slate-400 font-medium">{entry.name}:</span>
              </div>
              <span className="font-mono font-semibold text-slate-100">
                {isNull ? (
                  <span className="text-amber-400 font-normal">{showNullAs}</span>
                ) : typeof val === "number" ? (
                  Number.isInteger(val) ? `${val.toLocaleString()} ${unit}` : `${val.toFixed(2)} ${unit}`
                ) : (
                  `${val} ${unit}`
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
