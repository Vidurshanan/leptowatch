import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ChartFrame({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        <Badge variant="muted">Placeholder</Badge>
      </CardHeader>
      <CardContent>
        {children ?? (
          <div className="panel-grid flex h-52 items-end gap-2 rounded-md border border-border px-4 pb-4 pt-8">
            {[28, 46, 34, 62, 40, 72, 38, 54].map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-sm bg-cyan/20"
                style={{ height: `${height}%` }}
                aria-hidden
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Layout container only. No epidemiological series are plotted in Phase 2.
        </p>
      </CardContent>
    </Card>
  );
}

export { ChartFrame };
