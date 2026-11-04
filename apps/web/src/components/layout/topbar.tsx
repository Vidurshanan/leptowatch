"use client";

import { Bell, Menu, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useStagingContext } from "@/components/providers/staging-context";
import { NAV_ITEMS } from "@/lib/nav";

function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const { summary } = useStagingContext();

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

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-topbar px-3 md:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation menu">
        <Menu className="size-4" />
      </Button>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules (navigation only)..."
          className="pl-9 text-xs"
          aria-label="Search application modules (not epidemiological records)"
        />
        {query ? (
          <div className="absolute top-full z-40 mt-1 w-full rounded-md border border-border bg-surface-raised p-1 shadow-[var(--shadow-panel)]">
            <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border mb-1">
              Application Modules (Navigation)
            </p>
            {results.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No matching module found. (Note: Searches application navigation only, not epidemiological records.)
              </p>
            ) : (
              results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setQuery("")}
                  className="block rounded-sm px-2 py-1.5 text-sm hover:bg-surface-muted"
                >
                  <div className="font-medium text-foreground">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.description}</div>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="staging" className="hidden sm:inline-flex">
          Not operational
        </Badge>
        <Badge variant="unverified" className="hidden md:inline-flex">
          {rdhsCountDisplay}
        </Badge>

        {/* Honest non-operational notification indicator */}
        <Tooltip content="Notifications disabled · Read-only staging demonstration">
          <div
            tabIndex={0}
            role="status"
            aria-label="Notifications disabled in read-only staging"
            className="flex size-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-60 focus:outline-none"
          >
            <Bell className="size-4" />
          </div>
        </Tooltip>

        <Dropdown
          trigger={
            <Button variant="outline" className="gap-2">
              <UserRound className="size-4" />
              <span className="hidden sm:inline text-xs">Staging viewer</span>
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
