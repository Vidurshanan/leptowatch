"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Radar } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { useStagingContext } from "@/components/providers/staging-context";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { alertCounts } = useStagingContext();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-3">
        <div className="flex size-9 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10">
          <Radar className="size-4 text-cyan" />
        </div>
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-wide text-foreground">{APP_NAME}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Intelligence
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isAlertsItem = item.href === "/alerts";
          const hasElevated = alertCounts.elevated > 0;
          const hasAlerts = alertCounts.total > 0;

          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-cyan/12 text-cyan-bright font-medium"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <div className="relative shrink-0">
                <item.icon className={cn("size-4", active ? "text-cyan" : "text-muted-foreground")} />
                {isAlertsItem && hasAlerts && collapsed && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-sidebar",
                      hasElevated ? "bg-rose-500 animate-pulse" : "bg-amber-400"
                    )}
                  />
                )}
              </div>
              {collapsed ? null : (
                <>
                  <span className="truncate">{item.label}</span>
                  {isAlertsItem && hasAlerts && (
                    <span className="ml-auto flex items-center gap-1.5">
                      {hasElevated && (
                        <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.2 text-[10px] font-mono font-semibold",
                          hasElevated
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                        )}
                      >
                        {hasElevated ? `${alertCounts.elevated} elevated` : alertCounts.total}
                      </span>
                    </span>
                  )}
                </>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip
              key={item.href}
              content={
                isAlertsItem && hasAlerts
                  ? `${item.label} (${alertCounts.total} active)`
                  : item.label
              }
            >
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        {collapsed ? null : (
          <p className="mb-2 px-2 text-[10px] leading-4 text-muted-foreground">{APP_TAGLINE}</p>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-2 py-2 text-xs text-muted-foreground hover:border-cyan/30 hover:text-foreground focus:outline-none"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {collapsed ? null : "Collapse"}
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
