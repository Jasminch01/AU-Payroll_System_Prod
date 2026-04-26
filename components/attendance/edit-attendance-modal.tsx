"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, apiPost, apiDelete } from "@/lib/api-client";
import { EventType, AttendanceLog } from "@/types/database";
import { X, AlertCircle, CheckCircle, Clock, Save, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBusinessTimestamp, getDateTimeForInput } from "@/lib/timezone-utils";
import { useBusinessTimezone } from "@/lib/timezone-context";

interface EditAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: any; // Now contains session info
    fromDate?: string;
    toDate?: string;
}

const TIME_OPTIONS = [
    ...Array.from({ length: 23 * 60 }, (_, i) => {
        const totalMinutes = (i + 60);
        const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
        const minutes = (totalMinutes % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    }),
    "24:00"
];

export function EditAttendanceModal({
    isOpen,
    onClose,
    log,
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
    const [overrideReason, setOverrideReason] = useState(log?.override_reason || "");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    const [activeDropdown, setActiveDropdown] = useState<'in' | 'out' | null>(null);

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
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md rounded-2xl bg-[hsl(var(--background))] p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs flex items-center gap-2"><CheckCircle size={14}/>{success}</div>}

                    {/* Clock In Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Clock In Time</label>
                        <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={inForm.date} 
                                onChange={e => setInForm({...inForm, date: e.target.value})}
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
                                    <div className="absolute top-12 right-0 w-32 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {TIME_OPTIONS.map(t => (
                                            <button key={t} type="button" onClick={() => { setInForm({...inForm, time: t}); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--muted))]">{t}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Clock Out Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Clock Out Time</label>
                            {!outForm.exists && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Missing</span>}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={outForm.date} 
                                onChange={e => setOutForm({...outForm, date: e.target.value})}
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
                                    <div className="absolute top-12 right-0 w-32 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {TIME_OPTIONS.map(t => (
                                            <button key={t} type="button" onClick={() => { setOutForm({...outForm, time: t}); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[hsl(var(--muted))]">{t}</button>
                                        ))}
                                    </div>
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

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full h-12 rounded-xl bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] font-bold shadow-lg hover:brightness-105 transition-all flex items-center justify-center gap-2"
                    >
                        {mutation.isPending ? "Saving Changes..." : <><Save size={18}/> Update Session</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
