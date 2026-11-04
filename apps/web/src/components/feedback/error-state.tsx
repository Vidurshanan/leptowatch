import { TriangleAlert } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ErrorState({
  title = "Unable to load this panel",
  description,
  className,
  onRetry,
  retryLabel = "Retry Request",
}: {
  title?: string;
  description: string;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-6 py-6 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-6 text-danger" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-xs leading-5 text-muted-foreground">{description}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 text-xs border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export { ErrorState };
