/**
 * @module utils
 * @description Core utility functions used across the entire application.
 *
 * Key exports:
 * - cn() — Tailwind CSS class merge utility (clsx + tailwind-merge). Use for conditional/merged class names.
 * - getInitials() — Extract initials from a display name ("Sailesh Bhupalam" → "SB", "Alice" → "A", null → "?")
 *
 * Dependencies: clsx, tailwind-merge
 * Related: Every component that uses className merging imports cn() from here
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get initials from a display name. "Sailesh Bhupalam" → "SB", "Alice" → "A"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
