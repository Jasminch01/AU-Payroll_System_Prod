"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { CalendarDays, Clock, ArrowLeftRight, Check, X, Users, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

import { ShiftSwapDialog } from "@/components/shifts/swap-dialog";

export default function ManagerShiftsPage() {
    const queryClient = useQueryClient();
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [rosterPeriod, setRosterPeriod] = useState<"weekly" | "fortnightly" | "monthly">("weekly");
    const [weekOffset, setWeekOffset] = useState(0);
    const { user } = useAuth();

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
    });

    // Real-time listener for shifts
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('manager-shifts-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'Shift',
                    filter: user?.employee_id ? `employee_id=eq.${user.employee_id}` : undefined
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Shift',
                    filter: user?.employee_id ? `employee_id=eq.${user.employee_id}` : undefined
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'Shift'
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Roster'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ShiftSwapRequest'
                },
                (payload) => {
                    console.log('Real-time ShiftSwapRequest change received:', payload);
                    queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
                    queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
                }
            )
            .subscribe((status) => {
                console.log('Supabase real-time subscription status (manager):', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.employee_id, queryClient]);

    // Detect default roster period based on data
    useEffect(() => {
        if (shifts.length > 0) {
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
            toast.success(variables.action === 'cancel' ? "Request cancelled!" : "Response recorded!");
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const claimShiftMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/shifts/swaps/${id}`, { action: "accept" }),
        onSuccess: () => {
            toast.success("Shift claimed successfully!");
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

     const now = new Date();
     const ongoing = shifts.filter((s: any) => {
         const start = new Date(s.start_time);
         const end = new Date(s.end_time);
         return start <= now && end >= now;
     });
 
     const upcoming = shifts.filter((s: any) => new Date(s.start_time) > now)
         .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
     
     const past = shifts.filter((s: any) => new Date(s.end_time) < now)
         .sort((a: any, b: any) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());

    const pendingIncomingSwaps = swapRequests.filter((sr: any) =>
        sr.target_employee_id === user?.employee_id && sr.status === 'pending_acceptance'
    );

    const openPoolShifts = swapRequests.filter((sr: any) => 
        !sr.target_employee_id && sr.status === 'pending_approval' && sr.requester_id !== user?.employee_id
    );

    const formatToDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const currentRosterDates = useMemo(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        const days = [];
        let count = 7;
        if (rosterPeriod === "fortnightly") count = 14;
        if (rosterPeriod === "monthly") count = 31;

        let startDiff = 0;
        if (rosterPeriod === "weekly") startDiff = weekOffset * 7;
        if (rosterPeriod === "fortnightly") startDiff = weekOffset * 14;
        if (rosterPeriod === "monthly") {
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
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);

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
            role="manager"
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
                <div className="mb-8 p-4 bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning))] rounded-xl">
                    <h2 className="text-lg font-semibold text-[hsl(var(--warning-foreground))] mb-3 flex items-center gap-2">
                        <ArrowLeftRight size={18} /> Shift Swap Invitations
                    </h2>
                    <div className="space-y-3">
                        {pendingIncomingSwaps.map((sr: any) => (
                            <div key={sr.request_id} className="bg-white rounded-lg p-3 flex flex-wrap gap-4 items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-medium text-sm">
                                        <span className="font-bold">{sr.Requester?.first_name} {sr.Requester?.last_name}</span> wants to swap their shift:
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
                <div className="mb-8">
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
                                                    onClick={() => { setSelectedShift(s); setSwapDialogOpen(true); }}
                                                >
                                                    <div className="flex items-center gap-1 opacity-90 mb-0.5 capitalize">
                                                        <Clock size={10} /> {s.shift_type}
                                                    </div>
                                                    <div className="font-bold">
                                                        {s.start_time?.split('T')[1]?.substring(0, 5)}
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
                                                        <tr key={shift.shift_id} className="hover:bg-[hsl(var(--muted))]/5 transition-colors group">
                                                            <td className="px-4 py-4">
                                                                <p className="font-semibold text-sm">
                                                                    {new Date(shift.start_time).toLocaleDateString("en-AU", { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                </p>
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] font-bold text-[9px] uppercase mt-1">
                                                                    {shift.shift_type}
                                                                </span>
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
                                                                            onClick={() => { setSelectedShift(shift); setSwapDialogOpen(true); }}
                                                                            disabled={!!(swapRequests || []).find((sr: any) => 
                                                                                String(sr.shift_id) === String(shift.shift_id) && 
                                                                                ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                                            )}
                                                                        >
                                                                             <ArrowLeftRight size={12} /> Shift Actions
                                                                         </Button>
                                                                     )}
                                                                    
                                                                    {(swapRequests || []).find((sr: any) => 
                                                                        String(sr.shift_id) === String(shift.shift_id) && 
                                                                        String(sr.requester_id) === String(user?.employee_id) &&
                                                                        ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                                    ) && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 text-[10px] text-[hsl(var(--danger))] bg-[hsl(var(--danger-light))]/5 hover:bg-[hsl(var(--danger-light))]/15 border border-[hsl(var(--danger))]/10"
                                                                            onClick={() => {
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

            <ShiftSwapDialog 
                open={swapDialogOpen} 
                onOpenChange={setSwapDialogOpen} 
                shift={selectedShift} 
                role="manager"
            />
        </DashboardLayout>
    );
}
