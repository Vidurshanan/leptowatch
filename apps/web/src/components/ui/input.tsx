import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-background-deep px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-cyan/50 focus-visible:ring-2 focus-visible:ring-cyan/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
