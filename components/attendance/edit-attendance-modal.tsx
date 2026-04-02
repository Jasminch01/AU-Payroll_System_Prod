"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch } from "@/lib/api-client";
import { EventType, AttendanceLog } from "@/types/database";
import { X, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    log: AttendanceLog & { Employee?: { first_name: string; last_name: string } | null };
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
    { value: "CLOCK_IN", label: "Clock In" },
    { value: "CLOCK_OUT", label: "Clock Out" },
    { value: "BREAK_START", label: "Break Start" },
    { value: "BREAK_END", label: "Break End" },
];

export function EditAttendanceModal({
    isOpen,
    onClose,
    log,
}: EditAttendanceModalProps) {
    const queryClient = useQueryClient();

    // Parse initial timestamp
    const initialDate = new Date(log.timestamp);
    const [formData, setFormData] = useState({
        event_type: log.event_type as EventType,
        date: initialDate.toISOString().split("T")[0],
        time: initialDate.toTimeString().slice(0, 5),
        override_reason: log.override_reason || "",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

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

            // Refetch attendance data
            queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });

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

        const localDateTime = new Date(`${formData.date}T${formData.time}:00`);
        const timestamp = localDateTime.toISOString();

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
                                Event Type
                            </label>
                            <select
                                value={formData.event_type}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        event_type: e.target.value as EventType,
                                    })
                                }
                                className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                {EVENT_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
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
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    className="w-28 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                                />
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
