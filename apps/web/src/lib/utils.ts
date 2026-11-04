import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps an alert or forecast tier name to a valid Badge variant.
 * Avoids hardcoding any tier styling and preserves unverified/unknown states.
 */
export function getTierBadgeVariant(
  tier?: string | null
): "watch" | "advisory" | "warning" | "teal" | "muted" {
  if (!tier) return "muted";
  const lower = tier.toLowerCase().trim();
  if (lower === "watch") return "watch";
  if (lower === "advisory") return "advisory";
  if (lower === "warning") return "warning";
  if (lower === "normal") return "teal";
  return "muted";
}
