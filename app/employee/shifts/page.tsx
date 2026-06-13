"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { apiGet, apiPost, apiPut, apiPatch } from "@/lib/api-client";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { createBusinessTimestamp } from "@/lib/timezone-utils";
import { toast } from "sonner";
import { CalendarDays, Clock, ArrowLeftRight, Check, X, Users, LayoutGrid, List, ChevronLeft, ChevronRight, ClipboardList, Info, CheckCircle2, XCircle, MinusCircle, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidator } from "@/hooks/use-realtime-invalidator";

import { ShiftSwapDialog } from "@/components/shifts/swap-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function EmployeeShiftsPage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [selectedShiftDetails, setSelectedShiftDetails] = useState<any>(null);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [rosterPeriod, setRosterPeriod] = useState<"weekly" | "fortnightly" | "monthly">("weekly");
    const [weekOffset, setWeekOffset] = useState(0);

    const [reasonPromptTask, setReasonPromptTask] = useState<any>(null);
    const [reasonText, setReasonText] = useState("");


    // Refs for scrolling
    const swapsRef = useRef<HTMLDivElement>(null);
    const poolRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const { businessTimezone } = useBusinessTimezone();

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
        // Refresh every 60s so the ongoing/upcoming classification stays accurate
        // without requiring a manual page reload when a shift start time passes.
        refetchInterval: 60_000,
    });

    const { data: attendanceData } = useQuery({
        queryKey: ["my-attendance"],
        queryFn: () => apiGet<any>("/attendance/me"),
    });

    const isClockedIn = ["CLOCK_IN", "BREAK_START", "BREAK_END"].includes(attendanceData?.current_status);

    // Memoized configs for real-time invalidator
    const realtimeConfigs = useMemo(() => [
        { table: 'Shift', queryKeys: [['my-shifts']] },
        { table: 'Roster', queryKeys: [['my-shifts']] },
        { table: 'ShiftSwapRequest', queryKeys: [['my-shifts'], ['my-swap-requests']] }
    ], []);

    // Real-time invalidation
    useRealtimeInvalidator(realtimeConfigs);

    // Handle deep linking from notifications
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "swaps" && swapsRef.current) {
            swapsRef.current.scrollIntoView({ behavior: 'smooth' });
        } else if (tab === "pool" && poolRef.current) {
            poolRef.current.scrollIntoView({ behavior: 'smooth' });
        }

        const shiftId = searchParams.get("shiftId") || searchParams.get("shift_id");
        if (shiftId && shifts.length > 0) {
            const found = shifts.find((s: any) => String(s.shift_id) === String(shiftId));
            if (found) {
                setSelectedShiftDetails(found);
            }
        }
    }, [searchParams, shifts]);

    // Detect default roster period based on data
    useEffect(() => {
        if (shifts.length > 0) {
            // Find a shift with a roster attached
            const shiftWithRoster = shifts.find(s => s.Roster);
            if (shiftWithRoster?.Roster) {
                const start = new Date(shiftWithRoster.Roster.start_date);
                const end = new Date(shiftWithRoster.Roster.end_date);
                const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                if (diffDays > 20) setRosterPeriod("monthly");
                else if (diffDays > 10) setRosterPeriod("fortnightly");
                else setRosterPeriod("weekly");
            }
        }
    }, [shifts]);

    const { data: swapRequests = [] } = useQuery({
        queryKey: ["my-swap-requests"],
        queryFn: () => apiGet<any[]>("/shifts/swaps"),
    });

    const respondSwapMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" | "cancel" }) =>
            apiPut(`/shifts/swaps/${id}`, { action }),
        onSuccess: (data: any, variables: any) => {
            if (variables.action === 'cancel') {
                toast.success("Request cancelled successfully.");
            } else if (variables.action === 'accept') {
                toast.success("Request accepted! Awaiting manager approval.");
            } else {
                toast.success("Request declined.");
            }
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const claimShiftMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/shifts/swaps/${id}`, { action: "accept" }),
        onSuccess: () => {
            toast.success("Shift claimed successfully! Awaiting manager approval.");
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Parse a shift's naive datetime string (stored as business-local time, no timezone suffix)
    // into a proper UTC Date using the business timezone. Without this, the browser interprets
    // e.g. "17:30" as 17:30 in the USER's local timezone (Bangladesh UTC+6 = 11:30 UTC) instead
    // of the BUSINESS timezone (Australia/Sydney UTC+10 = 07:30 UTC), breaking the comparison.
    const parseShiftTime = useMemo(() => {
        return (isoStr: string): Date => {
            if (!isoStr) return new Date(0);
            // If already has timezone offset (Z or +/-), parse directly — no re-interpretation needed.
            if (isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr)) {
                return new Date(isoStr);
            }
            // Naive string: extract date (YYYY-MM-DD) and time (HH:mm) then re-interpret
            // the time as business-local and convert to UTC.
            const [datePart, timePart] = isoStr.split('T');
            const hhmm = (timePart || '00:00').substring(0, 5);
            const utcIso = createBusinessTimestamp(datePart, hhmm, businessTimezone);
            return new Date(utcIso);
        };
    }, [businessTimezone]);

    // Re-evaluate now every time shifts data or timezone changes so a shift that started
    // is immediately moved from "upcoming" to "ongoing".
    const { ongoing, upcoming, past } = useMemo(() => {
        const now = new Date();

        const ongoing = shifts.filter((s: any) => {
            const start = parseShiftTime(s.start_time);
            const end = parseShiftTime(s.end_time);
            return start <= now && end >= now;
        });

        const upcoming = shifts
            .filter((s: any) => parseShiftTime(s.start_time) > now)
            .sort((a: any, b: any) => parseShiftTime(a.start_time).getTime() - parseShiftTime(b.start_time).getTime());

        const past = shifts
            .filter((s: any) => parseShiftTime(s.end_time) < now)
            .sort((a: any, b: any) => parseShiftTime(b.end_time).getTime() - parseShiftTime(a.end_time).getTime());

        return { ongoing, upcoming, past };
    }, [shifts, parseShiftTime]);

    const pendingIncomingSwaps = swapRequests.filter((sr: any) =>
        sr.target_employee_id === user?.employee_id && sr.status === 'pending_acceptance'
    );

    const openPoolShifts = swapRequests.filter((sr: any) =>
        !sr.target_employee_id && sr.status === 'pending_acceptance' && sr.requester_id !== user?.employee_id
    );

    // Fetch checklist for the current/most relevant shift
    // If clocked in, the active shift might be in the past if they worked past their scheduled end time!
    const activeShift = useMemo(() => {
        if (ongoing.length > 0) return ongoing[0];
        if (isClockedIn && past.length > 0) {
            const lastShift = past[0];
            const end = parseShiftTime(lastShift.end_time);
            // If the shift ended less than 16 hours ago and they are still clocked in,
            // assume this is the shift they are trying to check out of.
            if (new Date().getTime() - end.getTime() < 16 * 60 * 60 * 1000) {
                return lastShift;
            }
        }
        return upcoming[0];
    }, [ongoing, upcoming, past, isClockedIn, parseShiftTime]);
    const { data: detailsChecklist = [], isLoading: isLoadingDetailsChecklist } = useQuery({
        queryKey: ["shift-checklist", selectedShiftDetails?.shift_id],
        queryFn: () => apiGet<any[]>(`/shift/${selectedShiftDetails.shift_id}/checklist`),
        enabled: !!selectedShiftDetails,
    });

    const toggleTaskMutation = useMutation({
        mutationFn: ({ shiftId, id, status, reason }: { shiftId: string, id: string, status: string, reason?: string | null }) => 
            apiPatch(`/shift/${shiftId}/checklist/${id}`, { status, reason }),
        onSuccess: (data: any, variables: any) => {
            queryClient.invalidateQueries({ queryKey: ["shift-checklist", variables.shiftId] });
            toast.success("Task updated");
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Timezone-safe date component formatter (YYYY-MM-DD)
    const formatToDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Flexible Roster Range calculation
    const currentRosterDates = useMemo(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        const days = [];
        let count = 7;
        if (rosterPeriod === "fortnightly") count = 14;
        if (rosterPeriod === "monthly") count = 31; // Simplification for grid size

        // Adjust based on offset
        let startDiff = 0;
        if (rosterPeriod === "weekly") startDiff = weekOffset * 7;
        if (rosterPeriod === "fortnightly") startDiff = weekOffset * 14;
        if (rosterPeriod === "monthly") {
            // For monthly, align to the first of the month for better UX
            const currentMonth = new Date();
            currentMonth.setMonth(currentMonth.getMonth() + weekOffset);
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);

            const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
            for (let i = 0; i < daysInMonth; i++) {
                const next = new Date(currentMonth);
                next.setDate(i + 1);
                days.push(next);
            }
            return days;
        }

        const start = new Date(monday);
        start.setDate(monday.getDate() + startDiff);

        for (let i = 0; i < count; i++) {
            const next = new Date(start);
            next.setDate(start.getDate() + i);
            days.push(next);
        }
        return days;
    }, [weekOffset, rosterPeriod]);

    const getShiftStatus = (shift: any) => {
        const now = new Date();
        const start = parseShiftTime(shift.start_time);
        const end = parseShiftTime(shift.end_time);

        // Check for active swap/transfer requests for THIS shift
        const activeRequest = (swapRequests || []).find((sr: any) =>
            String(sr.shift_id) === String(shift.shift_id) &&
            ['pending_acceptance', 'pending_approval'].includes(sr.status)
        );

        if (activeRequest) {
            if (!activeRequest.target_employee_id) {
                return activeRequest.manager_note === 'swap' ? "pooled_swap" : "pooled_transfer";
            }
            return activeRequest.target_shift_id ? "swap_pending" : "transfer_pending";
        }

        if (end < now) return "completed";
        if (start <= now && end >= now) return "ongoing";
        return "upcoming";
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="My Shifts"
            pageDescription={`${upcoming.length} upcoming shifts`}
            actions={
                <div className="flex items-center gap-2">
                    {viewMode === "grid" && (
                        <div className="flex items-center bg-[hsl(var(--muted))]/50 rounded-lg p-1 mr-2 scale-90 md:scale-100">
                            {(["weekly", "fortnightly", "monthly"] as const).map((p) => (
                                <Button
                                    key={p}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-7 px-2 rounded-md text-[10px] font-bold uppercase transition-all",
                                        rosterPeriod === p ? "bg-white shadow-sm text-[hsl(var(--brand))]" : "text-[hsl(var(--muted-foreground))]"
                                    )}
                                    onClick={() => { setRosterPeriod(p); setWeekOffset(0); }}
                                >
                                    {p}
                                </Button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center bg-[hsl(var(--muted))]/50 rounded-lg p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 px-3 rounded-md transition-all", viewMode === "list" ? "bg-white shadow-sm text-[hsl(var(--brand))]" : "text-[hsl(var(--muted-foreground))]")}
                            onClick={() => setViewMode("list")}
                        >
                            <List size={16} className="mr-2" /> List
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 px-3 rounded-md transition-all", viewMode === "grid" ? "bg-white shadow-sm text-[hsl(var(--brand))]" : "text-[hsl(var(--muted-foreground))]")}
                            onClick={() => setViewMode("grid")}
                        >
                            <LayoutGrid size={16} className="mr-2" /> Roster
                        </Button>
                    </div>
                </div>
            }
        >

            {/* Incoming Swap Requests */}
            {pendingIncomingSwaps.length > 0 && (
                <div ref={swapsRef} className="mb-8 p-4 bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning))] rounded-xl scroll-mt-20">
                    <h2 className="text-lg font-semibold text-[hsl(var(--warning-foreground))] mb-3 flex items-center gap-2">
                        <ArrowLeftRight size={18} /> Shift Requests
                    </h2>
                    <div className="space-y-3">
                        {pendingIncomingSwaps.map((sr: any) => (
                            <div key={sr.request_id} className="bg-white rounded-lg p-3 flex flex-wrap gap-4 items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-medium text-sm">
                                        <span className="font-bold">{sr.Requester?.first_name} {sr.Requester?.last_name}</span> wants to {sr.target_shift_id ? "swap" : "transfer"} their shift:
                                    </p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {new Date(sr.Shift?.start_time).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
                                        {" · "}
                                        {sr.Shift?.start_time?.split('T')[1]?.substring(0, 5)}
                                        {" – "}
                                        {sr.Shift?.end_time?.split('T')[1]?.substring(0, 5)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" className="text-[hsl(var(--danger))]" onClick={() => respondSwapMutation.mutate({ id: sr.request_id, action: "decline" })}>
                                        <X size={14} className="mr-1" /> Decline
                                    </Button>
                                    <Button size="sm" variant="success" onClick={() => respondSwapMutation.mutate({ id: sr.request_id, action: "accept" })}>
                                        <Check size={14} className="mr-1" /> Accept
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Shift Pool */}
            {openPoolShifts.length > 0 && (
                <div ref={poolRef} className="mb-8 scroll-mt-20">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users size={18} className="text-[hsl(var(--brand))]" /> Available to Claim
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openPoolShifts.map((pool: any) => (
                            <Card key={pool.request_id} className="border-[hsl(var(--brand))]/20 bg-[hsl(var(--brand-light))]/10">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-[hsl(var(--brand))] uppercase tracking-wider mb-1">
                                                {pool.manager_note === 'swap' ? 'Swap Requested' : 'Open Transfer'}
                                            </p>
                                            <p className="font-semibold text-sm">{pool.Requester?.first_name} {pool.Requester?.last_name}</p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--brand-light))] flex items-center justify-center">
                                            <Users size={14} className="text-[hsl(var(--brand))]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                            <CalendarDays size={14} />
                                            {new Date(pool.Shift?.start_time).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                            <Clock size={14} />
                                            {pool.Shift?.start_time?.split('T')[1]?.substring(0, 5)} - {pool.Shift?.end_time?.split('T')[1]?.substring(0, 5)}
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full h-8 text-xs bg-[hsl(var(--brand))]"
                                        onClick={() => claimShiftMutation.mutate(pool.request_id)}
                                        loading={claimShiftMutation.isPending}
                                    >
                                        Claim Shift
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Roster/List Content */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        {viewMode === "list" ? "Upcoming Shifts" : `${rosterPeriod.charAt(0).toUpperCase() + rosterPeriod.slice(1)} Roster`}
                        {viewMode === "grid" && (
                            <span className="text-sm font-normal text-[hsl(var(--muted-foreground))] ml-2">
                                {currentRosterDates[0].toLocaleDateString("en-AU", { day: 'numeric', month: 'short' })} - {currentRosterDates[currentRosterDates.length - 1].toLocaleDateString("en-AU", { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </h2>
                    {viewMode === "grid" && (
                        <div className="flex items-center gap-1 border border-[hsl(var(--border))] rounded-lg overflow-hidden">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r border-[hsl(var(--border))]" onClick={() => setWeekOffset(prev => prev - 1)}>
                                <ChevronLeft size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase rounded-none px-3" onClick={() => setWeekOffset(0)}>
                                Today
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-[hsl(var(--border))]" onClick={() => setWeekOffset(prev => prev + 1)}>
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    )}
                </div>

                {viewMode === "grid" ? (
                    <div className="w-full pb-4">
                        <div className={cn(
                            "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 bg-[hsl(var(--muted))]/10 p-2 rounded-2xl border border-[hsl(var(--border))] w-full",
                            rosterPeriod === "monthly" ? "lg:h-[calc(100vh-220px)] lg:overflow-y-auto" : ""
                        )}>
                            {currentRosterDates.map((day: Date) => {
                                const dateStr = formatToDateString(day);
                                const dayShifts = shifts.filter((s: any) => (s.shift_date?.split('T')[0] || s.shift_date) === dateStr);
                                const isToday = formatToDateString(new Date()) === dateStr;

                                return (
                                    <div
                                        key={dateStr}
                                        className={cn(
                                            "rounded-xl p-2 border transition-all flex flex-col",
                                            rosterPeriod === "monthly" ? "min-h-[100px] lg:min-h-0 lg:h-full" : "min-h-[140px] w-full",
                                            isToday ? "bg-white border-[hsl(var(--brand))]/30 shadow-sm" : "bg-white/40 border-[hsl(var(--border))]/50",
                                        )}
                                    >
                                        <div className="flex flex-col items-center mb-2">
                                            <span className={cn("text-[10px] uppercase font-bold tracking-tighter", isToday ? "text-[hsl(var(--brand))]" : "text-[hsl(var(--muted-foreground))]/70")}>
                                                {day.toLocaleDateString("en-AU", { weekday: 'short' })}
                                            </span>
                                            <span className={cn("text-lg font-display tabular-nums leading-none", isToday ? "text-[hsl(var(--brand))] font-bold" : "text-[hsl(var(--foreground))]/80")}>
                                                {day.getDate()}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {dayShifts.map((s: any) => (
                                                <div
                                                    key={s.shift_id}
                                                    className="bg-[hsl(var(--brand))] text-white p-2 rounded-lg text-[10px] font-medium leading-tight cursor-pointer hover:brightness-110 transition-all shadow-sm"
                                                    onClick={() => setSelectedShiftDetails(s)}
                                                >
                                                    <div className="flex items-center gap-1 opacity-90 mb-0.5 capitalize">
                                                        <Clock size={10} /> {s.shift_type}
                                                    </div>
                                                    <div className="font-bold flex items-center justify-between gap-1">
                                                        <span>{s.start_time?.split('T')[1]?.substring(0, 5)}</span>
                                                        {s.ShiftChecklistItem && s.ShiftChecklistItem.length > 0 && (
                                                            <span className="flex items-center gap-0.5 bg-white/20 px-1 py-0.5 rounded text-[8px] font-bold shrink-0">
                                                                <ClipboardList size={8} />
                                                                {s.ShiftChecklistItem.filter((item: any) => item.status === 'done').length}/{s.ShiftChecklistItem.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {dayShifts.length === 0 && (
                                                <div className="h-full flex items-center justify-center opacity-10">
                                                    <X size={20} className="text-[hsl(var(--muted-foreground))]" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Tabs defaultValue="ongoing" className="w-full">
                        <TabsList className="mb-4 bg-[hsl(var(--muted))]/50">
                            <TabsTrigger value="ongoing" className="text-xs">Ongoing ({ongoing.length})</TabsTrigger>
                            <TabsTrigger value="upcoming" className="text-xs">Upcoming ({upcoming.length})</TabsTrigger>
                            <TabsTrigger value="history" className="text-xs">History ({past.length})</TabsTrigger>
                        </TabsList>

                        {(['ongoing', 'upcoming', 'history'] as const).map(tabKey => {
                            const data = tabKey === 'ongoing' ? ongoing : tabKey === 'upcoming' ? upcoming : past;
                            return (
                                <TabsContent key={tabKey} value={tabKey}>
                                    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date & Type</th>
                                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))] hidden md:table-cell">Roster Period</th>
                                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Shift Hours</th>
                                                        <th className="px-4 py-3 text-center font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                                        <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[hsl(var(--border))]">
                                                    {data.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="py-12 text-center text-[hsl(var(--muted-foreground))] italic">
                                                                No {tabKey} shifts found.
                                                            </td>
                                                        </tr>
                                                    ) : data.map((shift: any) => (
                                                        <tr 
                                                            key={shift.shift_id} 
                                                            className="hover:bg-[hsl(var(--muted))]/5 transition-colors group cursor-pointer"
                                                            onClick={() => setSelectedShiftDetails(shift)}
                                                        >
                                                            <td className="px-4 py-4">
                                                                <p className="font-semibold text-sm">
                                                                    {new Date(shift.start_time).toLocaleDateString("en-AU", { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                </p>
                                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] font-bold text-[9px] uppercase">
                                                                        {shift.shift_type}
                                                                    </span>
                                                                    {shift.ShiftChecklistItem && shift.ShiftChecklistItem.length > 0 && (
                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-[9px] uppercase">
                                                                            <ClipboardList size={10} className="shrink-0" />
                                                                            {shift.ShiftChecklistItem.filter((item: any) => item.status === 'done').length}/{shift.ShiftChecklistItem.length} Tasks
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 hidden md:table-cell">
                                                                {shift.Roster ? (
                                                                    <p className="text-[hsl(var(--muted-foreground))] font-medium">
                                                                        {new Date(shift.Roster.start_date).toLocaleDateString("en-AU", { day: 'numeric', month: 'short' })}
                                                                        {" – "}
                                                                        {new Date(shift.Roster.end_date).toLocaleDateString("en-AU", { day: 'numeric', month: 'short' })}
                                                                    </p>
                                                                ) : "-"}
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <div className="flex items-center gap-2 text-[hsl(var(--brand))] font-bold">
                                                                    <Clock size={14} className="opacity-50" />
                                                                    {shift.start_time?.split('T')[1]?.substring(0, 5)}
                                                                    {" – "}
                                                                    {shift.end_time?.split('T')[1]?.substring(0, 5)}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <StatusBadge status={getShiftStatus(shift)} />
                                                            </td>
                                                            <td className="px-4 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {tabKey !== 'history' && (getShiftStatus(shift) === 'upcoming' || ['pooled_swap', 'pooled_transfer', 'swap_pending', 'transfer_pending'].includes(getShiftStatus(shift))) && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 text-[10px] gap-1 px-3 border-[hsl(var(--brand))]/20 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))]"
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedShift(shift); setSwapDialogOpen(true); }}
                                                                            disabled={!!(swapRequests || []).find((sr: any) =>
                                                                                String(sr.shift_id) === String(shift.shift_id) &&
                                                                                ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                                            )}
                                                                        >
                                                                            <ArrowLeftRight size={12} /> Shift Actions
                                                                        </Button>
                                                                    )}

                                                                    {/* Cancel/Undo Button for Active Requests (Owned by user) */}
                                                                    {(swapRequests || []).find((sr: any) =>
                                                                        String(sr.shift_id) === String(shift.shift_id) &&
                                                                        String(sr.requester_id) === String(user?.employee_id) &&
                                                                        ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                                    ) && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-[10px] text-[hsl(var(--danger))] bg-[hsl(var(--danger-light))]/5 hover:bg-[hsl(var(--danger-light))]/15 border border-[hsl(var(--danger))]/10"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const req = (swapRequests || []).find((sr: any) => String(sr.shift_id) === String(shift.shift_id) && ['pending_acceptance', 'pending_approval'].includes(sr.status));
                                                                                    if (req) respondSwapMutation.mutate({ id: req.request_id, action: 'cancel' });
                                                                                }}
                                                                            >
                                                                                <X size={12} className="mr-1" /> Undo Request
                                                                            </Button>
                                                                        )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                )}
            </div>

            <Dialog open={!!selectedShiftDetails} onOpenChange={(open) => { if (!open) setSelectedShiftDetails(null); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border-none shadow-2xl p-6">
                    <DialogHeader className="pb-4 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            <CalendarDays className="text-[hsl(var(--brand))]" size={22} />
                            Shift Details
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500 mt-1">
                            Detailed schedule and checklist for this shift.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedShiftDetails && (
                        <div className="space-y-6 py-4">
                            {/* Shift Details Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shift Date & Type</p>
                                    <p className="text-sm font-bold text-slate-800 mt-1">
                                        {new Date(selectedShiftDetails.start_time).toLocaleDateString("en-AU", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] font-bold text-[10px] uppercase mt-2">
                                        {selectedShiftDetails.shift_type}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shift Hours</p>
                                    <p className="text-sm font-bold text-[hsl(var(--brand))] mt-1 flex items-center gap-1.5">
                                        <Clock size={16} />
                                        {selectedShiftDetails.start_time?.split('T')[1]?.substring(0, 5)}
                                        {" – "}
                                        {selectedShiftDetails.end_time?.split('T')[1]?.substring(0, 5)}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 font-medium">Status:</span>
                                        <StatusBadge status={getShiftStatus(selectedShiftDetails)} />
                                    </div>
                                </div>
                            </div>

                            {/* Shift Actions */}
                            {getShiftStatus(selectedShiftDetails) === 'upcoming' && (
                                <div className="flex justify-end border-b border-slate-100 pb-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[10px] gap-1 px-3 border-[hsl(var(--brand))]/20 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))]"
                                        onClick={() => {
                                            const shift = selectedShiftDetails;
                                            setSelectedShiftDetails(null);
                                            setSelectedShift(shift);
                                            setSwapDialogOpen(true);
                                        }}
                                        disabled={!!(swapRequests || []).find((sr: any) =>
                                            String(sr.shift_id) === String(selectedShiftDetails.shift_id) &&
                                            ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                        )}
                                    >
                                        <ArrowLeftRight size={12} /> Shift Actions / Swap Request
                                    </Button>
                                </div>
                            )}

                            {/* Checklist Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                        <ClipboardList size={18} className="text-[hsl(var(--brand))]" />
                                        Shift Tasks
                                    </h3>
                                    {detailsChecklist.length > 0 && (
                                        <div className="flex items-center gap-2 px-2.5 py-0.5 bg-white border border-slate-200 rounded-full shadow-sm">
                                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 transition-all duration-500" 
                                                    style={{ width: `${Math.round((detailsChecklist.filter((t: any) => t.status === 'done').length / detailsChecklist.length) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] font-black text-slate-500 tabular-nums">
                                                {detailsChecklist.filter((t: any) => t.status === 'done').length}/{detailsChecklist.length}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isLoadingDetailsChecklist ? (
                                    <div className="py-8 text-center text-xs text-slate-400">Loading checklist...</div>
                                ) : detailsChecklist.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        No tasks configured for this shift.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Alert lock warning */}
                                        {(!isClockedIn || selectedShiftDetails.shift_id !== activeShift?.shift_id) && (
                                            <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-amber-800 shadow-sm animate-in fade-in duration-300">
                                                <Lock size={16} className="shrink-0 mt-0.5 text-amber-500" />
                                                <div className="text-[11px] font-semibold leading-relaxed">
                                                    {selectedShiftDetails.shift_id !== activeShift?.shift_id
                                                        ? "Tasks are locked because this is not your active shift."
                                                        : "Tasks are locked because you are not actively clocked in."}
                                                </div>
                                            </div>
                                        )}

                                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                                            {detailsChecklist.map((task: any) => {
                                                const isEditable = isClockedIn && selectedShiftDetails.shift_id === activeShift?.shift_id;
                                                return (
                                                    <div 
                                                        key={task.checklist_item_id}
                                                        className={cn(
                                                            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-all hover:bg-slate-50/50",
                                                            task.status !== 'pending' && "bg-slate-50/20"
                                                        )}
                                                    >
                                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                            <div className="shrink-0 mt-0.5">
                                                                {task.status === 'done' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 animate-in zoom-in-50" />}
                                                                {task.status === 'not_done' && <XCircle className="w-4.5 h-4.5 text-rose-500 animate-in zoom-in-50" />}
                                                                {task.status === 'not_applicable' && <MinusCircle className="w-4.5 h-4.5 text-slate-400 animate-in zoom-in-50" />}
                                                                {task.status === 'pending' && <ClipboardList className="w-4.5 h-4.5 text-slate-300" />}
                                                            </div>
                                                            
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <p className={cn(
                                                                        "text-xs font-bold transition-all",
                                                                        task.status === 'done' ? "text-slate-400 line-through" : "text-slate-700"
                                                                    )}>
                                                                        {task.task_text}
                                                                    </p>
                                                                    {task.is_required && (
                                                                        <span className="inline-flex items-center gap-0.5 text-[7px] font-black uppercase text-amber-500 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                                                            Required
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {task.instructions && (
                                                                    <p className="text-[9px] text-slate-400 mt-0.5">{task.instructions}</p>
                                                                )}
                                                                {task.status === 'not_done' && task.reason && (
                                                                    <p className="text-[9px] text-rose-500 font-medium mt-1">
                                                                        Reason: <span className="italic">"{task.reason}"</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                                            <button
                                                                className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded transition-all border",
                                                                    task.status === 'done'
                                                                        ? (isEditable
                                                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-sm font-black"
                                                                            : "bg-emerald-500/60 border-emerald-500/10 text-white/80 shadow-sm font-black")
                                                                        : (isEditable
                                                                            ? "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                                            : "bg-white border-slate-200 text-slate-300"),
                                                                    !isEditable && "cursor-not-allowed"
                                                                )}
                                                                disabled={!isEditable}
                                                                onClick={() => {
                                                                    toggleTaskMutation.mutate({ shiftId: selectedShiftDetails.shift_id, id: task.checklist_item_id, status: 'done', reason: null });
                                                                }}
                                                            >
                                                                Done
                                                            </button>
                                                            
                                                            <button
                                                                className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded transition-all border",
                                                                    task.status === 'not_done'
                                                                        ? (isEditable
                                                                            ? "bg-rose-500 border-rose-500 text-white shadow-sm font-black"
                                                                            : "bg-rose-500/60 border-rose-500/10 text-white/80 shadow-sm font-black")
                                                                        : (isEditable
                                                                            ? "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                                            : "bg-white border-slate-200 text-slate-300"),
                                                                    !isEditable && "cursor-not-allowed"
                                                                )}
                                                                disabled={!isEditable}
                                                                onClick={() => {
                                                                    if (task.is_required) {
                                                                        setReasonPromptTask(task);
                                                                        setReasonText(task.reason || "");
                                                                    } else {
                                                                        toggleTaskMutation.mutate({ shiftId: selectedShiftDetails.shift_id, id: task.checklist_item_id, status: 'not_done', reason: null });
                                                                    }
                                                                }}
                                                            >
                                                                Not Done
                                                            </button>

                                                            <button
                                                                className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded transition-all border",
                                                                    task.status === 'not_applicable'
                                                                        ? (isEditable
                                                                            ? "bg-slate-500 border-slate-500 text-white shadow-sm font-black"
                                                                            : "bg-slate-500/60 border-slate-500/10 text-white/80 shadow-sm font-black")
                                                                        : (isEditable
                                                                            ? "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                                            : "bg-white border-slate-200 text-slate-300"),
                                                                    !isEditable && "cursor-not-allowed"
                                                                )}
                                                                disabled={!isEditable}
                                                                onClick={() => {
                                                                    toggleTaskMutation.mutate({ shiftId: selectedShiftDetails.shift_id, id: task.checklist_item_id, status: 'not_applicable', reason: null });
                                                                }}
                                                            >
                                                                N/A
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="border-t border-slate-100 pt-4 flex justify-end">
                        <Button className="h-10 rounded-xl animate-in fade-in" onClick={() => setSelectedShiftDetails(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ShiftSwapDialog
                open={swapDialogOpen}
                onOpenChange={setSwapDialogOpen}
                shift={selectedShift}
                role="employee"
            />

            <Dialog open={!!reasonPromptTask} onOpenChange={(open) => { if (!open) setReasonPromptTask(null); }}>
                <DialogContent className="max-w-md bg-white border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-800">Reason Required</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-medium">
                            Please explain why the required task <strong className="text-slate-700">"{reasonPromptTask?.task_text}"</strong> cannot be completed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <textarea
                            className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))] text-sm resize-none"
                            placeholder="e.g. Stock runout, delivery cancelled, etc."
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="flex items-center justify-end gap-2">
                        <Button 
                            variant="ghost" 
                            className="h-10 rounded-xl"
                            onClick={() => {
                                setReasonPromptTask(null);
                                setReasonText("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button 
                            disabled={!reasonText.trim()}
                            className="h-10 rounded-xl px-5"
                            onClick={() => {
                                toggleTaskMutation.mutate({
                                    shiftId: selectedShiftDetails.shift_id,
                                    id: reasonPromptTask.checklist_item_id,
                                    status: 'not_done',
                                    reason: reasonText
                                });
                                setReasonPromptTask(null);
                                setReasonText("");
                            }}
                        >
                            Submit Reason
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
