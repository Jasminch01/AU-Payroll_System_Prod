import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Addresses conditionally applied or conflicting classes
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Formats decimal hours (e.g., 6.75) into a human-readable format (e.g., 2h25m or 20m).
 */
export function formatDecimalHours(decimal: number | null | undefined): string {
    if (decimal == null || isNaN(decimal) || decimal <= 0) return "0m";
    const totalMinutes = Math.round(decimal * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
}
