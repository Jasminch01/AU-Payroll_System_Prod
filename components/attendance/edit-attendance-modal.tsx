"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, apiPost, apiDelete } from "@/lib/api-client";
import { X, AlertCircle, CheckCircle, Clock, Save, PlusCircle, Trash2, Coffee, Plus } from "lucide-react";
import { createBusinessTimestamp, getDateTimeForInput } from "@/lib/timezone-utils";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { cn } from "@/lib/utils";

interface EditAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: any; // Now contains session info
    role?: string;
    fromDate?: string;
    toDate?: string;
}

interface BreakState {
    tempId: string;
    start: { date: string; time: string; log_id?: string };
    end: { date: string; time: string; log_id?: string };
}

const TIME_OPTIONS = [
    ...Array.from({ length: 24 * 60 }, (_, i) => {
        const hours = Math.floor(i / 60).toString().padStart(2, "0");
        const minutes = (i % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    })
];

export function EditAttendanceModal({
    isOpen,
    onClose,
    log,
    role,
    fromDate,
    toDate,
}: EditAttendanceModalProps) {
    const queryClient = useQueryClient();
    const { businessTimezone } = useBusinessTimezone();

    // Identify logs in the session
    const logs = log?.all_logs || [log];
    const clockInLog = logs.find((l: any) => l.event_type === 'CLOCK_IN');
    const clockOutLog = logs.find((l: any) => l.event_type === 'CLOCK_OUT');

    const inData = clockInLog ? getDateTimeForInput(clockInLog.timestamp, businessTimezone) : { date: "", time: "" };
    const outData = clockOutLog ? getDateTimeForInput(clockOutLog.timestamp, businessTimezone) : { date: inData.date, time: "" };

    const [inForm, setInForm] = useState({ date: inData.date, time: inData.time });
    const [outForm, setOutForm] = useState({ date: outData.date, time: outData.time, exists: !!clockOutLog });
    
    // Breaks logic
    const initialBreaks: BreakState[] = [];
    const sortedBreakLogs = logs
        .filter((l: any) => l.event_type === 'BREAK_START' || l.event_type === 'BREAK_END')
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const consumedLogIds = new Set<string>();
    for (let i = 0; i < sortedBreakLogs.length; i++) {
        const startLog = sortedBreakLogs[i];
        if (startLog.event_type === 'BREAK_START' && !consumedLogIds.has(startLog.log_id)) {
            consumedLogIds.add(startLog.log_id);
            const endLog = sortedBreakLogs.find((l: any, idx: number) => idx > i && l.event_type === 'BREAK_END' && !consumedLogIds.has(l.log_id));
            if (endLog) consumedLogIds.add(endLog.log_id);

            const startDt = getDateTimeForInput(startLog.timestamp, businessTimezone);
            const endDt = endLog ? getDateTimeForInput(endLog.timestamp, businessTimezone) : { date: startDt.date, time: "" };

            initialBreaks.push({
                tempId: Math.random().toString(36).substr(2, 9),
                start: { ...startDt, log_id: startLog.log_id },
                end: { ...endDt, log_id: endLog?.log_id }
            });
        }
    }

    const [breaks, setBreaks] = useState<BreakState[]>(initialBreaks);
    const [deletedLogIds, setDeletedLogIds] = useState<string[]>([]);
    const [overrideReason, setOverrideReason] = useState(log?.override_reason || "");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [timeSearch, setTimeSearch] = useState("");
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const mutation = useMutation({
        mutationFn: async () => {
            // 1. Update Clock In
            if (clockInLog) {
                const inTs = createBusinessTimestamp(inForm.date, inForm.time, businessTimezone);
                await apiPatch(`/attendance/${clockInLog.log_id}`, {
                    timestamp: inTs,
                    override_reason: overrideReason
                });
            }

            // 2. Update or Create Clock Out
            if (outForm.time) {
                const outTs = createBusinessTimestamp(outForm.date, outForm.time, businessTimezone);
                if (clockOutLog) {
                    await apiPatch(`/attendance/${clockOutLog.log_id}`, {
                        timestamp: outTs,
                        override_reason: overrideReason
                    });
                } else {
                    await apiPost(`/attendance`, {
                        employee_id: log.employee_id,
                        event_type: 'CLOCK_OUT',
                        timestamp: outTs,
                        override_reason: overrideReason,
                        device_info: 'Manual (Edit Session)'
                    });
                }
            } else if (clockOutLog) {
                // If it existed but was cleared
                await apiDelete(`/attendance/${clockOutLog.log_id}`);
            }

            // 3. Handle Breaks
            for (const b of breaks) {
                const startTs = createBusinessTimestamp(b.start.date, b.start.time, businessTimezone);
                if (b.start.log_id) {
                    await apiPatch(`/attendance/${b.start.log_id}`, {
                        timestamp: startTs,
                        override_reason: overrideReason
                    });
                } else {
                    await apiPost(`/attendance`, {
                        employee_id: log.employee_id,
                        event_type: 'BREAK_START',
                        timestamp: startTs,
                        override_reason: overrideReason,
                        device_info: 'Manual (Edit Session)'
                    });
                }

                if (b.end.time) {
                    const endTs = createBusinessTimestamp(b.end.date, b.end.time, businessTimezone);
                    if (b.end.log_id) {
                        await apiPatch(`/attendance/${b.end.log_id}`, {
                            timestamp: endTs,
                            override_reason: overrideReason
                        });
                    } else {
                        await apiPost(`/attendance`, {
                            employee_id: log.employee_id,
                            event_type: 'BREAK_END',
                            timestamp: endTs,
                            override_reason: overrideReason,
                            device_info: 'Manual (Edit Session)'
                        });
                    }
                } else if (b.end.log_id) {
                    await apiDelete(`/attendance/${b.end.log_id}`);
                }
            }

            // 4. Handle Deletions
            if (deletedLogIds.length > 0) {
                await Promise.all(deletedLogIds.map(id => apiDelete(`/attendance/${id}`)));
            }
        },
        onSuccess: () => {
            setSuccess("Attendance session updated successfully");
            queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });
            setTimeout(() => {
                onClose();
                setSuccess("");
            }, 1500);
        },
        onError: (err: Error) => {
            setError(err.message || "Failed to update session");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const promises = logs.map((l: any) => apiDelete(`/attendance/${l.log_id}`));
            await Promise.all(promises);
        },
        onSuccess: () => {
            setSuccess("Attendance session deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });
            setTimeout(() => {
                onClose();
                setSuccess("");
            }, 1500);
        },
        onError: (err: Error) => {
            setError(err.message || "Failed to delete session");
        }
    });

    const handleDelete = () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        deleteMutation.mutate();
        setIsDeleteConfirmOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!overrideReason) {
            setError("Please provide a reason for this override");
            return;
        }
        mutation.mutate();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className="relative w-full max-w-md rounded-2xl bg-[hsl(var(--background))] p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-[hsl(var(--warning))] p-6 text-[hsl(var(--warning-foreground))]">
                    <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-black/10 transition-colors">
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={22} />
                        Edit Session
                    </h2>
                    <p className="text-sm opacity-80 mt-1">Employee: <span className="font-bold">{log.Employee?.first_name} {log.Employee?.last_name}</span></p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs flex items-center gap-2"><CheckCircle size={14} />{success}</div>}

                    {/* Clock In Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Clock In Time</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={inForm.date}
                                onChange={e => setInForm({ ...inForm, date: e.target.value })}
                                className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            />
                            <div className="relative w-32">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'in' ? null : 'in')}
                                    className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm flex items-center justify-between"
                                >
                                    <span>{inForm.time || "--:--"}</span>
                                    <Clock size={14} className="opacity-40" />
                                </button>
                                {activeDropdown === 'in' && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                        <div className="absolute top-12 right-0 w-40 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                                            <div className="p-2 border-b bg-[hsl(var(--muted))]/30 sticky top-0">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={timeSearch}
                                                    onChange={e => setTimeSearch(e.target.value)}
                                                    className="w-full h-8 px-2 text-[10px] rounded-md border bg-[hsl(var(--background))]"
                                                />
                                            </div>
                                            <div className="max-h-36 overflow-y-auto p-1">
                                                {(() => {
                                                    const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                    const currentIndex = filtered.indexOf(inForm.time);
                                                    const rotated = currentIndex > 0 
                                                        ? [...filtered.slice(currentIndex), ...filtered.slice(0, currentIndex)]
                                                        : filtered;
                                                    
                                                    return rotated.map(t => (
                                                        <button key={t} type="button" onClick={() => { setInForm({ ...inForm, time: t }); setActiveDropdown(null); setTimeSearch(""); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] rounded-md">{t}</button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Breaks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/50 pb-2">
                            <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest flex items-center gap-1.5">
                                <Coffee size={14} className="text-[hsl(var(--brand))]" />
                                Breaks
                            </label>
                            <button
                                type="button"
                                onClick={() => setBreaks([...breaks, { tempId: Math.random().toString(36).substr(2, 9), start: { date: inForm.date, time: "" }, end: { date: inForm.date, time: "" } }])}
                                className="text-[10px] font-bold text-[hsl(var(--brand))] flex items-center gap-1 hover:opacity-70 transition-opacity"
                            >
                                <Plus size={12} /> Add Break
                            </button>
                        </div>

                        {breaks.length === 0 ? (
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic text-center py-2">No breaks recorded</p>
                        ) : (
                            <div className="space-y-4">
                                {breaks.map((b, idx) => (
                                    <div key={b.tempId} className="p-3 rounded-xl bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))]/50 relative group">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (b.start.log_id) setDeletedLogIds(prev => [...prev, b.start.log_id!]);
                                                if (b.end.log_id) setDeletedLogIds(prev => [...prev, b.end.log_id!]);
                                                setBreaks(breaks.filter((_, i) => i !== idx));
                                            }}
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-red-100 text-red-500 flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={12} />
                                        </button>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] uppercase">Start</span>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveDropdown(activeDropdown === `break-${idx}-start` ? null : `break-${idx}-start`)}
                                                        className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-xs flex items-center justify-between"
                                                    >
                                                        <span>{b.start.time || "--:--"}</span>
                                                        <Clock size={12} className="opacity-40" />
                                                    </button>
                                                    {activeDropdown === `break-${idx}-start` && (
                                                        <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                                            <div className="absolute top-10 left-0 w-32 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                                                                <div className="p-1.5 border-b bg-[hsl(var(--muted))]/30">
                                                                    <input autoFocus type="text" placeholder="Search..." value={timeSearch} onChange={e => setTimeSearch(e.target.value)} className="w-full h-7 px-2 text-[10px] rounded border bg-[hsl(var(--background))]" />
                                                                </div>
                                                                <div className="max-h-32 overflow-y-auto p-1">
                                                                    {(() => {
                                                                        const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                                        const currentIndex = filtered.indexOf(b.start.time);
                                                                        const rotated = currentIndex > 0 ? [...filtered.slice(currentIndex), ...filtered.slice(0, currentIndex)] : filtered;
                                                                        return rotated.map(t => (
                                                                            <button key={t} type="button" onClick={() => { 
                                                                                const newBreaks = [...breaks];
                                                                                newBreaks[idx].start.time = t;
                                                                                setBreaks(newBreaks);
                                                                                setActiveDropdown(null);
                                                                                setTimeSearch("");
                                                                            }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] rounded">{t}</button>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-[hsl(var(--muted-foreground))] uppercase">End</span>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveDropdown(activeDropdown === `break-${idx}-end` ? null : `break-${idx}-end`)}
                                                        className="w-full h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-xs flex items-center justify-between"
                                                    >
                                                        <span>{b.end.time || "--:--"}</span>
                                                        <Clock size={12} className="opacity-40" />
                                                    </button>
                                                    {activeDropdown === `break-${idx}-end` && (
                                                        <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                                            <div className="absolute top-10 left-0 w-32 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                                                                <div className="p-1.5 border-b bg-[hsl(var(--muted))]/30">
                                                                    <input autoFocus type="text" placeholder="Search..." value={timeSearch} onChange={e => setTimeSearch(e.target.value)} className="w-full h-7 px-2 text-[10px] rounded border bg-[hsl(var(--background))]" />
                                                                </div>
                                                                <div className="max-h-32 overflow-y-auto p-1">
                                                                    {(() => {
                                                                        const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                                        const currentIndex = filtered.indexOf(b.end.time);
                                                                        const rotated = currentIndex > 0 ? [...filtered.slice(currentIndex), ...filtered.slice(0, currentIndex)] : filtered;
                                                                        return rotated.map(t => (
                                                                            <button key={t} type="button" onClick={() => { 
                                                                                const newBreaks = [...breaks];
                                                                                newBreaks[idx].end.time = t;
                                                                                setBreaks(newBreaks);
                                                                                setActiveDropdown(null);
                                                                                setTimeSearch("");
                                                                            }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] rounded">{t}</button>
                                                                        ));
                                                                    })()}
                                                                 </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clock Out Section */}
                    <div className="space-y-3 pt-2 border-t border-[hsl(var(--border))]/50">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Clock Out Time</label>
                            {!outForm.exists && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Missing</span>}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={outForm.date}
                                onChange={e => setOutForm({ ...outForm, date: e.target.value })}
                                className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            />
                            <div className="relative w-32">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'out' ? null : 'out')}
                                    className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm flex items-center justify-between"
                                >
                                    <span>{outForm.time || "--:--"}</span>
                                    {outForm.exists ? <Clock size={14} className="opacity-40" /> : <PlusCircle size={14} className="text-orange-500" />}
                                </button>
                                {activeDropdown === 'out' && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                        <div className="absolute top-12 right-0 w-40 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                                            <div className="p-2 border-b bg-[hsl(var(--muted))]/30 sticky top-0">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={timeSearch}
                                                    onChange={e => setTimeSearch(e.target.value)}
                                                    className="w-full h-8 px-2 text-[10px] rounded-md border bg-[hsl(var(--background))]"
                                                />
                                            </div>
                                            <div className="max-h-36 overflow-y-auto p-1">
                                                {(() => {
                                                    const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                    const currentIndex = filtered.indexOf(outForm.time);
                                                    const rotated = currentIndex > 0 
                                                        ? [...filtered.slice(currentIndex), ...filtered.slice(0, currentIndex)]
                                                        : filtered;
                                                    
                                                    return rotated.map(t => (
                                                        <button key={t} type="button" onClick={() => { setOutForm({ ...outForm, time: t }); setActiveDropdown(null); setTimeSearch(""); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] rounded-md">{t}</button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Override Reason <span className="text-red-500">*</span></label>
                        <textarea
                            value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            placeholder="Reason for editing this session..."
                            className="w-full p-3 rounded-xl border bg-[hsl(var(--card))] text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3">
                        {role === 'owner' && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={mutation.isPending || deleteMutation.isPending}
                                className="flex-1 h-12 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                            >
                                {deleteMutation.isPending ? "Deleting..." : "Delete Session"}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={mutation.isPending || deleteMutation.isPending}
                            className={cn(
                                "h-12 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2",
                                role === 'owner' ? "flex-2 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]" : "w-full bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"
                            )}
                        >
                            {mutation.isPending ? "Saving Changes..." : <><Save size={18} /> Update Session</>}
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Attendance Session?"
                description="Are you sure you want to delete this entire session? This will remove all clock-in, clock-out, and break logs for this period. This action cannot be undone."
                confirmLabel="Delete Everything"
                cancelLabel="Keep Session"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
}
