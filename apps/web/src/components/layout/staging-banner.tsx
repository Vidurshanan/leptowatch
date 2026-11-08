"use client";

import { useState } from "react";
import { Info, X, ShieldAlert, CheckCircle2, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStagingContext } from "@/components/providers/staging-context";

export function StagingBanner() {
  const { summary } = useStagingContext();
  const [showModal, setShowModal] = useState(false);

  const latestAccepted =
    summary?.freshness?.latest_accepted_date || "2026-08-10";
  const candidateWeek = "2026-09-14";
  const candidateCount = 130;

  return (
    <>
      <div className="flex h-8 items-center justify-between border-b border-[#1A2840] bg-[#08111F]/90 px-3 md:px-6 text-[11px] text-slate-300">
        <div className="flex items-center gap-2 overflow-hidden">
          <Badge
            variant="default"
            className="h-5 px-1.5 text-[9px] font-semibold tracking-wider bg-cyan/15 text-cyan border-cyan/40 shrink-0"
          >
            HISTORICAL INTELLIGENCE
          </Badge>

          <span className="hidden sm:inline-block text-slate-400 truncate text-[11px]">
            Historical model evidence active &middot; Current operational forecasting unavailable (freshness gate)
          </span>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="View data verification and freshness explanation"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-cyan hover:bg-cyan/10 hover:text-cyan-bright transition-colors"
          >
            <Info className="size-3" />
            <span className="underline underline-offset-2">Data Status</span>
          </button>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1">
            <Clock className="size-3 text-cyan" />
            Latest Accepted: <span className="text-slate-200">{latestAccepted}</span>
          </span>
          <span className="hidden lg:inline-block text-slate-600">&vert;</span>
          <span className="hidden lg:inline-flex items-center gap-1 text-amber">
            <span>{candidateCount} WER Candidates Awaiting Acceptance</span>
          </span>
        </div>
      </div>

      {/* Information Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="data-status-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[#1E293B] bg-[#0B1628] p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-cyan" />
                <h3 id="data-status-title" className="text-sm font-semibold text-white">
                  Historical Intelligence & Data Verification Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <p className="bg-[#101D30] p-3 rounded border border-slate-700/60 text-slate-200">
                <strong>Historical model evidence is available.</strong> Current operational forecasting is unavailable because the latest accepted case data does not satisfy the internal freshness requirement.
              </p>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                <div className="rounded bg-[#07101E] p-2.5 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">LATEST ACCEPTED CASE DATE</span>
                  <span className="text-cyan font-bold">{latestAccepted}</span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">26,936 verified reports</span>
                </div>
                <div className="rounded bg-[#07101E] p-2.5 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">RECONCILED CANDIDATE WEEK</span>
                  <span className="text-amber font-bold">{candidateWeek}</span>
                  <span className="block text-[9px] text-amber/70 mt-0.5">130 records awaiting acceptance</span>
                </div>
                <div className="rounded bg-[#07101E] p-2.5 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">INTERNAL FRESHNESS GATE</span>
                  <span className="text-slate-200 font-bold">56 Days</span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">Project policy limit</span>
                </div>
                <div className="rounded bg-[#07101E] p-2.5 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">OPERATIONAL APPROVAL</span>
                  <span className="text-rose-400 font-bold">NOT APPROVED</span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">Decoupled from freshness</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan shrink-0 mt-0.5" />
                  <span>
                    <strong>Policy Caveat:</strong> The 56-day gate is an internal project safety policy, not an official reporting-delay standard.
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan shrink-0 mt-0.5" />
                  <span>
                    <strong>Candidate Reports:</strong> Reconciled WER candidates remain labeled as <code className="text-amber">no_accepted_report</code> until explicitly promoted through formal review.
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="size-3.5 text-cyan shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero-Fill Prohibition:</strong> Missing reports are strictly treated as unavailable; zero cases are never substituted.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
                className="border-slate-700 bg-slate-800 text-xs text-white hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
