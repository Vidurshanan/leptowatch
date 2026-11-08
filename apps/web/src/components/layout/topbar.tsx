"use client";

import { Bell, Menu, Search, UserRound, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { useStagingContext } from "@/components/providers/staging-context";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const { summary, alerts, alertCounts, isLoading } = useStagingContext();

  const currentRoute = useMemo(() => {
    return (
      NAV_ITEMS.find((item) =>
        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
      ) || NAV_ITEMS[0]
    );
  }, [pathname]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return NAV_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    );
  }, [query]);

  const rdhsCountDisplay = summary?.rdhs_count
    ? `${summary.rdhs_count} RDHS`
    : "26 RDHS";

  // Prioritize alerts: Elevated first, then highest pE
  const highlightedAlerts = useMemo(() => {
    if (!alerts?.records) return [];
    return [...alerts.records]
      .sort((a, b) => {
        const aElev = (a.tier === "Critical" || a.tier === "Warning") ? 1 : 0;
        const bElev = (b.tier === "Critical" || b.tier === "Warning") ? 1 : 0;
        if (aElev !== bElev) return bElev - aElev;
        return (b.pE ?? 0) - (a.pE ?? 0);
      })
      .slice(0, 5);
  }, [alerts]);

  const latestDataDate = summary?.freshness?.latest_accepted_date;

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-topbar px-3 md:px-5">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenu} aria-label="Open navigation menu">
          <Menu className="size-4" />
        </Button>

        {/* Current Page Title and Contextual Description */}
        <div className="hidden sm:block min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-foreground truncate">
              {currentRoute.label}
            </h2>
            <span className="hidden xl:inline text-xs text-muted-foreground/70">&bull;</span>
            <span className="hidden xl:inline text-xs text-muted-foreground truncate max-w-xs">
              {currentRoute.description}
            </span>
          </div>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules..."
          className="pl-8 text-xs h-8 bg-surface-raised"
          aria-label="Search application modules"
        />
        {query ? (
          <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-surface-raised p-1 shadow-[var(--shadow-panel)]">
            <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
              Application Modules
            </p>
            {results.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No matching module found. (Navigation search only.)
              </p>
            ) : (
              results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setQuery("")}
                  className="block rounded-sm px-2 py-1.5 text-xs hover:bg-surface-muted"
                >
                  <div className="font-medium text-foreground">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.description}</div>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Genuine Data Timestamp */}
        {latestDataDate && (
          <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-border/60 text-[11px] text-muted-foreground">
            <Clock className="size-3 text-cyan" />
            <span>Latest:</span>
            <span className="font-mono text-foreground font-medium">{latestDataDate}</span>
          </div>
        )}

        {/* API Health Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-border/60 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-emerald-400 font-semibold">API: OK</span>
        </div>

        <Badge variant="staging" className="hidden md:inline-flex">
          Not operational
        </Badge>
        <Badge variant="unverified" className="hidden sm:inline-flex font-mono">
          {rdhsCountDisplay}
        </Badge>

        {/* Dynamic Staging Notification Bell */}
        <Dropdown
          align="end"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground size-8"
              aria-label={`Alert notifications (${alertCounts.total} provisional staging alerts)`}
            >
              <Bell className="size-4" />
              {alertCounts.total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
                  {alertCounts.elevated > 0 ? (
                    <span className="relative flex size-3.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex size-3.5 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold text-white font-mono">
                        {alertCounts.elevated}
                      </span>
                    </span>
                  ) : (
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-amber-500/90 text-[8px] font-bold text-black font-mono">
                      {alertCounts.total > 9 ? "!" : alertCounts.total}
                    </span>
                  )}
                </span>
              )}
            </Button>
          }
        >
          <div className="w-80 sm:w-96 p-2">
            <div className="flex items-center justify-between border-b border-border pb-2 px-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground tracking-wide">
                    Surveillance Notifications
                  </span>
                  <Badge variant="staging" className="text-[9px] px-1.5 py-0">
                    Provisional
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Latest staging classifications across 26 RDHS areas
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-cyan">
                {alertCounts.total} total
              </span>
            </div>

            {/* Quick breakdown pill row */}
            <div className="grid grid-cols-3 gap-1.5 py-2 px-1 text-center text-[10px] border-b border-border">
              <div className="rounded bg-rose-500/10 border border-rose-500/20 p-1">
                <span className="font-bold text-rose-400 font-mono text-xs block">
                  {alertCounts.elevated}
                </span>
                <span className="text-muted-foreground">Elevated</span>
              </div>
              <div className="rounded bg-amber-500/10 border border-amber-500/20 p-1">
                <span className="font-bold text-amber-400 font-mono text-xs block">
                  {alertCounts.caution}
                </span>
                <span className="text-muted-foreground">Watch</span>
              </div>
              <div className="rounded bg-slate-500/10 border border-slate-500/20 p-1">
                <span className="font-bold text-slate-300 font-mono text-xs block">
                  {alertCounts.unverified}
                </span>
                <span className="text-muted-foreground">Unverified</span>
              </div>
            </div>

            {/* Alert List */}
            <div className="max-h-64 overflow-y-auto divide-y divide-border/50 py-1">
              {isLoading ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Loading surveillance notifications...
                </div>
              ) : highlightedAlerts.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  No active alerts recorded.
                </div>
              ) : (
                highlightedAlerts.map((record) => {
                  const isElev = record.tier === "Critical" || record.tier === "Warning";
                  return (
                    <Link
                      key={record.rdhs}
                      href={`/rdhs?id=${encodeURIComponent(record.rdhs)}`}
                      className="block p-2 rounded hover:bg-surface-muted transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground group-hover:text-cyan transition-colors">
                          {record.rdhs} RDHS
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold",
                            isElev
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : record.tier === "Watch"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                          )}
                        >
                          {record.tier} {record.unverified ? "(Unverified)" : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                        {record.reasons || record.rule || "Surveillance status active"}
                      </p>
                      {record.pE !== null && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <span>pE: {(record.pE * 100).toFixed(1)}%</span>
                          {record.pH !== null && <span>pH: {(record.pH * 100).toFixed(1)}%</span>}
                        </div>
                      )}
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer action */}
            <div className="pt-2 border-t border-border mt-1">
              <Link
                href="/alerts"
                className="flex items-center justify-between w-full rounded px-2.5 py-1.5 text-xs font-medium text-cyan hover:bg-cyan/10 transition-colors"
              >
                <span>View Full Alert Management Dashboard</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <p className="mt-1 px-2 text-[9px] text-muted-foreground leading-tight">
                Read-only research demonstration. Not approved for clinical or operational public health dispatch.
              </p>
            </div>
          </div>
        </Dropdown>

        <Dropdown
          trigger={
            <Button variant="outline" className="gap-2 h-8 text-xs">
              <UserRound className="size-3.5" />
              <span className="hidden sm:inline">Staging viewer</span>
            </Button>
          }
        >
          <div className="px-2.5 py-2">
            <p className="text-sm font-medium">Staging viewer</p>
            <p className="text-[11px] text-muted-foreground">Read-only demonstration profile</p>
          </div>
          <DropdownItem disabled className="opacity-60 text-xs">
            Sign-in is not enabled
          </DropdownItem>
          <DropdownItem className="text-xs">
            Current path: {pathname}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}

export { Topbar };
