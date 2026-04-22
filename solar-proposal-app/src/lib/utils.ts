import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined, decimals = 0) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
}
