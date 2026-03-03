'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { parseFileOnBackend, parseTextOnBackend, ApiError, checkHealth, validateStatusChange, validatePartialUnits } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check, Activity, AlertTriangle, ShieldAlert, Copy, Download, X, WifiOff, ArrowRight, Zap, Shuffle, ChevronDown, Undo2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ParseResult, ParsedLine, FieldDefinition, ParsedField } from '@/lib/types';
import { ACK_DENIAL_CODES, RESP_DENIAL_CODES } from '@/lib/constants';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Extracted Components
import { StatBox } from './visualizer/stat-box';
import { VisualizerSidebar } from './visualizer/sidebar';
import { LoadingOverlay } from './visualizer/loading-overlay';
import { GridView } from './visualizer/grid-view';

const ErrorBanner = ({ error, onDismiss }: { error: string, onDismiss: () => void }) => {
    const isConnectionError = error.toLowerCase().includes('connect') || error.toLowerCase().includes('engine') || error.toLowerCase().includes('server');

    return (
        <div className="relative mt-8 group animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-linear-to-r from-rose-500/20 via-rose-500/40 to-rose-500/20 rounded-2xl blur-xl opacity-50 block group-hover:opacity-75 transition-opacity duration-500" />

            <div className="relative flex max-w-lg bg-background/80 backdrop-blur-xl border border-rose-500/30 rounded-2xl overflow-hidden shadow-2xl">
                <div className="w-1.5 bg-rose-500 shrink-0" />
                <div className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                        {isConnectionError ? (
                            <WifiOff className="w-5 h-5 text-rose-500 animate-pulse" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                        )}
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
                                {isConnectionError ? 'System Service Offline' : 'Processing Interrupted'}
                            </h4>
                            <button
                                onClick={onDismiss}
                                className="p-1 hover:bg-rose-500/10 rounded-md transition-colors text-zinc-500 hover:text-rose-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-300 font-medium leading-relaxed pr-2">
                            {error}
                        </p>
                        {isConnectionError && (
                            <div className="pt-2 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[9px] text-rose-500/80 font-bold uppercase tracking-widest leading-none">Establishing safe reconnection...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const emptyResult = { lines: [], summary: { total: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0 } };

export function AckVisualizer({ onSwitchToMrxForge, pendingContent, onPendingContentConsumed }: {
    onSwitchToMrxForge?: (file: File) => void,
    pendingContent?: { text: string; fileName: string } | null,
    onPendingContentConsumed?: () => void
}) {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processProgress, setProcessProgress] = useState(0);
    const [processedLines, setProcessedLines] = useState(0);
    const [activePhase, setActivePhase] = useState<'IDLE' | 'UPLOADING' | 'PROCESSING'>('IDLE');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [schema, setSchema] = useState<'ACK' | 'RESP'>('ACK');
    const [isDragging, setIsDragging] = useState(false);

    // Bulk action panel state
    const [bulkPanel, setBulkPanel] = useState<{ open: boolean; mode: 'DY' | 'PA' | 'RJ' }>({
        open: false, mode: 'DY'
    });
    const [bulkPct, setBulkPct] = useState('30');
    const [bulkInputMode, setBulkInputMode] = useState<'PCT' | 'CNT'>('PCT');
    const [bulkCount, setBulkCount] = useState('10');
    const [randomizeDenyCodes, setRandomizeDenyCodes] = useState(true);
    const [bulkDenialCode, setBulkDenialCode] = useState('GI');
    const [editingField, setEditingField] = useState<{ lineIdx: number, fieldIdx: number, value: string } | null>(null);
    const [mrxDetected, setMrxDetected] = useState(false);
    const [mrxFile, setMrxFile] = useState<File | null>(null);

    const [fileName, setFileName] = useState<string | null>(null);

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [result, setResult] = useState<ParseResult>(emptyResult);
    const [error, setError] = useState<string | null>(null);
    const [, setIsReconnecting] = useState(false);

    // History for Undo
    const [history, setHistory] = useState<{ result: ParseResult; content: string }[]>([]);

    // Ref to track latest result/content for use in stable callbacks without re-creating them
    const resultRef = useRef<ParseResult>(emptyResult);
    const contentRef = useRef<string>('');
    useEffect(() => { resultRef.current = result; }, [result]);
    useEffect(() => { contentRef.current = content; }, [content]);

    const recordHistory = useCallback(() => {
        setHistory(prev => [{ result: resultRef.current, content: contentRef.current }, ...prev].slice(0, 50));
    }, []);

    const handleUndo = useCallback(() => {
        let stateToRestore: { result: ParseResult; content: string } | null = null;
        
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const [lastState, ...remaining] = prev;
            stateToRestore = lastState;
            return remaining;
        });

        if (stateToRestore) {
            const { result: r, content: c } = stateToRestore;
            setResult(r);
            setContent(c);
            
            toast.info('Action Undone', {
                description: 'The previous state has been restored.',
                duration: 2000,
                id: 'undo-toast'
            });
        }
    }, []);

    // Keyboard shortcut for Undo (Ctrl+Z)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]);

    // Self-Healing Logic: Polling backend status when in error state
    useEffect(() => {
        if (!error || !error.toLowerCase().includes('connect')) return;

        let pollCount = 0;
        const interval = setInterval(async () => {
            pollCount++;
            setIsReconnecting(true);
            const isAlive = await checkHealth();
            if (isAlive) {
                setError(null);
                setIsReconnecting(false);
                clearInterval(interval);
            }
            if (pollCount > 20) setIsReconnecting(false);
        }, 3000);

        return () => clearInterval(interval);
    }, [error]);

    // Auto-process content sent from MRX Forge (converted ACK/RESP text)
    useEffect(() => {
        if (!pendingContent || isLoading) return;

        const loadConvertedContent = async () => {
            setIsLoading(true);
            setError(null);
            setActivePhase('PROCESSING');
            setFileName(pendingContent.fileName);
            setMrxDetected(false);
            setMrxFile(null);

            try {
                const backendResponse = await parseTextOnBackend(pendingContent.text);

                if (backendResponse.detectedSchema === 'INVALID' || backendResponse.detectedSchema === 'MRX') {
                    setError('Converted content could not be parsed as ACK or RESP.');
                    setIsLoading(false);
                    setActivePhase('IDLE');
                    onPendingContentConsumed?.();
                    return;
                }

                setSchema(backendResponse.detectedSchema as 'ACK' | 'RESP');

                const parsedLines: ParsedLine[] = backendResponse.lines.map((l: ParsedLine) => ({
                    ...l,
                    isValid: l.isValid ?? l.valid,
                    fields: l.fields?.map((f: ParsedField) => ({
                        ...f,
                        isValid: f.isValid ?? f.valid
                    }))
                }));

                setContent(backendResponse.rawContent);
                setResult({ lines: parsedLines, summary: backendResponse.summary });
                setHistory([]); // Reset history on new content
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                setError(`Failed to load converted content: ${message}`);
            } finally {
                setIsLoading(false);
                setActivePhase('IDLE');
                onPendingContentConsumed?.();
            }
        };

        loadConvertedContent();
    }, [pendingContent]);

    const handleFieldUpdate = useCallback((lineIdx: number, fieldDef: FieldDefinition, newValue: string) => {
        const trimmedNewValue = newValue.trim();
        if (resultRef.current.lines[lineIdx]?.fields.find(f => f.def.name === fieldDef.name)?.value === newValue) return;

        recordHistory();

        // Calculate the visual row number (only counting Data rows, matching grid display)
        const displayRow = resultRef.current.lines
            .slice(0, lineIdx + 1)
            .filter(l => l.type === 'Data').length;

        // Determine which dependent fields to clear based on the new status value
        let fieldsToClear: string[] = [];
        if (fieldDef.name === 'Status' && trimmedNewValue === 'A') {
            fieldsToClear = ['Reject ID', 'Reject Reason'];
        } else if (fieldDef.name === 'MRx Claim Status' && trimmedNewValue === 'PD') {
            fieldsToClear = ['Denial Code'];
        }

        const fieldsToAutoPopulate: { name: string; value: string }[] = [];
        if (fieldDef.name === 'Reject ID' && schema === 'ACK') {
            const code = ACK_DENIAL_CODES.find(c => c.code === newValue.trim());
            if (code) {
                fieldsToAutoPopulate.push({ name: 'Reject Reason', value: code.short });
            }
        }

        // RESP-specific: delegate all status change logic to backend
        if (fieldDef.name === 'MRx Claim Status' && schema === 'RESP') {
            const currentLineFields = resultRef.current.lines[lineIdx]?.fields || [];
            const apprField = currentLineFields.find(f => f.def.name === 'Units approved');
            const denyField = currentLineFields.find(f => f.def.name === 'Units Denied');
            let trimmedVal = newValue.trim();

            const currentAppr = parseInt(apprField?.value.trim() || '0') || 0;
            const currentDeny = parseInt(denyField?.value.trim() || '0') || 0;
            const totalUnits = currentAppr + currentDeny;

            // Call backend for validation + suggested unit distribution
            validateStatusChange(currentAppr, totalUnits, trimmedVal)
                .then(result => {
                    if (!result.isValid) {
                        // Backend rejected — apply suggested fallback status
                        toast.warning(result.error || 'Status change not allowed', {
                            description: `Row ${displayRow}: Reverted to ${result.suggestedStatus || 'PD'}.`,
                        });
                    } else if (result.suggestedApproved !== undefined && result.suggestedDenied !== undefined) {
                        // Backend approved — apply suggested unit distribution
                        if (result.suggestedApproved !== currentAppr || result.suggestedDenied !== currentDeny) {
                            toast.info(`Units updated for ${trimmedVal}`, {
                                description: `Row ${displayRow}: Approved=${result.suggestedApproved}, Denied=${result.suggestedDenied} (total ${totalUnits}).`,
                            });
                        }
                    }
                })
                .catch(() => { /* Network error — values already applied optimistically */ });

            // Optimistic: apply backend-equivalent logic synchronously for instant UI
            if (currentAppr === 0 && trimmedVal === 'DY') {
                trimmedVal = 'PD';
                newValue = 'PD';
                fieldsToClear = ['Denial Code'];
            } else if (trimmedVal === 'PA' && totalUnits < 2) {
                trimmedVal = 'PD';
                newValue = 'PD';
                fieldsToClear = ['Denial Code'];
            } else if (trimmedVal === 'DY') {
                if (apprField) fieldsToAutoPopulate.push({ name: 'Units approved', value: '0' });
                if (denyField) fieldsToAutoPopulate.push({ name: 'Units Denied', value: totalUnits.toString() });
            } else if (trimmedVal === 'PA') {
                const maxDenied = Math.floor((totalUnits - 1) / 2);
                const newDenied = Math.max(1, Math.min(maxDenied, Math.floor(totalUnits * 0.3)));
                const newApproved = totalUnits - newDenied;
                if (apprField) fieldsToAutoPopulate.push({ name: 'Units approved', value: newApproved.toString() });
                if (denyField) fieldsToAutoPopulate.push({ name: 'Units Denied', value: newDenied.toString() });
            } else if (trimmedVal === 'PD') {
                if (totalUnits > 0) {
                    if (apprField) fieldsToAutoPopulate.push({ name: 'Units approved', value: totalUnits.toString() });
                    if (denyField) fieldsToAutoPopulate.push({ name: 'Units Denied', value: '0' });
                }
            }
        }

        // RESP-specific: delegate partial units correction to backend
        if (schema === 'RESP' && (fieldDef.name === 'Units approved' || fieldDef.name === 'Units Denied')) {
            const currentLineFields = resultRef.current.lines[lineIdx]?.fields || [];
            const statusField = currentLineFields.find(f => f.def.name === 'MRx Claim Status');
            if (statusField?.value.trim() === 'PA') {
                const apprField = currentLineFields.find(f => f.def.name === 'Units approved');
                const denyField = currentLineFields.find(f => f.def.name === 'Units Denied');

                const newAppr = fieldDef.name === 'Units approved'
                    ? (parseInt(trimmedNewValue) || 0)
                    : (parseInt(apprField?.value.trim() || '0') || 0);
                const newDeny = fieldDef.name === 'Units Denied'
                    ? (parseInt(trimmedNewValue) || 0)
                    : (parseInt(denyField?.value.trim() || '0') || 0);
                const totalUnits = newAppr + newDeny;

                // Call backend for validation + auto-correction
                validatePartialUnits(totalUnits, newAppr, newDeny)
                    .then(result => {
                        if (result.wasCorrected && result.correctedApproved !== undefined && result.correctedDenied !== undefined) {
                            toast.warning('Partial claim units auto-adjusted', {
                                description: `Row ${displayRow}: Approved=${result.correctedApproved}, Denied=${result.correctedDenied}.`,
                            });
                            // Apply backend-corrected values via state update
                            setResult(prev => {
                                const newLines = [...prev.lines];
                                const line = { ...newLines[lineIdx] };
                                line.fields = line.fields.map(f => {
                                    if (f.def.name === 'Units approved') {
                                        return { ...f, value: String(result.correctedApproved).padStart(f.def.length, '0') };
                                    }
                                    if (f.def.name === 'Units Denied') {
                                        return { ...f, value: String(result.correctedDenied).padStart(f.def.length, '0') };
                                    }
                                    return f;
                                });
                                newLines[lineIdx] = line;
                                return { ...prev, lines: newLines };
                            });
                        }
                    })
                    .catch(() => { /* Network error — keep user's values */ });
            }
        }

        const applyField = (l: string, def: FieldDefinition, val: string) => {
            let padded = def.type === 'Numeric' ? val.padStart(def.length, '0') : val.padEnd(def.length, ' ');
            padded = padded.slice(0, def.length);
            return l.substring(0, def.start - 1) + padded + l.substring(def.end);
        };

        // Update raw content using resultRef to read field definitions (no stale closure)
        setContent((prevContent: string) => {
            const lines = prevContent.split('\n');
            let line = lines[lineIdx];
            if (!line) return prevContent;

            line = applyField(line, fieldDef, newValue);

            // Use resultRef to get current field definitions for dependent fields
            const currentLineFields = resultRef.current.lines[lineIdx]?.fields || [];

            if (fieldsToClear.length > 0) {
                fieldsToClear.forEach(name => {
                    const targetField = currentLineFields.find(f => f.def.name === name);
                    if (targetField) {
                        line = applyField(line, targetField.def, "");
                    }
                });
            }

            if (fieldsToAutoPopulate.length > 0) {
                fieldsToAutoPopulate.forEach(({ name, value }) => {
                    const targetField = currentLineFields.find(f => f.def.name === name);
                    if (targetField) {
                        line = applyField(line, targetField.def, value);
                    }
                });
            }

            lines[lineIdx] = line;
            return lines.join('\n');
        });

        // Update parsed result state
        setResult((prev: ParseResult) => {
            const newLines = [...prev.lines];
            if (newLines[lineIdx]) {
                const newFields = [...newLines[lineIdx].fields];

                const updateInArray = (fields: ParsedField[], name: string, val: string) => {
                    const idx = fields.findIndex(f => f.def.name === name);
                    if (idx !== -1) {
                        const def = fields[idx].def;
                        let padded = def.type === 'Numeric' ? val.padStart(def.length, '0') : val.padEnd(def.length, ' ');
                        padded = padded.slice(0, def.length);
                        fields[idx] = { ...fields[idx], value: padded };
                    }
                };

                updateInArray(newFields, fieldDef.name, newValue);
                fieldsToClear.forEach(name => updateInArray(newFields, name, ""));
                fieldsToAutoPopulate.forEach(({ name, value }) => updateInArray(newFields, name, value));

                newLines[lineIdx] = { ...newLines[lineIdx], fields: newFields };
            }

            let accepted = prev.summary.accepted;
            let rejected = prev.summary.rejected;

            if (fieldDef.name === 'Status' || fieldDef.name === 'MRx Claim Status') {
                accepted = 0;
                rejected = 0;
                newLines.forEach(l => {
                    if (l.type === 'Data') {
                        const sVal = l.fields.find(f => f.def.name === 'Status' || f.def.name === 'MRx Claim Status')?.value.trim() || "";
                        if (['PD', 'PA', 'A'].includes(sVal)) {
                            accepted++;
                        } else if (['DY', 'R'].includes(sVal)) {
                            rejected++;
                        }
                    }
                });
            }

            return {
                ...prev,
                lines: newLines,
                summary: { ...prev.summary, accepted, rejected }
            };
        });
    }, [schema]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (isLoading) return;

        const files = e.dataTransfer.files;
        if (files.length > 1) {
            toast.warning('Multi-File Drop Inhibited', {
                description: 'Please upload only 1 protocol file at a time for calibration.',
                duration: 4000
            });
            return;
        }

        const file = files[0];
        if (file) processFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading) return;
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const processFile = useCallback(async (file: File) => {
        // Guard: prevent concurrent uploads
        if (isLoading) return;

        setIsLoading(true);
        setFileName(file.name);
        setError(null);
        setActivePhase('UPLOADING');
        setUploadProgress(0);
        setProcessProgress(0);

        try {
            // Simulate upload progress
            setUploadProgress(30);

            // Send file to backend for parsing
            const backendResponse = await parseFileOnBackend(file);

            setUploadProgress(100);
            setActivePhase('PROCESSING');

            // Check if the file type is valid
            if (backendResponse.detectedSchema === 'INVALID') {
                setError('Invalid file format. The file could not be recognized as ACK, RESP, or MRX.');
                setIsLoading(false);
                setActivePhase('IDLE');
                return;
            }

            // Normalize backend response: map 'valid' to 'isValid' if necessary due to JSON serialization
            const parsedLines: ParsedLine[] = backendResponse.lines.map((l: ParsedLine) => ({
                ...l,
                isValid: l.isValid ?? l.valid,
                fields: l.fields?.map((f: ParsedField) => ({
                    ...f,
                    isValid: f.isValid ?? f.valid
                }))
            }));

            const parsedResult = {
                lines: parsedLines,
                summary: backendResponse.summary,
                validationErrors: backendResponse.validationErrors
            };

            // Set the detected schema (backend auto-detected the file type)
            if (backendResponse.detectedSchema === 'MRX') {
                setMrxDetected(true);
                setMrxFile(file);
                setResult(parsedResult); // Allow sidebar to show errors
                setIsLoading(false);
                setActivePhase('IDLE');
                return;
            } else {
                setSchema(backendResponse.detectedSchema as 'ACK' | 'RESP');
            }

            // Simulate processing animation
            const total = backendResponse.lines.length;
            let current = 0;
            const interval = setInterval(() => {
                const chunk = Math.min(500, total - current);
                current += chunk;
                setProcessedLines(current);
                setProcessProgress(Math.round((current / total) * 100));

                if (current >= total) {
                    clearInterval(interval);
                    // Set the raw content for editing/download support
                    setContent(backendResponse.rawContent);
                    // Set the backend parsed result directly
                    setResult(parsedResult);
                    setHistory([]); // Reset history on new file load
                    setTimeout(() => {
                        setIsLoading(false);
                        setActivePhase('IDLE');
                    }, 500);
                }
            }, 50);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.warn('[ACK Visualizer] Backend parsing error:', message);
            setError(
                (err instanceof ApiError && err.isNetworkError)
                    ? err.message
                    : `Processing failed: ${message}`
            );
            setIsLoading(false);
            setActivePhase('IDLE');
        }
    }, [isLoading]);

    const clearContent = () => {
        setContent('');
        setProcessedLines(0);
        setProcessProgress(0);
        setUploadProgress(0);
        setFileName(null);
        setResult(emptyResult);
        setActivePhase('IDLE');
        setMrxDetected(false);
        setMrxFile(null);
        setHistory([]);
    };
    const handleCopy = () => { navigator.clipboard.writeText(content); };

    const downloadString = (str: string, name: string) => {
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

    const handleDownload = () => {
        const downloadName = fileName || `${schema}_EXPORT_${format(new Date(), 'yyyyMMddHHmmss')}.txt`;
        if (content) downloadString(content, downloadName);
    };

    /** Apply RANDOM DENY/PARTIAL (RESP) or RANDOM REJECT (ACK) to eligible data lines. */
    const applyBulkAction = useCallback(() => {
        if (schema !== 'RESP' && schema !== 'ACK') return;
        const pct = Math.max(1, Math.min(100, parseInt(bulkPct) || 30));
        const cnt = parseInt(bulkCount) || 0;
        const mode = bulkPanel.mode;

        // Collect eligible line indices
        const eligibleIdxs: number[] = [];
        result.lines.forEach((line, idx) => {
            if (line.type !== 'Data') return;

            if (schema === 'RESP') {
                const apprField = line.fields.find(f => f.def.name === 'Units approved');
                const apprUnits = parseInt(apprField?.value.trim() || '0') || 0;
                // For RESP, eligible if Units Approved > 1 (cannot deny/partial a single-unit claim)
                if (apprUnits > 1) eligibleIdxs.push(idx);
            } else if (schema === 'ACK') {
                // For ACK, any data claim can be rejected regardless of current status
                eligibleIdxs.push(idx);
            }
        });

        if (eligibleIdxs.length === 0) {
            toast.warning('No eligible lines', {
                description: schema === 'RESP'
                    ? 'All data lines have Units Approved ≤ 1 — cannot apply Deny or Partial.'
                    : 'All data lines are already Accepted or Rejected — cannot apply further rejections.'
            });
            return;
        }

        // Randomly shuffle and pick the requested amount
        const shuffled = [...eligibleIdxs].sort(() => Math.random() - 0.5);
        const targetCount = bulkInputMode === 'CNT'
            ? Math.min(cnt, shuffled.length)
            : Math.max(1, Math.round((pct / 100) * shuffled.length));

        if (targetCount === 0) return;
        const targetIdxs = new Set(shuffled.slice(0, targetCount));

        recordHistory();

        setResult(prev => {
            const newLines = prev.lines.map((line, idx) => {
                if (!targetIdxs.has(idx)) return line;

                const fields = [...line.fields];

                const updateField = (name: string, val: string) => {
                    const i = fields.findIndex(f => f.def.name === name);
                    if (i === -1) return;
                    const def = fields[i].def;
                    const padded = def.type === 'Numeric'
                        ? val.trim().padStart(def.length, '0').slice(0, def.length)
                        : val.trim().padEnd(def.length, ' ').slice(0, def.length);
                    fields[i] = { ...fields[i], value: padded };
                };

                if (schema === 'RESP') {
                    const totalUnits = (parseInt(fields.find(f => f.def.name === 'Units approved')?.value.trim() || '0') || 0)
                        + (parseInt(fields.find(f => f.def.name === 'Units Denied')?.value.trim() || '0') || 0);

                    const getActualCode = () => {
                        if (!randomizeDenyCodes) return bulkDenialCode;
                        return RESP_DENIAL_CODES[Math.floor(Math.random() * RESP_DENIAL_CODES.length)].code;
                    };

                    if (mode === 'DY') {
                        updateField('MRx Claim Status', 'DY');
                        updateField('Units approved', '0');
                        updateField('Units Denied', totalUnits.toString());
                        updateField('Denial Code', getActualCode());
                    } else { // PA
                        const denied = Math.max(1, Math.min(totalUnits - 1, Math.round(totalUnits * 0.3)));
                        const approved = totalUnits - denied;
                        updateField('MRx Claim Status', 'PA');
                        updateField('Units approved', approved.toString());
                        updateField('Units Denied', denied.toString());
                        updateField('Denial Code', getActualCode());
                    }
                } else if (schema === 'ACK') {
                    // For ACK, the mode is always 'R' (Reject)
                    const getActualCode = () => {
                        if (!randomizeDenyCodes) return bulkDenialCode;
                        return ACK_DENIAL_CODES[Math.floor(Math.random() * ACK_DENIAL_CODES.length)].code;
                    };
                    updateField('Status', 'R');
                    updateField('Rejection Code', getActualCode());
                }

                return { ...line, fields };
            });

            // Update RAW content string as well
            setContent(prev => {
                const lines = prev.split('\n');
                newLines.forEach((l, idx) => {
                    if (!targetIdxs.has(idx)) return;
                    let lineStr = lines[idx];
                    if (!lineStr) return;

                    l.fields.forEach(f => {
                        lineStr = lineStr.substring(0, f.def.start - 1) + f.value + lineStr.substring(f.def.end);
                    });
                    lines[idx] = lineStr;
                });
                return lines.join('\n');
            });

            // Recompute summary
            let accepted = 0; let rejected = 0;
            newLines.forEach(l => {
                if (l.type !== 'Data') return;
                const s = l.fields.find(f => f.def.name === (schema === 'RESP' ? 'MRx Claim Status' : 'Status'))?.value.trim() || '';
                if (schema === 'RESP') {
                    if (['PD', 'PA'].includes(s)) accepted++;
                    else if (s === 'DY') rejected++;
                } else {
                    if (s === 'A') accepted++;
                    else if (s === 'R') rejected++;
                }
            });

            return { ...prev, lines: newLines, summary: { ...prev.summary, accepted, rejected } };
        });

        const actionName = mode === 'RJ' ? 'Reject' : (mode === 'DY' ? 'Deny' : 'Partial');
        toast.success(`Bulk ${actionName} applied`, {
            description: `${targetCount} claims updated ${bulkInputMode === 'PCT' ? `(${pct}%)` : ''}.`
        });
        setBulkPanel(p => ({ ...p, open: false }));
    }, [schema, bulkPct, bulkInputMode, bulkCount, randomizeDenyCodes, bulkPanel.mode, bulkDenialCode, result.lines]);


    return (
        <div className="h-full flex bg-background text-foreground font-mono text-sm overflow-hidden">
            <VisualizerSidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                content={content}
                schema={schema}
                isDragging={isDragging}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handleFileInput={handleFileInput}
                fileInputRef={fileInputRef}
                clearContent={clearContent}
                setSchema={setSchema}
                result={result}
                virtuosoRef={virtuosoRef}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-background relative min-h-0">
                {/* Bulk Action Config Panel */}
                {bulkPanel.open && (
                    <div className="absolute top-24 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-b border-border shadow-2xl animate-in slide-in-from-top-4 duration-300">
                        <div className="max-w-4xl mx-auto p-6 flex flex-col md:flex-row items-end gap-6">
                            <div className="flex-1 space-y-3 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-md ${bulkPanel.mode === 'DY' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            <Shuffle className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary shrink-0">
                                        {bulkPanel.mode === 'DY' ? 'Bulk Deny Modification' : 
                                         bulkPanel.mode === 'PA' ? 'Bulk Partial Modification' : 
                                         'Bulk Reject Modification (ACK)'}
                                    </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex bg-muted/40 p-0.5 rounded-md border border-border/10">
                                            <Button 
                                                variant={bulkInputMode === 'PCT' ? 'secondary' : 'ghost'} 
                                                size="sm" 
                                                className="h-6 text-[9px] px-2 font-black uppercase tracking-tighter"
                                                onClick={() => setBulkInputMode('PCT')}
                                            >%</Button>
                                            <Button 
                                                variant={bulkInputMode === 'CNT' ? 'secondary' : 'ghost'} 
                                                size="sm" 
                                                className="h-6 text-[9px] px-2 font-black uppercase tracking-tighter"
                                                onClick={() => setBulkInputMode('CNT')}
                                            >#</Button>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer group select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={randomizeDenyCodes} 
                                                onChange={e => setRandomizeDenyCodes(e.target.checked)}
                                                className="w-3 h-3 rounded-sm border-border bg-transparent text-primary focus:ring-0"
                                            />
                                            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black group-hover:text-foreground transition-colors">Random Codes</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Denial Reason Code</label>
                                        <Select 
                                            value={randomizeDenyCodes ? 'RANDOM' : bulkDenialCode} 
                                            onValueChange={setBulkDenialCode}
                                            disabled={randomizeDenyCodes}
                                        >
                                            <SelectTrigger className="h-10 bg-muted/20 border-border/50 font-bold text-xs w-full disabled:opacity-50">
                                                <SelectValue placeholder={randomizeDenyCodes ? "Randomly Assigned" : "Select Reason"} />
                                            </SelectTrigger>
                                            <SelectContent align="start" className="max-h-[300px]">
                                                {(schema === 'RESP' ? RESP_DENIAL_CODES : ACK_DENIAL_CODES).map(c => (
                                                    <SelectItem key={c.code} value={c.code} className="text-[11px]">
                                                        <span className="font-black text-primary mr-2">{c.code}</span>
                                                        <span className="opacity-70">{c.short}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                {bulkInputMode === 'PCT' ? 'Impact Percentage' : 'Exact Claim Count'}
                                            </label>
                                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                                                {bulkInputMode === 'PCT' ? `${bulkPct}%` : `${bulkCount} claims`}
                                            </span>
                                        </div>
                                        {bulkInputMode === 'PCT' ? (
                                            <div className="flex items-center gap-3 h-10 w-full px-1">
                                                <span className="text-[10px] text-muted-foreground font-bold">1%</span>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="100"
                                                    step="1"
                                                    value={bulkPct}
                                                    onChange={(e) => setBulkPct(e.target.value)}
                                                    className="flex-1 accent-primary h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                                                />
                                                <span className="text-[10px] text-muted-foreground font-bold">100%</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center h-10 w-full relative">
                                                <input
                                                    type="number"
                                                    value={bulkCount}
                                                    onChange={(e) => setBulkCount(e.target.value)}
                                                    className="w-full h-full bg-muted/20 border border-border/50 rounded-md px-3 font-bold text-xs focus:ring-1 focus:ring-primary outline-none"
                                                    min="1"
                                                />
                                                <span className="absolute right-3 text-[10px] text-muted-foreground font-bold uppercase">Target</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto shrink-0 pb-1">
                                <Button
                                    variant="outline"
                                    onClick={() => setBulkPanel(p => ({ ...p, open: false }))}
                                    className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest border-border/50 hover:bg-muted/50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={applyBulkAction}
                                    className={`h-10 px-8 text-[10px] font-bold uppercase tracking-widest shadow-lg transition-all ${
                                        bulkPanel.mode === 'DY'
                                            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                                            : bulkPanel.mode === 'RJ'
                                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                                            : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                                    }`}
                                >
                                    Execute Batch Action
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                <header className="h-24 border-b border-border flex bg-background shrink-0 divide-x divide-border">
                    <div className="flex shrink-0">
                        <StatBox label="Total Records" value={result.lines.filter(l => l.type === 'Data').length.toLocaleString()} icon={Activity} />
                        <StatBox label="Accepted" value={result.summary.accepted.toLocaleString()} icon={Check} colorClass="text-emerald-500" borderClass="border-emerald-500/20" />
                        <StatBox label="Rejected" value={result.summary.rejected.toLocaleString()} icon={AlertTriangle} colorClass={result.summary.rejected > 0 ? "text-amber-500" : "text-muted-foreground"} borderClass={result.summary.rejected > 0 ? "border-amber-500/20 bg-amber-500/5" : ""} />
                        <StatBox label="Schema Fails" value={result.summary.invalid.toLocaleString()} icon={ShieldAlert} colorClass={result.summary.invalid > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={result.summary.invalid > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />
                    </div>

                    <div className="flex-1 flex flex-col justify-center px-4 min-w-0 overflow-hidden group">
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 font-bold">Source Detail</div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                            {fileName ? (
                                <>
                                    <div className="text-[11px] font-black truncate text-foreground leading-tight" title={fileName}>{fileName}</div>
                                    <div className="text-[9px] text-primary/70 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                        {schema} CORE V1.0
                                    </div>
                                </>
                            ) : (
                                <span className="text-[10px] text-muted-foreground italic opacity-40">Ready for data ingestion...</span>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center px-4 gap-2 bg-muted/5">
                        {/* Bulk Action Buttons — RESP only */}
                        {content && (
                            <>
                                {schema === 'RESP' ? (
                                    <>
                                        <button
                                            onClick={() => setBulkPanel(p => ({ open: !p.open || p.mode !== 'DY', mode: 'DY' }))}
                                            className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                bulkPanel.open && bulkPanel.mode === 'DY'
                                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                                    : 'border-rose-500/20 text-rose-500/70 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-400'
                                            }`}
                                            title="Apply random denials to eligible RESP lines"
                                        >
                                            <Shuffle className="w-3.5 h-3.5" />
                                            Rnd Deny
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => setBulkPanel(p => ({ open: !p.open || p.mode !== 'PA', mode: 'PA' }))}
                                            className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                bulkPanel.open && bulkPanel.mode === 'PA'
                                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                                    : 'border-amber-500/20 text-amber-500/70 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-400'
                                            }`}
                                            title="Apply random partial approvals to eligible RESP lines"
                                        >
                                            <Shuffle className="w-3.5 h-3.5" />
                                            Rnd Partial
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </>
                                ) : schema === 'ACK' ? (
                                    <button
                                        onClick={() => setBulkPanel(p => ({ open: !p.open || p.mode !== 'RJ', mode: 'RJ' }))}
                                        className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                            bulkPanel.open && bulkPanel.mode === 'RJ'
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                : 'border-emerald-500/20 text-emerald-500/70 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400'
                                        }`}
                                        title="Apply random rejections to eligible ACK lines"
                                    >
                                        <Shuffle className="w-3.5 h-3.5" />
                                        Rnd Reject
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                ) : null}
                            </>
                        )}
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-9 px-3 text-[10px] font-bold uppercase tracking-wider gap-1.5 transition-all",
                                        history.length > 0 ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={handleUndo}
                                    disabled={history.length === 0}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Undo2 className="w-3.5 h-3.5" />
                                    Undo
                                </Button>
                                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors" onClick={handleCopy} disabled={!content} title="Copy to Clipboard">
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        <Button variant="secondary" size="sm" className="h-10 gap-2 px-6 text-xs font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all border border-primary/20" onClick={handleDownload} disabled={!content}>
                            <Download className="w-4 h-4" /> DOWNLOAD
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                    <LoadingOverlay isLoading={isLoading} activePhase={activePhase} uploadProgress={uploadProgress} processProgress={processProgress} processedLines={processedLines} />

                    <div className="flex-1 w-full bg-muted/10 overflow-hidden relative">
                        {mrxDetected ? (
                            <div className="h-full flex flex-col items-center justify-center w-full p-8 gap-6 animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-2xl opacity-50" />
                                    <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Zap className="w-8 h-8 text-primary" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2 max-w-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">MRX File Detected</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        MRX files cannot be visualized in Data Matrix. Would you like to open it in <span className="text-primary font-bold">MRX Forge</span> instead?
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest"
                                        onClick={() => setMrxDetected(false)}
                                    >
                                        Dismiss
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-9 px-6 text-[10px] font-bold uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                                        onClick={() => {
                                            setMrxDetected(false);
                                            if (mrxFile) onSwitchToMrxForge?.(mrxFile);
                                            setMrxFile(null);
                                        }}
                                    >
                                        Open MRX Forge <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ) : !content ? (
                            <div className="h-full flex flex-col items-center justify-center w-full p-8">
                                {error && (
                                    <ErrorBanner error={error} onDismiss={() => setError(null)} />
                                )}
                            </div>
                        ) : (
                            <GridView
                                result={result}
                                schema={schema}
                                virtuosoRef={virtuosoRef}
                                editingField={editingField}
                                setEditingField={setEditingField}
                                handleFieldUpdate={handleFieldUpdate}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

