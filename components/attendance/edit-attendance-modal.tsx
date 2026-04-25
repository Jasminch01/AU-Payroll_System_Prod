"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, apiDelete } from "@/lib/api-client";
import { EventType, AttendanceLog } from "@/types/database";
import { X, AlertCircle, CheckCircle, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBusinessTimestamp, getDateTimeForInput } from "@/lib/timezone-utils";
import { useBusinessTimezone } from "@/lib/timezone-context";

interface EditAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: AttendanceLog & { Employee?: { first_name: string; last_name: string } | null };
    fromDate?: string;
    toDate?: string;
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
    { value: "CLOCK_IN", label: "Clock In" },
    { value: "CLOCK_OUT", label: "Clock Out" },
    { value: "BREAK_START", label: "Break Start" },
    { value: "BREAK_END", label: "Break End" },
];

const TIME_OPTIONS = [
    ...Array.from({ length: 23 * 60 }, (_, i) => {
        // Start from 01:00 and end at 23:59
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
    // Parse initial timestamp using Business timezone
    const { date: initialDate, time: initialTime } = getDateTimeForInput(log.timestamp, businessTimezone);
    const [formData, setFormData] = useState({
        event_type: log.event_type as EventType,
        date: initialDate,
        time: initialTime,
        override_reason: log.override_reason || "",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

    const mutation = useMutation({
        mutationFn: async (data: {
            event_type: EventType;
            timestamp: string;
            override_reason?: string;
        }) => {
            const response = await apiPatch(`/attendance/${log.log_id}`, data);
            return response;
        },
        onSuccess: () => {
            setSuccess("Attendance record updated successfully");
            setError("");

            // Invalidate with specific query key if dates provided, otherwise invalidate all
            if (fromDate && toDate) {
                console.log('[EDIT ATTENDANCE] Invalidating specific query:', {
                    queryKey: ["attendance-raw", fromDate, toDate]
                });
                queryClient.invalidateQueries({
                    queryKey: ["attendance-raw", fromDate, toDate]
                });
            } else {
                console.log('[EDIT ATTENDANCE] Invalidating all attendance queries');
                queryClient.invalidateQueries({
                    queryKey: ["attendance-raw"]
                });
            }

            setTimeout(() => {
                onClose();
                setSuccess("");
            }, 1500);
        },
        onError: (err: Error) => {
            setError(err.message || "Failed to update record");
            setSuccess("");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.date || !formData.time) {
            setError("Please select date and time");
            return;
        }

        if (!formData.override_reason) {
            setError("Please provide a reason for this override");
            return;
        }

        console.log('[EDIT ATTENDANCE] Form data before conversion:', {
            formData_date: formData.date,
            formData_time: formData.time,
            formData_event_type: formData.event_type,
            formData_override_reason: formData.override_reason,
            original_event_type: log.event_type
        });

        // Create timestamp using Business timezone-aware function
        const timestamp = createBusinessTimestamp(formData.date, formData.time, businessTimezone);

        console.log('[EDIT ATTENDANCE] Timestamp conversion:', {
            input_date: formData.date,
            input_time: formData.time,
            output_timestamp: timestamp,
            output_breakdown: {
                utc_iso: timestamp,
                display_as_business: new Intl.DateTimeFormat('en-AU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                    timeZone: businessTimezone
                }).format(new Date(timestamp))
            }
        });

        console.log('[EDIT ATTENDANCE] Sending to API:', {
            log_id: log.log_id,
            employee_id: log.employee_id,
            old_event_type: log.event_type,
            new_event_type: formData.event_type,
            old_timestamp: log.timestamp,
            new_timestamp: timestamp,
            override_reason: formData.override_reason,
        });

        mutation.mutate({
            event_type: formData.event_type,
            timestamp,
            override_reason: formData.override_reason,
        });
    };

    if (!isOpen) return null;

    const empName = log.Employee
        ? `${log.Employee.first_name} ${log.Employee.last_name}`
        : "Unknown Employee";

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md rounded-2xl bg-[hsl(var(--background))] p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-[hsl(var(--warning))] p-6 text-[hsl(var(--warning-foreground))]">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-black/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Clock size={22} />
                        Edit Attendance
                    </h2>
                    <p className="text-[hsl(var(--warning-foreground))]/80 text-sm mt-1">
                        Editing record for <span className="font-bold">{empName}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error / Success Messages */}
                    {error && (
                        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-4 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 text-red-600" />
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-100 p-4 animate-in slide-in-from-top-2">
                            <CheckCircle size={20} className="shrink-0 text-green-600" />
                            <p className="text-sm font-medium text-green-700">{success}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {/* Event type */}
                        <div className="space-y-2">
                            <label className="font-semibold text-[hsl(var(--foreground))] text-xs uppercase tracking-wider">
                                Event Type (Locked)
                            </label>
                            <select
                                disabled={true}
                                value={formData.event_type}
                                className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-3 text-sm opacity-60 cursor-not-allowed"
                            >
                                {EVENT_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                To change the event type, delete this record and add a new one via Manual Entry.
                            </p>
                        </div>

                        {/* Date & Time */}
                        <div className="space-y-2">
                            <label className="font-semibold text-[hsl(var(--foreground))] text-xs uppercase tracking-wider">
                                Date & Time
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                                />
                                <div className="relative w-28">
                                    <button
                                        type="button"
                                        onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                                        className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                                    >
                                        <span>{formData.time}</span>
                                        <Clock size={12} className="text-[hsl(var(--muted-foreground))]" />
                                    </button>

                                    {isTimeDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-70"
                                                onClick={() => setIsTimeDropdownOpen(false)}
                                            />
                                            <div className="absolute top-12 mb-2 right-0 w-32 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl z-71 max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-200">
                                                <div className="p-1">
                                                    {TIME_OPTIONS.map(time => (
                                                        <button
                                                            key={time}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, time });
                                                                setIsTimeDropdownOpen(false);
                                                            }}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                                                                formData.time === time
                                                                    ? "bg-[hsl(var(--brand))] text-white"
                                                                    : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                                            )}
                                                        >
                                                            {time}
                                                        </button>
                                                    ))}
                                                    {!TIME_OPTIONS.includes(formData.time) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsTimeDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-xs rounded-lg mt-1 bg-[hsl(var(--brand-light))]/30 text-[hsl(var(--brand))] font-bold"
                                                        >
                                                            {formData.time} (Original)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Override reason */}
                        <div className="space-y-2">
                            <label className="font-semibold text-[hsl(var(--foreground))] text-xs uppercase tracking-wider">
                                Reason for Overwrite <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.override_reason}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        override_reason: e.target.value,
                                    })
                                }
                                placeholder="Explain why this record is being modified..."
                                rows={3}
                                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm placeholder:text-[hsl(var(--muted-foreground))]/50 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-[hsl(var(--border))] font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] active:scale-95 transition-all text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending || success !== ""}
                            className="flex-[1.5] h-12 rounded-xl bg-[hsl(var(--warning))] font-bold text-[hsl(var(--warning-foreground))] shadow-lg shadow-[hsl(var(--warning))]/20 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 text-sm"
                        >
                            {mutation.isPending ? "Saving..." : "Update Record"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
