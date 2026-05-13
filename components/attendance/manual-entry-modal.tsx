"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { EventType } from "@/types/database";
import { X, AlertCircle, CheckCircle, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBusinessTimestamp, getDateTimeForInput, getCurrentTimestamp } from "@/lib/timezone-utils";
import { useBusinessTimezone } from "@/lib/timezone-context";

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Array<{
        employee_id: string;
        first_name: string;
        last_name: string;
    }>;
    fromDate?: string;
    toDate?: string;
    defaultEmployeeId?: string;
    defaultDate?: string;
    defaultInTime?: string;
    defaultOutTime?: string;
}

const EVENT_TYPES: { value: EventType | "FULL_SHIFT"; label: string }[] = [
    { value: "FULL_SHIFT", label: "Full Shift (In & Out)" },
    { value: "CLOCK_IN", label: "Clock In" },
    { value: "CLOCK_OUT", label: "Clock Out" },
    { value: "BREAK_START", label: "Break Start" },
    { value: "BREAK_END", label: "Break End" },
];

const TIME_OPTIONS = [
    ...Array.from({ length: 24 * 60 }, (_, i) => {
        const hours = Math.floor(i / 60).toString().padStart(2, "0");
        const minutes = (i % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    })
];

export function ManualEntryModal({
    isOpen,
    onClose,
    employees,
    fromDate,
    toDate,
    defaultEmployeeId,
    defaultDate,
    defaultInTime,
    defaultOutTime,
}: ManualEntryModalProps) {
    const queryClient = useQueryClient();

    const { businessTimezone } = useBusinessTimezone();
    // Get current date/time for default values in business timezone
    const { date: todayDate, time: nowTime } = getDateTimeForInput(getCurrentTimestamp(), businessTimezone);

    const [formData, setFormData] = useState({
        employee_id: defaultEmployeeId || "",
        event_type: "FULL_SHIFT" as EventType | "FULL_SHIFT",
        date: defaultDate || todayDate,
        inTime: defaultInTime || "09:00",
        outTime: defaultOutTime || "17:00",
        breaks: [] as Array<{ id: string; start: string; end: string }>,
        override_reason: "",
    });

    // Reset form when modal opens with new defaults
    React.useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                employee_id: defaultEmployeeId || "",
                date: defaultDate || todayDate,
                inTime: defaultInTime || "09:00",
                outTime: defaultOutTime || "17:00",
            }));
            setError("");
            setSuccess("");
            setSearchTerm("");
        }
    }, [isOpen, defaultEmployeeId, defaultDate, defaultInTime, defaultOutTime, todayDate]);

    const [timeSearch, setTimeSearch] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiPost("/attendance", data);
            return response;
        },
        onSuccess: () => {
            const { date: newDate, time: newTime } = getDateTimeForInput(getCurrentTimestamp(), businessTimezone);
            setSuccess("Manual entry recorded successfully");
            setFormData({
                employee_id: "",
                event_type: "FULL_SHIFT",
                date: newDate,
                inTime: "09:00",
                outTime: "17:00",
                breaks: [],
                override_reason: "",
            });
            setError("");

            // Refetch attendance data with specific date range
            if (fromDate && toDate) {
                queryClient.invalidateQueries({
                    queryKey: ["attendance-raw", fromDate, toDate]
                });
            } else {
                queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });
            }

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
    const [isBreakDropdownOpen, setIsBreakDropdownOpen] = useState<{ [key: string]: 'start' | 'end' | null }>({});
    const [breakSearch, setBreakSearch] = useState<{ [key: string]: string }>({});

    const filteredEmployees = employees.filter((emp) =>
        `${emp.first_name} ${emp.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    const selectedEmployee = employees.find(emp => emp.employee_id === formData.employee_id);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.employee_id) {
            setError("Please select an employee");
            return;
        }

        if (formData.event_type === "FULL_SHIFT") {
            if (!formData.date || !formData.inTime || !formData.outTime) {
                setError("Please select date, clock-in and clock-out times");
                return;
            }

            const inTimestamp = createBusinessTimestamp(formData.date, formData.inTime, businessTimezone);
            const outTimestamp = createBusinessTimestamp(formData.date, formData.outTime, businessTimezone);

            // Basic validation: Out must be after In
            if (new Date(outTimestamp) <= new Date(inTimestamp)) {
                setError("Clock out time must be after clock in time");
                return;
            }

            const entries = [
                {
                    employee_id: formData.employee_id,
                    event_type: "CLOCK_IN",
                    timestamp: inTimestamp,
                    override_reason: formData.override_reason || undefined,
                },
            ];

            // Add all breaks
            for (const b of formData.breaks) {
                if (b.start && b.end) {
                    const bStart = createBusinessTimestamp(formData.date, b.start, businessTimezone);
                    const bEnd = createBusinessTimestamp(formData.date, b.end, businessTimezone);

                    if (new Date(bEnd) <= new Date(bStart)) {
                        setError(`Break end (${b.end}) must be after break start (${b.start})`);
                        return;
                    }
                    if (new Date(bStart) <= new Date(inTimestamp) || new Date(bEnd) >= new Date(outTimestamp)) {
                        setError(`Break ${b.start}-${b.end} must be within shift times`);
                        return;
                    }

                    entries.push(
                        {
                            employee_id: formData.employee_id,
                            event_type: "BREAK_START",
                            timestamp: bStart,
                            override_reason: formData.override_reason || undefined,
                        },
                        {
                            employee_id: formData.employee_id,
                            event_type: "BREAK_END",
                            timestamp: bEnd,
                            override_reason: formData.override_reason || undefined,
                        }
                    );
                }
            }

            entries.push({
                employee_id: formData.employee_id,
                event_type: "CLOCK_OUT",
                timestamp: outTimestamp,
                override_reason: formData.override_reason || undefined,
            });

            mutation.mutate(entries as any);
        } else {
            if (!formData.date || !formData.inTime) {
                setError("Please select date and time");
                return;
            }

            const timestamp = createBusinessTimestamp(formData.date, formData.inTime, businessTimezone);

            mutation.mutate({
                employee_id: formData.employee_id,
                event_type: formData.event_type as EventType,
                timestamp,
                override_reason: formData.override_reason || undefined,
            } as any);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
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

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                    {/* Error / Success Messages */}
                    {error && (
                        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-4 animate-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 text-red-600" />
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    )}

                    {/* 1. Employee Search & Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            1. Select Employee <span className="text-red-500">*</span>
                        </label>

                        {/* Selected Employee Badge */}
                        {selectedEmployee && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--brand-light))]/30 border border-[hsl(var(--brand))]/20 animate-in fade-in slide-in-from-left-1 duration-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[hsl(var(--brand))] text-white flex items-center justify-center text-[10px] font-black">
                                        {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[hsl(var(--foreground))] leading-tight">
                                            {selectedEmployee.first_name} {selectedEmployee.last_name}
                                        </p>
                                        <p className="text-[10px] text-[hsl(var(--brand))] font-bold uppercase tracking-tighter">Selected for Entry</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, employee_id: "" })}
                                    className="p-1.5 hover:bg-white/50 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                                    title="Deselect"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {!selectedEmployee && (
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
                        )}

                        {!selectedEmployee && searchTerm && (
                            <div className="grid grid-cols-1 gap-1.5 mt-2 max-h-40 overflow-y-auto pr-1 border rounded-xl p-2 bg-[hsl(var(--muted))]/10">
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp) => (
                                        <button
                                            key={emp.employee_id}
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, employee_id: emp.employee_id });
                                                setSearchTerm("");
                                            }}
                                            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] flex items-center justify-center text-[10px] font-bold">
                                                    {emp.first_name[0]}{emp.last_name[0]}
                                                </div>
                                                <span>{emp.first_name} {emp.last_name}</span>
                                            </div>
                                            <CheckCircle size={14} className="text-[hsl(var(--brand))]/20" />
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-center py-4 text-xs text-[hsl(var(--muted-foreground))] italic">No employees found</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Entry Type */}
                    <div className="space-y-2 p-3 bg-[hsl(var(--muted))]/30 rounded-xl border border-[hsl(var(--border))]/50">
                        <label className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                            2. Entry Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {EVENT_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, event_type: type.value as any })}
                                    className={cn(
                                        "px-2 py-2 rounded-lg text-[10px] font-bold transition-all border",
                                        formData.event_type === type.value
                                            ? "bg-[hsl(var(--brand))] text-white border-[hsl(var(--brand))]"
                                            : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                                    )}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Shift Details */}
                    <div className="space-y-3 pt-2">
                        <label className="text-sm font-semibold text-[hsl(var(--foreground))]">
                            3. Shift Details <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="space-y-3">
                            {/* Date Picker - Compact */}
                            <div className="relative">
                                <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] mb-1 ml-1">Work Date</p>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                                />
                            </div>
                            
                            {formData.event_type === 'FULL_SHIFT' ? (
                                <div className="space-y-3">
                                    {/* Shift Times & Add Break In One Row */}
                                    <div className="flex items-end gap-2">
                                        <div className="shrink-0 pb-1">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, breaks: [...formData.breaks, { id: Math.random().toString(36).substr(2, 9), start: "12:00", end: "12:30" }] })}
                                                className="w-11 h-11 rounded-xl border-2 border-dashed border-[hsl(var(--brand))]/30 flex flex-col items-center justify-center text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/5 transition-colors group"
                                                title="Add Break"
                                            >
                                                <span className="text-lg font-bold">+</span>
                                                <span className="text-[7px] uppercase font-black leading-none -mt-1 group-hover:scale-105">Break</span>
                                            </button>
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] mb-1 ml-1">Clock In</p>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const isOpen = isBreakDropdownOpen['shift_in'] === 'start';
                                                        setIsBreakDropdownOpen({ ...isBreakDropdownOpen, 'shift_in': isOpen ? null : 'start' });
                                                        if (!isOpen) setBreakSearch({ ...breakSearch, 'shift_in': '' });
                                                    }}
                                                    className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs flex items-center justify-between"
                                                >
                                                    <span>{formData.inTime}</span>
                                                    <Clock size={12} className="text-[hsl(var(--muted-foreground))]" />
                                                </button>
                                                {isBreakDropdownOpen['shift_in'] === 'start' && (
                                                    <div className="absolute top-12 left-0 w-32 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl z-110 overflow-hidden flex flex-col">
                                                        <div className="p-1.5 border-b bg-[hsl(var(--muted))]/30">
                                                            <input 
                                                                autoFocus
                                                                type="text" 
                                                                placeholder="Search..."
                                                                value={breakSearch['shift_in'] || ''}
                                                                onChange={(e) => setBreakSearch({ ...breakSearch, 'shift_in': e.target.value })}
                                                                className="w-full h-7 px-2 text-[10px] rounded border bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--brand))]"
                                                            />
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto p-1" ref={el => {
                                                            if (el && !el.dataset.scrolled) {
                                                                const selected = el.querySelector('[data-selected="true"]');
                                                                if (selected) {
                                                                    selected.scrollIntoView({ block: "center" });
                                                                    el.dataset.scrolled = "true";
                                                                }
                                                            }
                                                        }}>
                                                             {(() => {
                                                                 const filtered = TIME_OPTIONS.filter(t => t.includes(breakSearch['shift_in'] || ''));
                                                                 
                                                                 return filtered.map(t => (
                                                                     <button key={t} type="button" onClick={() => { setFormData({ ...formData, inTime: t }); setIsBreakDropdownOpen({}); }} data-selected={formData.inTime === t} className={cn(
                                                                         "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                                                                         formData.inTime === t
                                                                             ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                             : "hover:bg-[hsl(var(--muted))]"
                                                                     )}>{t}</button>
                                                                 ));
                                                             })()}
                                                         </div>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         <div className="flex-1">
                                             <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] mb-1 ml-1">Clock Out</p>
                                             <div className="relative">
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         const isOpen = isBreakDropdownOpen['shift_out'] === 'start';
                                                         setIsBreakDropdownOpen({ ...isBreakDropdownOpen, 'shift_out': isOpen ? null : 'start' });
                                                         if (!isOpen) setBreakSearch({ ...breakSearch, 'shift_out': '' });
                                                     }}
                                                     className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs flex items-center justify-between"
                                                 >
                                                     <span>{formData.outTime}</span>
                                                     <Clock size={12} className="text-[hsl(var(--muted-foreground))]" />
                                                 </button>
                                                 {isBreakDropdownOpen['shift_out'] === 'start' && (
                                                     <div className="absolute top-12 right-0 w-32 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl z-110 overflow-hidden flex flex-col">
                                                         <div className="p-1.5 border-b bg-[hsl(var(--muted))]/30">
                                                             <input 
                                                                 autoFocus
                                                                 type="text" 
                                                                 placeholder="Search..."
                                                                 value={breakSearch['shift_out'] || ''}
                                                                 onChange={(e) => setBreakSearch({ ...breakSearch, 'shift_out': e.target.value })}
                                                                 className="w-full h-7 px-2 text-[10px] rounded border bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--brand))]"
                                                             />
                                                         </div>
                                                         <div className="max-h-40 overflow-y-auto p-1" ref={el => {
                                                             if (el && !el.dataset.scrolled) {
                                                                 const selected = el.querySelector('[data-selected="true"]');
                                                                 if (selected) {
                                                                     selected.scrollIntoView({ block: "center" });
                                                                     el.dataset.scrolled = "true";
                                                                 }
                                                             }
                                                         }}>
                                                             {(() => {
                                                                 const filtered = TIME_OPTIONS.filter(t => t.includes(breakSearch['shift_out'] || ''));
                                                                 
                                                                 return filtered.map(t => (
                                                                     <button key={t} type="button" onClick={() => { setFormData({ ...formData, outTime: t }); setIsBreakDropdownOpen({}); }} data-selected={formData.outTime === t} className={cn(
                                                                         "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                                                                         formData.outTime === t
                                                                             ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                             : "hover:bg-[hsl(var(--muted))]"
                                                                     )}>{t}</button>
                                                                 ));
                                                             })()}
                                                         </div>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     </div>

                                     {/* Breaks List - More Compact */}
                                     {formData.breaks.length > 0 && (
                                         <div className="grid grid-cols-1 gap-2 bg-[hsl(var(--muted))]/20 p-2 rounded-xl">
                                             {formData.breaks.map((b, idx) => (
                                                 <div key={b.id} className="flex items-center gap-2 bg-[hsl(var(--card))] p-1.5 rounded-lg border border-[hsl(var(--border))]/50">
                                                     <div className="flex-1 flex items-center gap-2">
                                                         <div className="relative flex-1">
                                                             <button
                                                                 type="button"
                                                                 onClick={() => {
                                                                     const isOpen = isBreakDropdownOpen[b.id] === 'start';
                                                                     setIsBreakDropdownOpen({ ...isBreakDropdownOpen, [b.id]: isOpen ? null : 'start' });
                                                                     if (!isOpen) setBreakSearch({ ...breakSearch, [b.id]: '' });
                                                                 }}
                                                                 className="w-full h-8 px-2 text-[11px] font-medium border rounded-md flex items-center justify-between"
                                                             >
                                                                 <span className="text-[8px] uppercase text-[hsl(var(--muted-foreground))] mr-1 font-bold">Start:</span>
                                                                 <span>{b.start}</span>
                                                             </button>
                                                             {isBreakDropdownOpen[b.id] === 'start' && (
                                                                 <div className="absolute top-9 left-0 w-28 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-120 overflow-hidden flex flex-col">
                                                                     <div className="p-1 border-b bg-[hsl(var(--muted))]/30">
                                                                         <input 
                                                                             autoFocus
                                                                             type="text" 
                                                                             placeholder="Search..."
                                                                             value={breakSearch[b.id] || ''}
                                                                             onChange={(e) => setBreakSearch({ ...breakSearch, [b.id]: e.target.value })}
                                                                             className="w-full h-6 px-1.5 text-[9px] rounded border bg-[hsl(var(--background))] focus:outline-none"
                                                                         />
                                                                     </div>
                                                                     <div className="max-h-32 overflow-y-auto p-1" ref={el => {
                                                                         if (el && !el.dataset.scrolled) {
                                                                             const selected = el.querySelector('[data-selected="true"]');
                                                                             if (selected) {
                                                                                 selected.scrollIntoView({ block: "center" });
                                                                                 el.dataset.scrolled = "true";
                                                                             }
                                                                         }
                                                                     }}>
                                                                         {(() => {
                                                                             const filtered = TIME_OPTIONS.filter(t => t.includes(breakSearch[b.id] || ''));
                                                                             
                                                                             return filtered.map(t => (
                                                                                 <button key={t} type="button" onClick={() => { const newBreaks = [...formData.breaks]; newBreaks[idx].start = t; setFormData({ ...formData, breaks: newBreaks }); setIsBreakDropdownOpen({}); }} data-selected={b.start === t} className={cn(
                                                                                     "w-full text-left px-2 py-1 text-xs rounded",
                                                                                     b.start === t
                                                                                         ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                                         : "hover:bg-[hsl(var(--muted))]"
                                                                                 )}>{t}</button>
                                                                             ));
                                                                         })()}
                                                                     </div>
                                                                 </div>
                                                             )}
                                                         </div>
                                                         <div className="relative flex-1">
                                                             <button
                                                                 type="button"
                                                                 onClick={() => {
                                                                     const isOpen = isBreakDropdownOpen[b.id] === 'end';
                                                                     setIsBreakDropdownOpen({ ...isBreakDropdownOpen, [b.id]: isOpen ? null : 'end' });
                                                                     if (!isOpen) setBreakSearch({ ...breakSearch, [b.id + '_end']: '' });
                                                                 }}
                                                                 className="w-full h-8 px-2 text-[11px] font-medium border rounded-md flex items-center justify-between"
                                                             >
                                                                 <span className="text-[8px] uppercase text-[hsl(var(--muted-foreground))] mr-1 font-bold">End:</span>
                                                                 <span>{b.end}</span>
                                                             </button>
                                                             {isBreakDropdownOpen[b.id] === 'end' && (
                                                                 <div className="absolute top-9 right-0 w-28 bg-[hsl(var(--card))] border rounded-lg shadow-xl z-120 overflow-hidden flex flex-col">
                                                                     <div className="p-1 border-b bg-[hsl(var(--muted))]/30">
                                                                         <input 
                                                                             autoFocus
                                                                             type="text" 
                                                                             placeholder="Search..."
                                                                             value={breakSearch[b.id + '_end'] || ''}
                                                                             onChange={(e) => setBreakSearch({ ...breakSearch, [b.id + '_end']: e.target.value })}
                                                                             className="w-full h-6 px-1.5 text-[9px] rounded border bg-[hsl(var(--background))] focus:outline-none"
                                                                         />
                                                                     </div>
                                                                     <div className="max-h-32 overflow-y-auto p-1" ref={el => {
                                                                         if (el && !el.dataset.scrolled) {
                                                                             const selected = el.querySelector('[data-selected="true"]');
                                                                             if (selected) {
                                                                                 selected.scrollIntoView({ block: "center" });
                                                                                 el.dataset.scrolled = "true";
                                                                             }
                                                                         }
                                                                     }}>
                                                                         {(() => {
                                                                             const filtered = TIME_OPTIONS.filter(t => t.includes(breakSearch[b.id + '_end'] || ''));
                                                                             
                                                                             return filtered.map(t => (
                                                                                 <button key={t} type="button" onClick={() => { const newBreaks = [...formData.breaks]; newBreaks[idx].end = t; setFormData({ ...formData, breaks: newBreaks }); setIsBreakDropdownOpen({}); }} data-selected={b.end === t} className={cn(
                                                                                     "w-full text-left px-2 py-1 text-xs rounded",
                                                                                     b.end === t
                                                                                         ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                                         : "hover:bg-[hsl(var(--muted))]"
                                                                                 )}>{t}</button>
                                                                             ));
                                                                         })()}
                                                                     </div>
                                                                 </div>
                                                             )}
                                                         </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, breaks: formData.breaks.filter(item => item.id !== b.id) })}
                                                        className="p-1 text-red-400 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] mb-1 ml-1">Event Time</p>
                                    <button
                                        type="button"
                                        onClick={() => setIsBreakDropdownOpen({ ...isBreakDropdownOpen, 'single_time': isBreakDropdownOpen['single_time'] === 'start' ? null : 'start' })}
                                        className="w-full h-11 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm flex items-center justify-between"
                                    >
                                        <span>{formData.inTime}</span>
                                        <Clock size={16} className="text-[hsl(var(--muted-foreground))]" />
                                    </button>
                                    {isBreakDropdownOpen['single_time'] === 'start' && (
                                        <div className="absolute top-12 left-0 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-100 overflow-hidden flex flex-col">
                                            <div className="p-2 border-b bg-[hsl(var(--muted))]/30">
                                                <input 
                                                    autoFocus
                                                    type="text" 
                                                    placeholder="Search..."
                                                    value={breakSearch['single_time'] || ''}
                                                    onChange={(e) => setBreakSearch({ ...breakSearch, 'single_time': e.target.value })}
                                                    className="w-full h-8 px-2 text-xs rounded border bg-[hsl(var(--background))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--brand))]"
                                                />
                                            </div>
                                            <div className="max-h-48 overflow-y-auto p-1" ref={el => {
                                                if (el && !el.dataset.scrolled) {
                                                    const selected = el.querySelector('[data-selected="true"]');
                                                    if (selected) {
                                                        selected.scrollIntoView({ block: "center" });
                                                        el.dataset.scrolled = "true";
                                                    }
                                                }
                                            }}>
                                                {(() => {
                                                    const filtered = TIME_OPTIONS.filter(t => t.includes(breakSearch['single_time'] || ''));
                                                    
                                                    return filtered.map(t => (
                                                        <button key={t} type="button" onClick={() => { setFormData({ ...formData, inTime: t }); setIsBreakDropdownOpen({}); }} data-selected={formData.inTime === t} className={cn(
                                                            "w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors",
                                                            formData.inTime === t
                                                                ? "bg-[hsl(var(--brand))] text-white font-medium"
                                                                : "hover:bg-[hsl(var(--muted))]"
                                                        )}>{t}</button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. Reason (Optional) */}
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
                            placeholder="e.g., Forgot to clock in"
                            rows={1}
                            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))]/40 focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
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
