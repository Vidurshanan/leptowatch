"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import {
  DashboardSummaryResponse,
  AlertListResponse,
  fetchDashboardSummary,
  fetchAlertsLatest,
} from "@/lib/api";

export interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  caution: number;
  unverified: number;
  elevated: number; // critical + warning
}

interface StagingContextValue {
  summary: DashboardSummaryResponse | null;
  alerts: AlertListResponse | null;
  alertCounts: AlertCounts;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const defaultAlertCounts: AlertCounts = {
  total: 0,
  critical: 0,
  warning: 0,
  caution: 0,
  unverified: 0,
  elevated: 0,
};

const StagingContext = createContext<StagingContextValue>({
  summary: null,
  alerts: null,
  alertCounts: defaultAlertCounts,
  isLoading: true,
  error: null,
  refresh: () => {},
});

export function StagingProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(0);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      fetchDashboardSummary(controller.signal),
      fetchAlertsLatest(controller.signal),
    ]).then(([summaryRes, alertsRes]) => {
      let hasError = false;

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      } else if (summaryRes.reason?.name !== "AbortError") {
        hasError = true;
        setError(summaryRes.reason?.message || "Failed to load staging summary");
      }

      if (alertsRes.status === "fulfilled") {
        setAlerts(alertsRes.value);
      } else if (alertsRes.reason?.name !== "AbortError") {
        if (summaryRes.status !== "fulfilled") {
          hasError = true;
        }
      }

      if (!hasError) {
        setError(null);
      }
      setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [tick]);

  const alertCounts = useMemo<AlertCounts>(() => {
    if (!alerts?.records || alerts.records.length === 0) {
      return defaultAlertCounts;
    }

    let critical = 0;
    let warning = 0;
    let caution = 0;
    let unverified = 0;

    for (const record of alerts.records) {
      const tier = (record.tier || "").toUpperCase();
      if (record.unverified || record.verification_status?.toUpperCase() === "UNVERIFIED") {
        unverified++;
      }

      if (tier === "CRITICAL") {
        critical++;
      } else if (tier === "WARNING") {
        warning++;
      } else if (tier === "WATCH" || tier === "ADVISORY" || tier === "CAUTION") {
        caution++;
      }
    }

    return {
      total: alerts.records.length,
      critical,
      warning,
      caution,
      unverified,
      elevated: critical + warning,
    };
  }, [alerts]);

  return (
    <StagingContext.Provider
      value={{
        summary,
        alerts,
        alertCounts,
        isLoading,
        error,
        refresh,
      }}
    >
      {children}
    </StagingContext.Provider>
  );
}

export function useStagingContext(): StagingContextValue {
  return useContext(StagingContext);
}
