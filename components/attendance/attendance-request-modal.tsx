"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { X, AlertCircle, CheckCircle, Clock, Send } from "lucide-react";
import { createBusinessTimestamp, getDateTimeForInput } from "@/lib/timezone-utils";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttendanceRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    log?: any; // Optional: if editing an existing session
}

const TIME_OPTIONS = [
    ...Array.from({ length: 24 * 60 }, (_, i) => {
        const hours = Math.floor(i / 60).toString().padStart(2, "0");
        const minutes = (i % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    })
];

export function AttendanceRequestModal({
    isOpen,
    onClose,
    log,
}: AttendanceRequestModalProps) {
    const queryClient = useQueryClient();
    const { businessTimezone } = useBusinessTimezone();

    // Determine initial values based on whether log is a Session object or raw log
    let clockInLog, clockOutLog;
    if (log?.clock_in || log?.clock_out) {
        // It's a Session object
        clockInLog = log.clock_in;
        clockOutLog = log.clock_out;
    } else {
        // It's a raw log array/object (legacy fallback)
        const logs = log?.all_logs || (log ? [log] : []);
        clockInLog = logs.find((l: any) => l.event_type === 'CLOCK_IN');
        clockOutLog = logs.find((l: any) => l.event_type === 'CLOCK_OUT');
    }

    const inData = clockInLog?.timestamp ? getDateTimeForInput(clockInLog.timestamp, businessTimezone) : { date: new Date().toISOString().split('T')[0], time: "" };
    const outData = clockOutLog?.timestamp ? getDateTimeForInput(clockOutLog.timestamp, businessTimezone) : { date: inData.date, time: "" };

    const [inForm, setInForm] = useState({ date: inData.date, time: inData.time });
    const [outForm, setOutForm] = useState({ date: outData.date, time: outData.time });
    const [breakHours, setBreakHours] = useState("");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [activeDropdown, setActiveDropdown] = useState<'in' | 'out' | null>(null);
    const [timeSearch, setTimeSearch] = useState("");

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            return apiPost(`/attendance/request-edit`, payload);
        },
        onSuccess: () => {
            setSuccess("Edit request submitted to management.");
            toast.success("Request submitted successfully!");
            queryClient.invalidateQueries({ queryKey: ["attendance-requests-me"] });
            setTimeout(() => {
                onClose();
                setSuccess("");
            }, 1500);
        },
        onError: (err: Error) => {
            setError(err.message || "Failed to submit request");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!reason) {
            setError("Please provide a reason for this edit request");
            return;
        }

        const inTs = inForm.time ? createBusinessTimestamp(inForm.date, inForm.time, businessTimezone) : null;
        const outTs = outForm.time ? createBusinessTimestamp(outForm.date, outForm.time, businessTimezone) : null;

        if (!inTs && !outTs && !breakHours) {
            setError("Please provide at least one change (Clock In, Clock Out, or Break Hours)");
            return;
        }

        if (!clockInLog?.log_id) {
            setError("You can only request edits for an existing attendance record.");
            return;
        }

        const now = new Date();
        if (inTs && new Date(inTs) > now) {
            setError("Cannot request a clock in time in the future.");
            return;
        }
        if (outTs && new Date(outTs) > now) {
            setError("Cannot request a clock out time in the future.");
            return;
        }

        mutation.mutate({
            attendance_log_id: clockInLog?.log_id || null,
            requested_actual_start: inTs,
            requested_actual_end: outTs,
            requested_break_hours: breakHours ? parseFloat(breakHours) : null,
            reason: reason
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className="relative w-full max-w-md rounded-2xl bg-[hsl(var(--background))] p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-[hsl(var(--brand))] p-6 text-white">
                    <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-black/10 transition-colors">
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={22} />
                        Request Attendance Edit
                    </h2>
                    <p className="text-sm opacity-80 mt-1">Submit corrections for manager approval</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
                    {success && <div className="p-3 bg-green-50 text-green-700 rounded-lg text-xs flex items-center gap-2"><CheckCircle size={14} />{success}</div>}

                    {/* Clock In Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Requested Clock In</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={inForm.date}
                                readOnly
                                className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))] px-3 text-sm cursor-not-allowed"
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
                                        <div className="absolute top-12 right-0 w-40 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
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
                                            <div className="max-h-36 overflow-y-auto p-1" ref={el => {
                                                if (el && !el.dataset.scrolled) {
                                                    const selected = el.querySelector('[data-selected="true"]');
                                                    if (selected) {
                                                        selected.scrollIntoView({ block: "center" });
                                                        el.dataset.scrolled = "true";
                                                    }
                                                }
                                            }}>
                                                {(() => {
                                                    const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                    
                                                    return filtered.map(t => (
                                                        <button key={t} type="button" onClick={() => { setInForm({ ...inForm, time: t }); setActiveDropdown(null); setTimeSearch(""); }} data-selected={inForm.time === t} className={cn(
                                                            "w-full text-left px-4 py-2 text-sm rounded-md transition-colors",
                                                            inForm.time === t
                                                                ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                : "hover:bg-[hsl(var(--muted))]"
                                                        )}>{t}</button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Clock Out Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Requested Clock Out</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={outForm.date}
                                readOnly
                                className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))] px-3 text-sm cursor-not-allowed"
                            />
                            <div className="relative w-32">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'out' ? null : 'out')}
                                    className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm flex items-center justify-between"
                                >
                                    <span>{outForm.time || "--:--"}</span>
                                    <Clock size={14} className="opacity-40" />
                                </button>
                                {activeDropdown === 'out' && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                        <div className="absolute top-12 right-0 w-40 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
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
                                            <div className="max-h-36 overflow-y-auto p-1" ref={el => {
                                                if (el && !el.dataset.scrolled) {
                                                    const selected = el.querySelector('[data-selected="true"]');
                                                    if (selected) {
                                                        selected.scrollIntoView({ block: "center" });
                                                        el.dataset.scrolled = "true";
                                                    }
                                                }
                                            }}>
                                                {(() => {
                                                    const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                    
                                                    return filtered.map(t => (
                                                        <button key={t} type="button" onClick={() => { setOutForm({ ...outForm, time: t }); setActiveDropdown(null); setTimeSearch(""); }} data-selected={outForm.time === t} className={cn(
                                                            "w-full text-left px-4 py-2 text-sm rounded-md transition-colors",
                                                            outForm.time === t
                                                                ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                : "hover:bg-[hsl(var(--muted))]"
                                                        )}>{t}</button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Break Hours */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Requested Break Hours</label>
                        <input
                            type="number"
                            step="0.01"
                            value={breakHours}
                            onChange={e => setBreakHours(e.target.value)}
                            placeholder="e.g., 0.5 for 30 mins"
                            className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-[hsl(var(--muted-foreground))] tracking-widest">Reason for Edit <span className="text-red-500">*</span></label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g., Forgot to clock out from kiosk, worked extra 15 mins..."
                            className="w-full p-3 rounded-xl border bg-[hsl(var(--card))] text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            rows={3}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full h-12 rounded-xl bg-[hsl(var(--brand))] text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                    >
                        {mutation.isPending ? "Submitting..." : <><Send size={18} /> Submit Request</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
