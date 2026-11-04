import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-cyan/30 bg-cyan/10 text-cyan-bright",
        staging: "border-amber/40 bg-amber/10 text-amber",
        watch: "border-watch/40 bg-watch/10 text-watch",
        advisory: "border-advisory/40 bg-advisory/10 text-advisory",
        warning: "border-warning-tier/40 bg-warning-tier/10 text-warning-tier",
        unverified: "border-unverified/30 bg-unverified/10 text-unverified",
        muted: "border-border bg-surface-muted text-muted-foreground",
        teal: "border-teal/30 bg-teal/10 text-teal",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
