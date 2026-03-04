'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { parseFileOnBackend, parseTextOnBackend, ApiError, checkHealth, validateStatusChange, validatePartialUnits } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check, Activity, AlertTriangle, ShieldAlert, Copy, Download, ArrowRight, Zap, Shuffle, ChevronDown, Undo2, FileText } from 'lucide-react';
import { ParseResult, ParsedLine, FieldDefinition, ParsedField } from '@/lib/types';
import { ACK_DENIAL_CODES, RESP_DENIAL_CODES, SCHEMAS, ACK_STATUS, RESP_STATUS, LINE_TYPES, FIELD_NAMES } from '@/lib/constants';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn, normalizeSummary, downloadString } from '@/lib/utils';

// Extracted Components
import { StatBox } from './visualizer/stat-box';
import { VisualizerSidebar } from './visualizer/sidebar';
import { LoadingOverlay } from './visualizer/loading-overlay';
import { GridView } from './visualizer/grid-view';
import { SimulationHUD } from './visualizer/simulation-hud';
import { ErrorBanner } from './visualizer/error-banner';

const emptyResult: ParseResult = { lines: [], summary: { total: 0, totalClaims: 0, valid: 0, invalid: 0, accepted: 0, rejected: 0, partial: 0 } };

export function UniversalVisualizer({ onSwitchToMrxForge, pendingContent, onPendingContentConsumed }: {
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
    const [schema, setSchema] = useState<'ACK' | 'RESP' | 'MRX'>(SCHEMAS.ACK as 'ACK' | 'RESP' | 'MRX');
    const [isDragging, setIsDragging] = useState(false);

    // Bulk action panel state
    const [bulkPanel, setBulkPanel] = useState<{ open: boolean; mode: 'DY' | 'PA' | 'R' }>({
        open: false, mode: RESP_STATUS.DENIED as 'DY'
    });
    const [bulkPct, setBulkPct] = useState('5');
    const [bulkInputMode, setBulkInputMode] = useState<'PCT' | 'CNT'>('CNT');
    const [bulkCount, setBulkCount] = useState('1');
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

    const dataLineCount = useMemo(() => result.lines.filter(l => l.type === LINE_TYPES.DATA).length, [result.lines]);

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

                if (backendResponse.detectedSchema === SCHEMAS.INVALID || backendResponse.detectedSchema === SCHEMAS.MRX) {
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
                setResult({
                    ...backendResponse,
                    summary: normalizeSummary(backendResponse.summary),
                    lines: parsedLines
                });
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
            .filter(l => l.type === LINE_TYPES.DATA).length;

        // Determine which dependent fields to clear based on the new status value
        let fieldsToClear: string[] = [];
        if (fieldDef.name === FIELD_NAMES.STATUS && trimmedNewValue === ACK_STATUS.ACCEPTED) {
            fieldsToClear = [FIELD_NAMES.REJECT_ID, FIELD_NAMES.REJECT_REASON];
        } else if (fieldDef.name === FIELD_NAMES.MRX_CLAIM_STATUS && trimmedNewValue === RESP_STATUS.PAID) {
            fieldsToClear = [FIELD_NAMES.DENIAL_CODE];
        }

        const fieldsToAutoPopulate: { name: string; value: string }[] = [];
        if (fieldDef.name === FIELD_NAMES.REJECT_ID && schema === SCHEMAS.ACK) {
            const code = ACK_DENIAL_CODES.find(c => c.code === newValue.trim());
            if (code) {
                fieldsToAutoPopulate.push({ name: FIELD_NAMES.REJECT_REASON, value: code.short });
            }
        }

        // RESP-specific: delegate all status change logic to backend
        if (fieldDef.name === FIELD_NAMES.MRX_CLAIM_STATUS && schema === SCHEMAS.RESP) {
            const currentLineFields = resultRef.current.lines[lineIdx]?.fields || [];
            const apprField = currentLineFields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED);
            const denyField = currentLineFields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED);
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
                            description: `Row ${displayRow}: Reverted to ${result.suggestedStatus || RESP_STATUS.PAID}.`,
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
            if (currentAppr === 0 && trimmedVal === RESP_STATUS.DENIED) {
                trimmedVal = RESP_STATUS.PAID;
                newValue = RESP_STATUS.PAID;
                fieldsToClear = [FIELD_NAMES.DENIAL_CODE];
            } else if (trimmedVal === RESP_STATUS.PARTIAL && totalUnits < 2) {
                trimmedVal = RESP_STATUS.PAID;
                newValue = RESP_STATUS.PAID;
                fieldsToClear = [FIELD_NAMES.DENIAL_CODE];
            } else if (trimmedVal === RESP_STATUS.DENIED) {
                if (apprField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_APPROVED, value: '0' });
                if (denyField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_DENIED, value: totalUnits.toString() });
            } else if (trimmedVal === RESP_STATUS.PARTIAL) {
                const maxDenied = Math.floor((totalUnits - 1) / 2);
                const newDenied = Math.max(1, Math.min(maxDenied, Math.floor(totalUnits * 0.3)));
                const newApproved = totalUnits - newDenied;
                if (apprField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_APPROVED, value: newApproved.toString() });
                if (denyField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_DENIED, value: newDenied.toString() });
            } else if (trimmedVal === RESP_STATUS.PAID) {
                if (totalUnits > 0) {
                    if (apprField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_APPROVED, value: totalUnits.toString() });
                    if (denyField) fieldsToAutoPopulate.push({ name: FIELD_NAMES.UNITS_DENIED, value: '0' });
                }
            }
        }

        // RESP-specific: delegate partial units correction to backend
        if (schema === SCHEMAS.RESP && (fieldDef.name === FIELD_NAMES.UNITS_APPROVED || fieldDef.name === FIELD_NAMES.UNITS_DENIED)) {
            const currentLineFields = resultRef.current.lines[lineIdx]?.fields || [];
            const statusField = currentLineFields.find(f => f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS);
            if (statusField?.value.trim() === RESP_STATUS.PARTIAL) {
                const apprField = currentLineFields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED);
                const denyField = currentLineFields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED);

                const newAppr = fieldDef.name === FIELD_NAMES.UNITS_APPROVED
                    ? (parseInt(trimmedNewValue) || 0)
                    : (parseInt(apprField?.value.trim() || '0') || 0);
                const newDeny = fieldDef.name === FIELD_NAMES.UNITS_DENIED
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
                                    if (f.def.name === FIELD_NAMES.UNITS_APPROVED) {
                                        return { ...f, value: String(result.correctedApproved).padStart(f.def.length, '0') };
                                    }
                                    if (f.def.name === FIELD_NAMES.UNITS_DENIED) {
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
        if (content) {
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
        }

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
            let partial = prev.summary.partial;

            if (fieldDef.name === FIELD_NAMES.STATUS || fieldDef.name === FIELD_NAMES.MRX_CLAIM_STATUS) {
                accepted = 0;
                rejected = 0;
                partial = 0;
                newLines.forEach(l => {
                    if (l.type === LINE_TYPES.DATA) {
                        const sVal = l.fields.find(f => f.def.name === FIELD_NAMES.STATUS || f.def.name === FIELD_NAMES.MRX_CLAIM_STATUS)?.value.trim() || "";
                        if (schema === SCHEMAS.RESP) {
                            if (sVal === RESP_STATUS.PAID) accepted++;
                            else if (sVal === RESP_STATUS.PARTIAL) partial++;
                            else if (sVal === RESP_STATUS.DENIED) rejected++;
                        } else {
                            if (sVal === ACK_STATUS.ACCEPTED) accepted++;
                            else if (sVal === ACK_STATUS.REJECTED) rejected++;
                        }
                    }
                });
            }

            return { ...prev, lines: newLines, summary: { ...prev.summary, accepted, rejected, partial } };
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
        const file = e.target.files?.[0];
        // Reset so selecting the same file again always fires onChange
        e.target.value = '';
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
            if (backendResponse.detectedSchema === SCHEMAS.INVALID) {
                setError('Invalid file format. The file could not be recognized as ACK, RESP, or MRX.');
                setIsLoading(false);
                setActivePhase('IDLE');
                return;
            }

            // Normalize backend response: map 'valid' to 'isValid' — guard against null fields arrays
            const parsedLines: ParsedLine[] = backendResponse.lines.map((l: ParsedLine) => ({
                ...l,
                isValid: l.isValid ?? l.valid,
                fields: (l.fields ?? []).map((f: ParsedField) => ({
                    ...f,
                    isValid: f.isValid ?? f.valid
                }))
            }));

            // Set the detected schema (backend auto-detected the file type)
            if (backendResponse.detectedSchema === SCHEMAS.MRX) {
                setMrxDetected(false);
                setMrxFile(file);
                setSchema(SCHEMAS.MRX as 'MRX');
            } else {
                setSchema(backendResponse.detectedSchema as 'ACK' | 'RESP');
            }

            // ✅ Set result and content IMMEDIATELY so the grid renders right away
            setContent(backendResponse.rawContent ?? '');
            setResult({
                ...backendResponse,
                summary: normalizeSummary(backendResponse.summary),
                lines: parsedLines
            });
            setHistory([]);

            // Cosmetic progress animation (does NOT gate rendering)
            const total = parsedLines.length;
            if (total > 0) {
                let current = 0;
                const interval = setInterval(() => {
                    const chunk = Math.min(500, total - current);
                    current += chunk;
                    setProcessedLines(current);
                    setProcessProgress(Math.round((current / total) * 100));
                    if (current >= total) {
                        clearInterval(interval);
                        setTimeout(() => {
                            setIsLoading(false);
                            setActivePhase('IDLE');
                        }, 300);
                    }
                }, 50);
            } else {
                setIsLoading(false);
                setActivePhase('IDLE');
            }
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
        // Reuse the MRX timestamp embedded in the loaded file name so ACK/RESP
        // downloads always share the same timestamp as the originating MRX file.
        // Match any 10+ digit numeric run — covers 13-digit and 14-digit (ccyymmddhhmmss) timestamps
        const tsMatch = fileName?.match(/\d{10,}/);
        const ts = tsMatch ? tsMatch[0] : format(new Date(), 'yyyyMMddHHmmss');
        const downloadName = fileName || `${schema}_EXPORT_${ts}.txt`;
        if (content) {
            downloadString(content, downloadName);
        } else {
            toast.error('Export Failed', {
                description: 'Raw source content was stripped by the backend due to file size. Only grid editing is available for this file.'
            });
        }
    };

    /** Apply RANDOM DENY/PARTIAL (RESP) or RANDOM REJECT (ACK) to eligible data lines. */
    const applyBulkAction = useCallback(() => {
        if (schema !== SCHEMAS.RESP && schema !== SCHEMAS.ACK) return;
        const pct = Math.max(1, Math.min(100, parseInt(bulkPct) || 30));
        const cnt = parseInt(bulkCount) || 0;
        const mode = bulkPanel.mode;

        // Collect eligible line indices
        const eligibleIdxs: number[] = [];
        result.lines.forEach((line, idx) => {
            if (line.type !== LINE_TYPES.DATA) return;

            if (schema === SCHEMAS.RESP) {
                const apprField = line.fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED);
                const apprUnits = parseInt(apprField?.value.trim() || '0') || 0;
                // For RESP, eligible if Units Approved > 1 (cannot deny/partial a single-unit claim)
                if (apprUnits > 1) eligibleIdxs.push(idx);
            } else if (schema === SCHEMAS.ACK) {
                // For ACK, any data claim can be rejected regardless of current status
                eligibleIdxs.push(idx);
            }
        });

        if (eligibleIdxs.length === 0) {
            toast.warning('No eligible lines', {
                description: schema === SCHEMAS.RESP
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

                if (schema === SCHEMAS.RESP) {
                    const totalUnits = (parseInt(fields.find(f => f.def.name === FIELD_NAMES.UNITS_APPROVED)?.value.trim() || '0') || 0)
                        + (parseInt(fields.find(f => f.def.name === FIELD_NAMES.UNITS_DENIED)?.value.trim() || '0') || 0);

                    const getActualCode = () => {
                        if (!randomizeDenyCodes) return bulkDenialCode;
                        return RESP_DENIAL_CODES[Math.floor(Math.random() * RESP_DENIAL_CODES.length)].code;
                    };

                    if (mode === RESP_STATUS.DENIED) {
                        updateField(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.DENIED);
                        updateField(FIELD_NAMES.UNITS_APPROVED, '0');
                        updateField(FIELD_NAMES.UNITS_DENIED, totalUnits.toString());
                        updateField(FIELD_NAMES.DENIAL_CODE, getActualCode());
                    } else { // PA
                        const denied = Math.max(1, Math.min(totalUnits - 1, Math.round(totalUnits * 0.3)));
                        const approved = totalUnits - denied;
                        updateField(FIELD_NAMES.MRX_CLAIM_STATUS, RESP_STATUS.PARTIAL);
                        updateField(FIELD_NAMES.UNITS_APPROVED, approved.toString());
                        updateField(FIELD_NAMES.UNITS_DENIED, denied.toString());
                        updateField(FIELD_NAMES.DENIAL_CODE, getActualCode());
                    }
                } else if (schema === SCHEMAS.ACK) {
                    // For ACK, the mode is always 'R' (Reject)
                    const getActualCode = () => {
                        if (!randomizeDenyCodes) return bulkDenialCode;
                        return ACK_DENIAL_CODES[Math.floor(Math.random() * ACK_DENIAL_CODES.length)].code;
                    };
                    updateField(FIELD_NAMES.STATUS, ACK_STATUS.REJECTED);
                    updateField(FIELD_NAMES.REJECTION_CODE, getActualCode());
                }

                return { ...line, fields };
            });

            // Update RAW content string as well
            if (content) {
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
            }

            // Recompute summary
            let accepted = 0; let rejected = 0; let partial = 0;
            newLines.forEach(l => {
                if (l.type !== LINE_TYPES.DATA) return;
                const s = l.fields.find(f => f.def.name === (schema === SCHEMAS.RESP ? FIELD_NAMES.MRX_CLAIM_STATUS : FIELD_NAMES.STATUS))?.value.trim() || '';
                if (schema === SCHEMAS.RESP) {
                    if (s === RESP_STATUS.PAID) accepted++;
                    else if (s === RESP_STATUS.PARTIAL) partial++;
                    else if (s === RESP_STATUS.DENIED) rejected++;
                } else {
                    if (s === ACK_STATUS.ACCEPTED) accepted++;
                    else if (s === ACK_STATUS.REJECTED) rejected++;
                }
            });

            return { ...prev, lines: newLines, summary: { ...prev.summary, accepted, rejected, partial } };
        });

        const actionName = mode === ACK_STATUS.REJECTED ? 'Reject' : (mode === RESP_STATUS.DENIED ? 'Deny' : 'Partial');
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
                fileName={fileName}
            />

            <main className="flex-1 flex flex-col min-w-0 bg-background relative min-h-0">
                <SimulationHUD
                    open={bulkPanel.open}
                    mode={bulkPanel.mode}
                    schema={schema}
                    bulkInputMode={bulkInputMode}
                    bulkPct={bulkPct}
                    bulkCount={bulkCount}
                    randomizeDenyCodes={randomizeDenyCodes}
                    bulkDenialCode={bulkDenialCode}
                    setBulkPanel={setBulkPanel}
                    setBulkInputMode={setBulkInputMode}
                    setBulkPct={setBulkPct}
                    setBulkCount={setBulkCount}
                    setRandomizeDenyCodes={setRandomizeDenyCodes}
                    setBulkDenialCode={setBulkDenialCode}
                    applyBulkAction={applyBulkAction}
                />
                <header className="h-[54px] border-b border-border flex bg-background shrink-0 divide-x divide-border overflow-hidden relative">
                    {/* Header Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.015] bg-[radial-gradient(#80808044_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                    <div className="flex-1 flex relative z-10">
                        <StatBox label="Records" value={dataLineCount.toLocaleString()} icon={Activity} />
                        <StatBox label="Claims" value={result.summary.totalClaims.toLocaleString()} icon={FileText} colorClass="text-primary" />
                        <StatBox label="Accepted" value={result.summary.accepted.toLocaleString()} icon={Check} colorClass="text-emerald-500" borderClass="border-emerald-500/20" />
                        {schema === SCHEMAS.RESP && (
                            <StatBox label="Partial" value={result.summary.partial.toLocaleString()} icon={Shuffle} colorClass="text-amber-500" borderClass="border-amber-500/20" />
                        )}
                        <StatBox label="Rejected" value={result.summary.rejected.toLocaleString()} icon={AlertTriangle} colorClass={result.summary.rejected > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={result.summary.rejected > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />
                        <StatBox label="Issues" value={result.summary.invalid.toLocaleString()} icon={ShieldAlert} colorClass={result.summary.invalid > 0 ? "text-rose-500" : "text-muted-foreground"} borderClass={result.summary.invalid > 0 ? "border-rose-500/20 bg-rose-500/5" : ""} />
                    </div>

                    <div className="flex flex-none items-center justify-end px-4 gap-4 bg-muted/5 relative z-10 min-w-0">
                        {/* Action Tools Group */}
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50 shrink-0">
                            {content && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setBulkPanel(p => ({ ...p, open: !p.open }))}
                                        className={cn(
                                            "h-7 px-3 flex items-center gap-2 rounded-none text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm",
                                            bulkPanel.open
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "border-primary/30 text-primary hover:bg-primary/10 hover:border-primary"
                                        )}
                                    >
                                        <Shuffle className="w-2.5 h-2.5" />
                                        Batch Engine
                                        <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", bulkPanel.open && "rotate-180")} />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-7 px-2 rounded-none text-[9px] font-black uppercase tracking-widest gap-1.5 transition-all border border-transparent",
                                        history.length > 0 ? "text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20" : "text-muted-foreground opacity-30 px-1"
                                    )}
                                    onClick={handleUndo}
                                    disabled={history.length === 0}
                                    title="Undo Movement"
                                >
                                    <Undo2 className="w-3 h-3" />
                                    {history.length > 0 && "Undo"}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0 rounded-none hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20" 
                                    onClick={handleCopy} 
                                    disabled={!content} 
                                    title="Copy Source"
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>

                        <Button 
                            variant="default" 
                            className="h-8 gap-2 px-4 rounded-none text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_-5px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_20px_-5px_rgba(var(--primary-rgb),0.5)] transition-all bg-primary hover:bg-primary/90 text-primary-foreground group shrink-0" 
                            onClick={handleDownload} 
                            disabled={result.lines.length === 0}
                        >
                            <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" /> 
                            Export
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                    <LoadingOverlay isLoading={isLoading} activePhase={activePhase} uploadProgress={uploadProgress} processProgress={processProgress} processedLines={processedLines} />

                    <div className="flex-1 w-full bg-muted/10 overflow-hidden relative">
                        {result.lines.length === 0 ? (
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

