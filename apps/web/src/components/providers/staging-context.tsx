"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { DashboardSummaryResponse, fetchDashboardSummary } from "@/lib/api";

interface StagingContextValue {
  summary: DashboardSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
}

const StagingContext = createContext<StagingContextValue>({
  summary: null,
  isLoading: true,
  error: null,
});

export function StagingProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchDashboardSummary(controller.signal)
      .then((data) => {
        setSummary(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Failed to load staging summary");
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <StagingContext.Provider value={{ summary, isLoading, error }}>
      {children}
    </StagingContext.Provider>
  );
}

export function useStagingContext(): StagingContextValue {
  return useContext(StagingContext);
}
