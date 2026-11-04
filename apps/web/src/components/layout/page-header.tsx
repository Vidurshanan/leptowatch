"use client";

import { usePathname } from "next/navigation";

import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { useStagingContext } from "@/components/providers/staging-context";
import { navItemForPath } from "@/lib/nav";

function PageHeader() {
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  const { summary, isLoading } = useStagingContext();

  const issueStartDisplay = isLoading
    ? "--"
    : summary?.issue_start || "Unavailable";

  const latestAcceptedCaseWeekDisplay = isLoading
    ? "--"
    : summary?.freshness?.latest_accepted_date || "Unavailable";

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 md:flex-row md:items-end md:justify-between md:px-6">
      <div className="space-y-2">
        <Breadcrumbs
          items={[
            { href: "/", label: "LeptoWatch" },
            { label: item.label },
          ]}
        />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{item.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs md:flex md:items-center md:gap-4">
        <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Issue week</p>
          <p className="font-mono text-cyan-bright">{issueStartDisplay}</p>
        </div>
        <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest accepted cases</p>
          <p className="font-mono text-amber">{latestAcceptedCaseWeekDisplay}</p>
        </div>
        <Badge variant="unverified">UNVERIFIED</Badge>
      </div>
    </div>
  );
}

export { PageHeader };
