import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ParseResult } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures backend summary always includes the required fields (totalClaims, partial, etc.)
 */
export const normalizeSummary = (
  s: { [key: string]: any }
): ParseResult['summary'] => ({
  total: s.total ?? 0,
  valid: s.valid ?? 0,
  invalid: s.invalid ?? 0,
  accepted: s.accepted ?? 0,
  rejected: s.rejected ?? 0,
  totalClaims: s.totalClaims ?? s.total ?? 0,
  partial: s.partial ?? 0,
});

/**
 * Triggers a browser download of a string as a text file.
 * Safely revokes the object URL after triggering.
 */
export const downloadString = (str: string, name: string) => {
  const blob = new Blob([str], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
