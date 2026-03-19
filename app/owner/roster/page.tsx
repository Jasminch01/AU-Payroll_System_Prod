"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { useEffect } from "react";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Clock, Trash2, CheckCircle2, FileText, RefreshCcw, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type RosterPeriod = "weekly" | "fortnightly" | "monthly";

function getRosterDates(offset: number, period: RosterPeriod): Date[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    
    // Normalize to Monday of current week
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    
    if (period === "weekly") {
        start.setDate(today.getDate() + diffToMonday + offset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    } else if (period === "fortnightly") {
        start.setDate(today.getDate() + diffToMonday + offset * 14);
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    } else {
        // Monthly
        const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        return Array.from({ length: lastDay }, (_, i) => {
            const d = new Date(monthStart);
            d.setDate(1 + i);
            return d;
        });
    }
}

function formatDate(d: Date | string) {
    if (!d) return "";
    if (typeof d === "string") {
        const match = d.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return "";
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
}

export default function OwnerRosterPage() {
    const queryClient = useQueryClient();
    const [offset, setOffset] = useState(0);
    const [rosterPeriod, setRosterPeriod] = useState<RosterPeriod>("weekly");
    const [addShiftOpen, setAddShiftOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState("");
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

    // Shift form
    const [shiftEmployee, setShiftEmployee] = useState("");
    const [shiftStart, setShiftStart] = useState("09:00");
    const [shiftEnd, setShiftEnd] = useState("17:00");
    const [shiftType, setShiftType] = useState("morning");
    const [initialFormState, setInitialFormState] = useState<any>(null);

    // Expansion confirmation state
    const [expansionOpen, setExpansionOpen] = useState(false);
    const [pendingShiftData, setPendingShiftData] = useState<any>(null);

    const rosterDates = useMemo(() => getRosterDates(offset, rosterPeriod), [offset, rosterPeriod]);
    const rangeStart = formatDate(rosterDates[0]);
    const rangeEnd = formatDate(rosterDates[rosterDates.length - 1]);

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    const { data: shifts = [], isLoading, isFetching } = useQuery({
        queryKey: ["shifts", rangeStart, rangeEnd],
        queryFn: () => apiGet<any[]>("/shift", { from: rangeStart, to: rangeEnd }),
    });

    const { data: rosters = [], isFetching: isFetchingRosters } = useQuery({
        queryKey: ["rosters"],
        queryFn: () => apiGet<any[]>("/rosters"),
    });

    // Real-time listener
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('owner-roster-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Shift'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                    queryClient.invalidateQueries({ queryKey: ["rosters"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Roster'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                    queryClient.invalidateQueries({ queryKey: ["rosters"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    // Auto-detect roster period from data on load
    const [hasAutoSet, setHasAutoSet] = useState(false);
    useEffect(() => {
        if (!hasAutoSet && rosters.length > 0) {
            // Find the most recent roster
            const latest = rosters[0]; // Roster API usually returns newest first
            if (latest) {
                const start = new Date(latest.start_date);
                const end = new Date(latest.end_date);
                const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                
                if (diffDays > 20) setRosterPeriod("monthly");
                else if (diffDays > 10) setRosterPeriod("fortnightly");
                else setRosterPeriod("weekly");
                
                setHasAutoSet(true);
            }
        }
    }, [rosters, hasAutoSet]);

    const createShiftMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shift", data),
        onSuccess: () => {
            toast.success("Shift created");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateShiftMutation = useMutation({
        mutationFn: (data: any) => apiPut(`/shift/${editingShiftId}`, data),
        onSuccess: () => {
            toast.success("Shift updated");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteShiftMutation = useMutation({
        mutationFn: (shiftId: string) => apiDelete(`/shift/${shiftId}`),
        onSuccess: () => {
            toast.success("Shift deleted");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            setDeleteConfirmOpen(false);
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const [deleteRosterConfirmOpen, setDeleteRosterConfirmOpen] = useState(false);
    const deleteRosterMutation = useMutation({
        mutationFn: (rosterId: string) => apiDelete(`/rosters/${rosterId}`),
        onSuccess: () => {
            toast.success("Roster deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setDeleteRosterConfirmOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [targetDuplicateDate, setTargetDuplicateDate] = useState("");
    const duplicateRosterMutation = useMutation({
        mutationFn: (data: { rosterId: string; target_start: string }) => 
            apiPost(`/rosters/${data.rosterId}/duplicate`, { target_start: data.target_start }),
        onSuccess: (newRoster: any) => {
            toast.success("Roster duplicated successfully");
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setDuplicateOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const publishRosterMutation = useMutation({
        mutationFn: (rosterId: string) => apiPut(`/rosters/${rosterId}`, { status: "published" }),
        onSuccess: () => {
            toast.success("Roster published successfully!");
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleAddShift = () => {
        if (!shiftEmployee || !selectedDate) {
            toast.error("Please select an employee and date");
            return;
        }

        const now = new Date();
        const start = new Date(`${selectedDate}T${shiftStart}:00`);
        if (start < now && !editingShiftId) {
            toast.error("Cannot create a shift that starts in the past.");
            return;
        }

        const payload = {
            employee_id: shiftEmployee,
            shift_date: selectedDate,
            start_time: `${selectedDate}T${shiftStart}:00`,
            end_time: `${selectedDate}T${shiftEnd}:00`,
            shift_type: shiftType,
            roster_start: rangeStart,
            roster_end: rangeEnd,
        };

        // Check for expansion
        if (currentRoster) {
            const rosterStart = formatDate(currentRoster.start_date);
            const rosterEnd = formatDate(currentRoster.end_date);
            
            if (selectedDate < rosterStart || selectedDate > rosterEnd) {
                setPendingShiftData(payload);
                setExpansionOpen(true);
                return;
            }
        }

        if (editingShiftId) {
            updateShiftMutation.mutate(payload);
        } else {
            createShiftMutation.mutate(payload);
        }
    };

    const confirmExpansion = () => {
        if (!pendingShiftData) return;
        if (editingShiftId) {
            updateShiftMutation.mutate(pendingShiftData);
        } else {
            createShiftMutation.mutate(pendingShiftData);
        }
        setExpansionOpen(false);
        setPendingShiftData(null);
    };

    const openAddShift = (date: string, empId = "", shift: any = null) => {
        setSelectedDate(date);
        setShiftEmployee(empId);
        
        if (shift) {
            setEditingShiftId(shift.shift_id);
            setShiftStart(new Date(shift.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
            setShiftEnd(new Date(shift.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
            setShiftType(shift.shift_type);
            setInitialFormState({
                employee_id: empId,
                shift_date: date,
                start_time: new Date(shift.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                end_time: new Date(shift.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                shift_type: shift.shift_type
            });
        } else {
            setEditingShiftId(null);
            setInitialFormState(null);
            const now = new Date();
            const todayStr = formatDate(now);
            
            if (date === todayStr) {
                const hour = now.getHours() + 1;
                const startStr = `${String(hour > 23 ? 23 : hour).padStart(2, "0")}:00`;
                const endHour = hour + 8;
                const endStr = `${String(endHour > 23 ? 23 : endHour).padStart(2, "0")}:00`;
                setShiftStart(startStr);
                setShiftEnd(endStr);
            } else {
                setShiftStart("09:00");
                setShiftEnd("17:00");
            }
            setShiftType("morning");
        }
        setAddShiftOpen(true);
    };

    const isDirty = useMemo(() => {
        if (!editingShiftId || !initialFormState) return true;
        return (
            shiftEmployee !== initialFormState.employee_id ||
            selectedDate !== initialFormState.shift_date ||
            shiftStart !== initialFormState.start_time ||
            shiftEnd !== initialFormState.end_time ||
            shiftType !== initialFormState.shift_type
        );
    }, [editingShiftId, initialFormState, shiftEmployee, selectedDate, shiftStart, shiftEnd, shiftType]);

    const shiftGrid = useMemo(() => {
        const grid: Record<string, Record<string, any[]>> = {};
        for (const s of shifts) {
            const empId = s.employee_id || "unassigned";
            const date = s.shift_date?.split("T")[0] || s.shift_date;
            if (!grid[empId]) grid[empId] = {};
            if (!grid[empId][date]) grid[empId][date] = [];
            grid[empId][date].push(s);
        }
        return grid;
    }, [shifts]);

    const activeEmployees = employees.filter((e: any) => e.status === "active");

    const currentRoster = useMemo(() => {
        // Find the roster record that encompasses the current view range
        return rosters.find((r: any) =>
            formatDate(r.start_date) <= rangeEnd &&
            formatDate(r.end_date) >= rangeStart
        );
    }, [rosters, rangeStart, rangeEnd]);

    const isShiftPublished = useCallback((shift: any) => {
        const roster = rosters.find((r: any) => r.roster_id === shift.roster_id);
        return roster?.status === 'published';
    }, [rosters]);

    const statusSummary = useMemo(() => {
        let published = 0;
        let drafts = 0;
        let modified = 0;
        let total = 0;

        const pubAt = currentRoster?.published_at ? new Date(currentRoster.published_at) : null;

        for (const s of shifts) {
            const d = s.shift_date?.split('T')[0] || s.shift_date;
            if (d < rangeStart || d > rangeEnd) continue;

            total++;
            const isPublished = isShiftPublished(s);
            if (isPublished) {
                published++;
            } else {
                const createdAt = new Date(s.created_at);
                const updatedAt = new Date(s.updated_at);
                if (pubAt && createdAt <= pubAt && updatedAt > pubAt) {
                    modified++;
                } else {
                    drafts++;
                }
            }
        }
        return { 
            total, 
            published, 
            drafts, 
            modified, 
            allPublished: total > 0 && total === published 
        };
    }, [shifts, isShiftPublished, currentRoster, rangeStart, rangeEnd]);

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Roster Management"
            pageDescription={`${rosterPeriod.charAt(0).toUpperCase() + rosterPeriod.slice(1)} Roster: ${rosterDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${rosterDates[rosterDates.length - 1].toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`}
            actions={
                <div className="flex items-center gap-2">
                    <select
                        value={rosterPeriod}
                        onChange={(e) => {
                            setRosterPeriod(e.target.value as RosterPeriod);
                            setOffset(0);
                        }}
                        className="h-10 w-32 rounded-lg border border-[hsl(var(--input))] bg-white px-3 text-sm font-medium focus:ring-2 focus:ring-[hsl(var(--brand))]/20 outline-none"
                    >
                        <option value="weekly">Weekly</option>
                        <option value="fortnightly">Fortnightly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                    <Button 
                        onClick={() => openAddShift(formatDate(new Date()))}
                        disabled={isFetching || isFetchingRosters}
                    >
                        <Plus size={16} className="mr-2" /> Add Shift
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 min-h-[44px]">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setOffset(offset - 1)}>
                        <ChevronLeft size={18} />
                    </Button>
                    <Button variant="ghost" onClick={() => setOffset(0)}>Current</Button>
                    <Button variant="outline" size="icon" onClick={() => setOffset(offset + 1)}>
                        <ChevronRight size={18} />
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {isFetching || isFetchingRosters ? (
                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] animate-pulse">
                            <RefreshCcw size={14} className="animate-spin text-[hsl(var(--brand))]" />
                            <span>Syncing...</span>
                        </div>
                    ) : (
                        statusSummary.total > 0 ? (
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                        <Badge 
                                            variant={statusSummary.allPublished ? "default" : "outline"}
                                            className={statusSummary.allPublished 
                                                ? "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))] text-white" 
                                                : "border-[hsl(var(--warning-foreground))] text-[hsl(var(--warning-foreground))] bg-[hsl(var(--warning))]/10"
                                            }
                                        >
                                            {statusSummary.allPublished ? (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 size={12} />
                                                    <span>Published</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <FileText size={12} />
                                                    <span>Draft ({statusSummary.total - statusSummary.published} shifts)</span>
                                                </div>
                                            )}
                                        </Badge>
                                        {currentRoster?.status === 'draft' && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const nextDate = new Date(currentRoster.end_date);
                                                        nextDate.setDate(nextDate.getDate() + 1);
                                                        setTargetDuplicateDate(formatDate(nextDate));
                                                        setDuplicateOpen(true);
                                                    }}
                                                    className="h-7 px-3 text-xs"
                                                >
                                                    <Copy size={12} className="mr-1" /> Duplicate
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDeleteRosterConfirmOpen(true)}
                                                    className="h-7 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                                >
                                                    <Trash2 size={12} className="mr-1" /> Delete Roster
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => publishRosterMutation.mutate(currentRoster.roster_id)}
                                                    className="h-7 px-3 text-xs bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))]"
                                                >
                                                    Publish Now
                                                </Button>
                                            </div>
                                        )}

                                        {currentRoster?.status === 'published' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    const nextDate = new Date(currentRoster.end_date);
                                                    nextDate.setDate(nextDate.getDate() + 1);
                                                    setTargetDuplicateDate(formatDate(nextDate));
                                                    setDuplicateOpen(true);
                                                }}
                                                className="h-7 px-3 text-xs"
                                            >
                                                <Copy size={12} className="mr-1" /> Duplicate Roster
                                            </Button>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium mt-1">
                                        {statusSummary.published} of {statusSummary.total} shifts notified
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/10">
                                    No shifts
                                </Badge>
                                <span className="text-xs text-[hsl(var(--muted-foreground))] italic hidden sm:inline">Add a shift to start rostering</span>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="w-full max-w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                <th className="sticky left-0 z-10 bg-[hsl(var(--muted))] px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))] w-48 min-w-48">
                                    Employee
                                </th>
                                {rosterDates.map((d, i) => {
                                    const isToday = formatDate(d) === formatDate(new Date());
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dMidnight = new Date(d);
                                    dMidnight.setHours(0, 0, 0, 0);
                                    const isPast = dMidnight < today;
                                    const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });

                                    return (
                                        <th
                                            key={i}
                                            className={`px-3 py-4 text-center font-semibold min-w-32 border-l border-[hsl(var(--border))] first:border-l-0 ${isToday ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/30" : (isPast ? "text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30" : "text-[hsl(var(--muted-foreground))]")}`}
                                        >
                                            <div className="text-xs">{dayName}</div>
                                            <div className="text-sm font-semibold">{d.getDate()}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {activeEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={rosterDates.length + 1} className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))]">
                                        No active employees found.
                                    </td>
                                </tr>
                            ) : (
                                activeEmployees.map((emp: any) => (
                                    <tr key={emp.employee_id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors">
                                        <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold">
                                                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                </div>
                                                <span className="font-medium text-sm truncate">{emp.first_name} {emp.last_name}</span>
                                            </div>
                                        </td>
                                        {rosterDates.map((d, i) => {
                                            const dateStr = formatDate(d);
                                            const dayShifts = shiftGrid[emp.employee_id]?.[dateStr] || [];
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            const dMidnight = new Date(d);
                                            dMidnight.setHours(0, 0, 0, 0);
                                            const isPast = dMidnight < today;

                                            return (
                                                <td
                                                    key={dateStr}
                                                    className={`p-2 border border-[hsl(var(--border))] min-w-[140px] align-top transition-colors group
                                                        ${formatDate(d) === formatDate(new Date()) ? "bg-[hsl(var(--brand-light))]/5" : ""}
                                                        ${isPast ? "bg-[hsl(var(--muted))]/10" : "hover:bg-[hsl(var(--muted))]/5"}`}
                                                    onClick={() => !isPast && openAddShift(dateStr, emp.employee_id)}
                                                >
                                                    {dayShifts.map((s: any) => {
                                                        const isPublished = isShiftPublished(s);
                                                        const pubAt = currentRoster?.published_at ? new Date(currentRoster.published_at) : null;
                                                        const updatedAt = new Date(s.updated_at);
                                                        const createdAt = new Date(s.created_at);
                                                        const isModified = !isPublished && pubAt && createdAt <= pubAt && updatedAt > pubAt;
                                                        const isNew = !isPublished && (!pubAt || createdAt > pubAt);

                                                        return (
                                                            <div
                                                                key={s.shift_id}
                                                                className={cn(
                                                                    "rounded-xl px-3 py-2 text-xs font-semibold mb-2 transition-all cursor-pointer border relative group",
                                                                    isPublished
                                                                        ? "bg-white border-[hsl(var(--border))] shadow-sm text-[hsl(var(--foreground))]"
                                                                        : "bg-transparent border-dashed border-[hsl(var(--brand))]/40 text-[hsl(var(--brand))] shadow-none",
                                                                    isPast ? "opacity-60 grayscale-[0.5]" : "hover:border-[hsl(var(--brand))] hover:shadow-md"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openAddShift(dateStr, emp.employee_id, s);
                                                                }}
                                                            >
                                                                <div className={`flex items-center gap-1.5 mb-1 ${isPublished ? "text-[hsl(var(--brand))]" : "text-[hsl(var(--brand))]/70"}`}>
                                                                    <Clock size={12} strokeWidth={2.5} />
                                                                    <span className="uppercase tracking-wider text-[10px]">{s.shift_type}</span>
                                                                    <div className="ml-auto flex items-center gap-1">
                                                                        {isPublished && <CheckCircle2 size={10} className="text-[hsl(var(--success))]" />}
                                                                        {isModified && <RefreshCcw size={10} className="text-amber-500 animate-pulse" />}
                                                                        {isNew && <Plus size={10} className="text-blue-500" />}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-start gap-0.5">
                                                                    <span>{new Date(s.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                                                    <span className="text-[hsl(var(--muted-foreground))] font-normal text-[10px]">to {new Date(s.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={addShiftOpen} onOpenChange={setAddShiftOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingShiftId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
                        <DialogDescription>
                            {editingShiftId ? (
                                new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time)) 
                                ? "This shift has already started and cannot be modified." 
                                : "Modify shift details or remove it"
                            ) : `Assign a shift for ${selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" }) : ""}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <Input 
                            label="Shift Date" 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)} 
                            disabled={editingShiftId ? new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time)) : false}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Employee</label>
                            <select
                                value={shiftEmployee}
                                onChange={(e) => setShiftEmployee(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                <option value="">Select employee</option>
                                {activeEmployees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.first_name} {emp.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Start Time" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                            <Input label="End Time" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Shift Type</label>
                            <select
                                value={shiftType}
                                onChange={(e) => setShiftType(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                <option value="morning">Morning</option>
                                <option value="afternoon">Afternoon</option>
                                <option value="evening">Evening</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <div className="flex items-center gap-2">
                            {editingShiftId && (
                                <Button
                                    variant="outline"
                                    disabled={new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time))}
                                    className="text-[hsl(var(--danger))] border-[hsl(var(--danger))]/20 hover:bg-[hsl(var(--danger))]/10 disabled:opacity-30"
                                    onClick={() => setDeleteConfirmOpen(true)}
                                    loading={deleteShiftMutation.isPending}
                                >
                                    <Trash2 size={16} className="mr-2" /> Delete
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setAddShiftOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={handleAddShift} 
                                loading={createShiftMutation.isPending || updateShiftMutation.isPending}
                                disabled={editingShiftId ? (!isDirty || (new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time)))) : false}
                            >
                                {editingShiftId ? 'Update Shift' : (
                                    <>
                                        <Plus size={16} className="mr-2" /> Create Shift
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this shift? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button 
                            variant="default" 
                            className="bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger))]/90"
                            onClick={() => editingShiftId && deleteShiftMutation.mutate(editingShiftId)}
                            loading={deleteShiftMutation.isPending}
                        >
                            Delete Shift
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={expansionOpen} onOpenChange={setExpansionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Expand Roster Duration?</DialogTitle>
                        <DialogDescription>
                            The date you selected falls outside the current roster range ({currentRoster ? `${formatDate(currentRoster.start_date)} to ${formatDate(currentRoster.end_date)}` : ""}).
                            Adding this shift will automatically switch and expand your current roster to a larger period (Monthly/Fortnightly).
                            <br /><br />
                            Do you want to switch the current roster?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExpansionOpen(false)}>Decline (Cancel Add)</Button>
                        <Button
                            variant="default"
                            className="bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand-hover))]"
                            onClick={confirmExpansion}
                        >
                            Accept & Expand
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteRosterConfirmOpen} onOpenChange={setDeleteRosterConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Entire Roster?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this roster and **all its shifts**? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteRosterConfirmOpen(false)}>Cancel</Button>
                        <Button
                            variant="default"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => currentRoster && deleteRosterMutation.mutate(currentRoster.roster_id)}
                            loading={deleteRosterMutation.isPending}
                        >
                            Delete Roster
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Duplicate Roster</DialogTitle>
                        <DialogDescription>
                            Select the **Start Date** for the duplicated roster. 
                            All current shifts will be copied and shifted accordingly.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            label="Target Start Date"
                            type="date"
                            value={targetDuplicateDate}
                            onChange={(e) => setTargetDuplicateDate(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand-hover))]"
                            onClick={() => currentRoster && duplicateRosterMutation.mutate({ 
                                rosterId: currentRoster.roster_id, 
                                target_start: targetDuplicateDate 
                            })}
                            loading={duplicateRosterMutation.isPending}
                        >
                            Duplicate Roster
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
