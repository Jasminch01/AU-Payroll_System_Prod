"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, CalendarDays, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// Helper to format date
const formatToDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Same 24-hour time options as used in the roster and attendance pages
const TIME_OPTIONS = [
    "00:00", "00:15", "00:30", "00:45",
    "01:00", "01:15", "01:30", "01:45",
    "02:00", "02:15", "02:30", "02:45",
    "03:00", "03:15", "03:30", "03:45",
    "04:00", "04:15", "04:30", "04:45",
    "05:00", "05:15", "05:30", "05:45",
    "06:00", "06:15", "06:30", "06:45",
    "07:00", "07:15", "07:30", "07:45",
    "08:00", "08:15", "08:30", "08:45",
    "09:00", "09:15", "09:30", "09:45",
    "10:00", "10:15", "10:30", "10:45",
    "11:00", "11:15", "11:30", "11:45",
    "12:00", "12:15", "12:30", "12:45",
    "13:00", "13:15", "13:30", "13:45",
    "14:00", "14:15", "14:30", "14:45",
    "15:00", "15:15", "15:30", "15:45",
    "16:00", "16:15", "16:30", "16:45",
    "17:00", "17:15", "17:30", "17:45",
    "18:00", "18:15", "18:30", "18:45",
    "19:00", "19:15", "19:30", "19:45",
    "20:00", "20:15", "20:30", "20:45",
    "21:00", "21:15", "21:30", "21:45",
    "22:00", "22:15", "22:30", "22:45",
    "23:00", "23:15", "23:30", "23:45",
];

