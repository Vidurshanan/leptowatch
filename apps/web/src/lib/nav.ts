import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Database,
  Globe2,
  Info,
  LayoutDashboard,
  LineChart,
  MapPinned,
  ShieldAlert,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    description: "National staging status and reporting period",
    icon: LayoutDashboard,
  },
  {
    href: "/geographic",
    label: "Geographic Intelligence",
    description: "26 RDHS areas and map workspace",
    icon: Globe2,
  },
  {
    href: "/rdhs",
    label: "RDHS Profiles",
    description: "Area-level surveillance workspace",
    icon: MapPinned,
  },
  {
    href: "/forecasting",
    label: "Forecasting Centre",
    description: "Count, interval and probability panels",
    icon: LineChart,
  },
  {
    href: "/environment",
    label: "Environmental Intelligence",
    description: "Rainfall, soil and experimental flood proxies",
    icon: Activity,
  },
  {
    href: "/alerts",
    label: "Alert Management",
    description: "Watch, Advisory, Warning and Unverified",
    icon: ShieldAlert,
  },
  {
    href: "/data-quality",
    label: "Data Quality",
    description: "Case status, freshness and completeness",
    icon: Database,
  },
  {
    href: "/model",
    label: "Model Performance",
    description: "Historical evaluation evidence",
    icon: AlertTriangle,
  },
  {
    href: "/system",
    label: "System Information",
    description: "Staging mode, limitations and provenance",
    icon: Info,
  },
];

export function navItemForPath(pathname: string): NavItem {
  if (pathname === "/") {
    return NAV_ITEMS[0];
  }
  return NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
}
