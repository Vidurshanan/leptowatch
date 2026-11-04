import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background-deep/40 px-6 text-center",
        className,
      )}
    >
      <Inbox className="size-6 text-cyan/70" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

export { EmptyState };
