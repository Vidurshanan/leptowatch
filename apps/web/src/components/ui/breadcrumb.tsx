import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = { href?: string; label: string };

function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
            {item.href && !last ? (
              <Link href={item.href} className="text-muted-foreground hover:text-cyan-bright">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-cyan-bright" : "text-muted-foreground"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export { Breadcrumbs };