export default function EmployeeAvailabilityPage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [weekOffset, setWeekOffset] = useState(0);

    // Track locally edited times before saving
    const [editingTimes, setEditingTimes] = useState<Record<string, { from: string; to: string }>>({});

    // Calculate current week's dates (Monday to Sunday)
    const currentDates = useMemo(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        monday.setDate(monday.getDate() + weekOffset * 7);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(monday);
            next.setDate(monday.getDate() + i);
            days.push(next);
        }
        return days;
    }, [weekOffset]);

    const rangeStart = formatToDateString(currentDates[0]);
    const rangeEnd = formatToDateString(currentDates[6]);

    const { data: availability = [], isLoading } = useQuery({
        queryKey: ["availability", user?.employee_id, rangeStart, rangeEnd],
        queryFn: () =>
            apiGet<any[]>("/availability", {
                employee_id: user?.employee_id,
                from: rangeStart,
                to: rangeEnd,
            }),
        enabled: !!user?.employee_id,
    });

    const upsertAvailabilityMutation = useMutation({
        mutationFn: (data: { date: string; is_available: boolean; available_from?: string; available_to?: string; reason?: string }) =>
            apiPost("/availability", { ...data, employee_id: user?.employee_id }),
        onMutate: async (newAvail) => {
            await queryClient.cancelQueries({ queryKey: ["availability", user?.employee_id, rangeStart, rangeEnd] });
            const previous = queryClient.getQueryData(["availability", user?.employee_id, rangeStart, rangeEnd]);
            queryClient.setQueryData(["availability", user?.employee_id, rangeStart, rangeEnd], (old: any[] = []) => {
                const existingIndex = old.findIndex((a) => a.date === newAvail.date);
                if (existingIndex >= 0) {
                    const newArray = [...old];
                    newArray[existingIndex] = { ...old[existingIndex], ...newAvail };
                    return newArray;
                }
                return [...old, newAvail];
            });
            return { previous };
        },
        onSuccess: () => {
            toast.success("Availability updated");
        },
        onError: (err: Error, _, context: any) => {
            toast.error(err.message);
            if (context?.previous) {
                queryClient.setQueryData(["availability", user?.employee_id, rangeStart, rangeEnd], context.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["availability", user?.employee_id, rangeStart, rangeEnd] });
        },
    });

    const handleToggle = (date: string, currentStatus: boolean) => {
        upsertAvailabilityMutation.mutate({ date, is_available: !currentStatus });
    };

    const handleSaveTimes = (date: string, isAvailable: boolean) => {
        const times = editingTimes[date];
        if (!times) return;
        upsertAvailabilityMutation.mutate({
            date,
            is_available: isAvailable,
            available_from: times.from,
            available_to: times.to,
        });
        // Clear local edit state after save
        setEditingTimes((prev) => {
            const next = { ...prev };
            delete next[date];
            return next;
        });
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="My Availability"
            pageDescription="Set when you are available to work each day"
            actions={
                <div className="flex items-center gap-1 border border-[hsl(var(--border))] rounded-lg bg-white overflow-hidden shadow-sm">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r border-[hsl(var(--border))]" onClick={() => setWeekOffset((p) => p - 1)}>
                        <ChevronLeft size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 text-xs font-bold uppercase rounded-none px-4" onClick={() => setWeekOffset(0)}>
                        This Week
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border-l border-[hsl(var(--border))]" onClick={() => setWeekOffset((p) => p + 1)}>
                        <ChevronRight size={16} />
                    </Button>
                </div>
            }
        >
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <CalendarDays size={18} className="text-[hsl(var(--brand))]" />
                        Week of {currentDates[0].toLocaleDateString("en-AU", { day: "numeric", month: "short" })} –{" "}
                        {currentDates[6].toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {currentDates.map((day) => {
                        const dateStr = formatToDateString(day);
                        const isToday = dateStr === formatToDateString(new Date());
                        const record = availability.find((a: any) => a.date === dateStr);
                        const isAvailable = record ? record.is_available : true;

                        // Times: from local edit state first, then saved record, then defaults
                        const localEdit = editingTimes[dateStr];
                        const fromTime = localEdit?.from ?? record?.available_from ?? "09:00";
                        const toTime = localEdit?.to ?? record?.available_to ?? "17:00";
                        const hasLocalEdit = !!localEdit;

                        return (
                            <Card
                                key={dateStr}
                                className={cn(
                                    "border transition-all duration-200 overflow-hidden",
                                    isToday ? "border-[hsl(var(--brand))]/50 ring-1 ring-[hsl(var(--brand))]/20 shadow-md" : "border-[hsl(var(--border))]",
                                    !isAvailable && "bg-[hsl(var(--muted))]/30 border-[hsl(var(--muted))]"
                                )}
                            >
                                {/* Status bar */}
                                <div className={cn("h-1.5 w-full", isAvailable ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--muted-foreground))]/40")} />

                                <CardContent className="p-5">
                                    {/* Date header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <p className={cn("text-xs font-bold uppercase tracking-wider mb-1", isToday ? "text-[hsl(var(--brand))]" : "text-[hsl(var(--muted-foreground))]")}>
                                                {day.toLocaleDateString("en-AU", { weekday: "long" })}
                                            </p>
                                            <p className="text-2xl font-semibold">
                                                {day.getDate()}{" "}
                                                <span className="text-lg text-[hsl(var(--muted-foreground))]/70 font-medium">
                                                    {day.toLocaleDateString("en-AU", { month: "short" })}
                                                </span>
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                                            isAvailable ? "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                        )}>
                                            {isAvailable ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {isAvailable ? "Available" : "Unavailable"}
                                        </div>
                                    </div>

                                    {/* Time Range Pickers — only shown when available */}
                                    {isAvailable && (
                                        <div className="mb-4 space-y-2">
                                            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider flex items-center gap-1">
                                                <Clock size={11} /> Available Hours
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-bold uppercase tracking-widest block mb-1">From</label>
                                                    <select
                                                        value={fromTime}
                                                        onChange={(e) =>
                                                            setEditingTimes((prev) => ({
                                                                ...prev,
                                                                [dateStr]: { from: e.target.value, to: prev[dateStr]?.to ?? toTime },
                                                            }))
                                                        }
                                                        className="w-full text-sm border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/30 font-medium tabular-nums"
                                                    >
                                                        {TIME_OPTIONS.map((t) => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-[hsl(var(--muted-foreground))] font-bold uppercase tracking-widest block mb-1">To</label>
                                                    <select
                                                        value={toTime}
                                                        onChange={(e) =>
                                                            setEditingTimes((prev) => ({
                                                                ...prev,
                                                                [dateStr]: { from: prev[dateStr]?.from ?? fromTime, to: e.target.value },
                                                            }))
                                                        }
                                                        className="w-full text-sm border border-[hsl(var(--border))] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/30 font-medium tabular-nums"
                                                    >
                                                        {TIME_OPTIONS.map((t) => (
                                                            <option key={t} value={t}>{t}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Saved time summary if no local edit */}
                                            {!hasLocalEdit && record?.available_from && (
                                                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                                                    ✓ Saved: {record.available_from} – {record.available_to}
                                                </p>
                                            )}

                                            {/* Save button — only shows when times are edited */}
                                            {hasLocalEdit && (
                                                <Button
                                                    size="sm"
                                                    className="w-full h-7 text-xs mt-1 bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))] text-white"
                                                    onClick={() => handleSaveTimes(dateStr, isAvailable)}
                                                    disabled={upsertAvailabilityMutation.isPending}
                                                >
                                                    Save Times
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Availability toggle */}
                                    <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Available this day</span>
                                        <Switch
                                            checked={isAvailable}
                                            onCheckedChange={() => handleToggle(dateStr, isAvailable)}
                                            className="data-[state=checked]:bg-[hsl(var(--success))] data-[state=unchecked]:bg-[hsl(var(--muted-foreground))]/40"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="mt-8 p-4 bg-[hsl(var(--brand-light))]/10 border border-[hsl(var(--brand))]/20 rounded-xl max-w-2xl">
                <h3 className="font-semibold text-[hsl(var(--brand))] mb-2 text-sm">How Availability Works</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                    By default, you are <strong className="text-[hsl(var(--foreground))]">Available</strong> every day. Toggle a day off to mark yourself as{" "}
                    <strong className="text-[hsl(var(--foreground))]">Unavailable</strong>. When available, you can also set your preferred working hours so managers
                    know when to schedule you.
                </p>
            </div>
        </DashboardLayout>
    );
}
