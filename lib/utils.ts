import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ----------------------------------------------------------------------
// Security Utilities
// ----------------------------------------------------------------------

// 10MB Limit
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function validateFileSize(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
        return `File size exceeds the 10MB limit (Current: ${(file.size / 1024 / 1024).toFixed(2)}MB).`;
    }
    return null;
}

export function downloadFile(content: string, filename: string) {
    // Sanitize filename: Ensure it ends with a safe extension
    let safeFilename = filename;
    const allowedExtensions = ['.txt', '.csv', '.ack', '.resp'];
    const hasValidExtension = allowedExtensions.some(ext => safeFilename.toLowerCase().endsWith(ext));

    if (!hasValidExtension) {
        // Force .txt extension for unknown file types to prevent executing malicious content (e.g. .html)
        safeFilename += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
