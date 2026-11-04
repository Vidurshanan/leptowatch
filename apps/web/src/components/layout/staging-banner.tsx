"use client";

import { Badge } from "@/components/ui/badge";
import { useStagingContext } from "@/components/providers/staging-context";
import { STAGING_BANNER } from "@/lib/constants";

function StagingBanner() {
  const { summary, isLoading } = useStagingContext();

  const issueStartDisplay = isLoading
    ? "--"
    : summary?.issue_start || "Unavailable";

  const bannerText = summary?.staging_banner || STAGING_BANNER;

  return (
    <div className="flex items-start gap-3 border-b border-amber/25 bg-amber/8 px-4 py-2.5 md:px-6">
      <Badge variant="staging">Staging</Badge>
      <p className="text-xs leading-5 text-amber/90 md:text-[13px]">{bannerText}</p>
      <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-amber/70 lg:block">
        issue {issueStartDisplay}
      </span>
    </div>
  );
}

export { StagingBanner };
