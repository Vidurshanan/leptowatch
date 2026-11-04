"use client";

import { type ReactNode, useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Sidebar } from "@/components/layout/sidebar";
import { StagingBanner } from "@/components/layout/staging-banner";
import { Topbar } from "@/components/layout/topbar";
import { StagingProvider } from "@/components/providers/staging-context";

function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [mobileOpen]);

  return (
    <StagingProvider>
      <div className="flex h-screen min-h-0 bg-background text-foreground">
        <div className="hidden lg:block">
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            <button
              type="button"
              className="absolute inset-0 bg-background-deep/70 backdrop-blur-sm"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full w-[248px] shadow-2xl">
              <Sidebar
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <StagingBanner />
          <Topbar onMenu={() => setMobileOpen(true)} />
          <PageHeader />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
          <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground md:px-6">
            <span>Read-only staging demonstration · 26 RDHS health areas · Kalmunai listed separately within Ampara</span>
            <span className="hidden md:inline-flex font-mono text-[10px] text-cyan">
              Staging Demonstration
            </span>
          </footer>
        </div>
      </div>
    </StagingProvider>
  );
}

export { AppShell };
