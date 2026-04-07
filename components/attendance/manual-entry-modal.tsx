"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { EventType } from "@/types/database";
import { X, AlertCircle, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAustralianTimestamp, getAustralianDateTimeForInput } from "@/lib/timezone-utils";

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Array<{
        employee_id: string;
        first_name: string;
        last_name: string;
    }>;
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
    { value: "CLOCK_IN", label: "Clock In" },
    { value: "CLOCK_OUT", label: "Clock Out" },
    { value: "BREAK_START", label: "Break Start" },
    { value: "BREAK_END", label: "Break End" },
];

export function ManualEntryModal({
    isOpen,
    onClose,
    employees,
}: ManualEntryModalProps) {
    const queryClient = useQueryClient();
    
    // Get current Australian date/time for default values
    const { date: todayDate, time: nowTime } = getAustralianDateTimeForInput(new Date().toISOString());
    
    const [formData, setFormData] = useState({
        employee_id: "",
        event_type: "CLOCK_IN" as EventType,
        date: todayDate,
        time: nowTime,
        override_reason: "",
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const mutation = useMutation({
        mutationFn: async (data: {
            employee_id: string;
            event_type: EventType;
            timestamp: string;
            override_reason?: string;
        }) => {
            const response = await apiPost("/attendance", data);
            return response;
        },
        onSuccess: () => {
            setSuccess("Manual entry recorded successfully");
            const { date: resetDate, time: resetTime } = getAustralianDateTimeForInput(new Date().toISOString());
            setFormData({
                employee_id: "",
                event_type: "CLOCK_IN",
                date: resetDate,
                time: resetTime,
                override_reason: "",
            });
            setError("");

            // Refetch attendance data
            queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });

            setTimeout(() => {
                onClose();
                setSuccess("");
            }, 1500);
        },
        onError: (err: Error) => {
            setError(err.message || "Failed to record manual entry");
            setSuccess("");
        },
    });

    const [searchTerm, setSearchTerm] = useState("");

    const filteredEmployees = employees.filter((emp) =>
        `${emp.first_name} ${emp.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.employee_id) {
            setError("Please select an employee");
            return;
        }

        if (!formData.date || !formData.time) {
            setError("Please select date and time");
            return;
        }

        // Create timestamp using Australian timezone-aware function
        const timestamp = createAustralianTimestamp(formData.date, formData.time);

        mutation.mutate({
            employee_id: formData.employee_id,
            event_type: formData.event_type,
            timestamp,
            override_reason: formData.override_reason || undefined,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-lg rounded-2xl bg-[hsl(var(--background))] p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-[hsl(var(--brand))] p-6 text-white">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold">Add Manual Entry</h2>
                    <p className="text-white/80 text-sm mt-1">Record unscheduled attendance for compliance</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* Error / Success Messages */}
                    {error && (
                        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-4 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 text-red-600" />
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Employee Search & Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            1. Select Employee <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
                            {filteredEmployees.length > 0 ? (
                                filteredEmployees.map((emp) => (
                                    <button
                                        key={emp.employee_id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, employee_id: emp.employee_id })}
                                        className={cn(
                                            "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all",
                                            formData.employee_id === emp.employee_id
                                                ? "bg-[hsl(var(--brand))] text-white shadow-md shadow-[hsl(var(--brand))]/20"
                                                : "bg-[hsl(var(--muted))]/50 hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                formData.employee_id === emp.employee_id ? "bg-white/20" : "bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]"
                                            )}>
                                                {emp.first_name[0]}{emp.last_name[0]}
                                            </div>
                                            <span>{emp.first_name} {emp.last_name}</span>
                                        </div>
                                        {formData.employee_id === emp.employee_id && <CheckCircle size={14} className="text-white" />}
                                    </button>
                                ))
                            ) : (
                                <p className="text-center py-4 text-xs text-[hsl(var(--muted-foreground))] italic">No employees found</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Event type */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                2. Event Type <span className="text-red-500">*</span>
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
                            <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                3. Date & Time <span className="text-red-500">*</span>
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
                                    className="w-24 h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Override reason */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            4. Reason (Optional)
                        </label>
                        <textarea
                            value={formData.override_reason}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    override_reason: e.target.value,
                                })
                            }
                            placeholder="Why was this entry added manually? (e.g., Forgot to clock in)"
                            rows={2}
                            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-[hsl(var(--border))] font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] active:scale-95 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex-[1.5] h-12 rounded-xl bg-[hsl(var(--brand))] font-bold text-white shadow-lg shadow-[hsl(var(--brand))]/20 hover:bg-[hsl(var(--brand))]/95 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                        >
                            {mutation.isPending ? "Recording..." : "Record Entry"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
