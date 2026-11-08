"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Info, AlertCircle } from "lucide-react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  footnote?: string;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  badge,
  action,
  footnote,
  isLoading,
  error,
  isEmpty,
  emptyMessage = "No surveillance records available for this chart.",
  children,
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-panel)] flex flex-col justify-between transition-all duration-200",
        className
      )}
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>

        <div className="mt-4 min-h-[260px] flex flex-col justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-12 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
              <p className="text-xs">Loading surveillance telemetry...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-12 text-rose-400">
              <AlertCircle className="size-6" />
              <p className="text-xs">{error}</p>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-12 text-muted-foreground">
              <Info className="size-5 text-slate-500" />
              <p className="text-xs">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      {footnote && (
        <div className="mt-3 border-t border-border/40 pt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground leading-normal">
          <Info className="size-3.5 shrink-0 text-cyan/70 mt-0.5" />
          <span>{footnote}</span>
        </div>
      )}
    </div>
  );
}
