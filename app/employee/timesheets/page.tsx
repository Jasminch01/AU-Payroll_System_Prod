"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { FileText, DollarSign, Clock, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { cn, formatDecimalHours } from "@/lib/utils";
import type { TimeSheet, TimesheetStatus } from "@/types/database";

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

export default function EmployeeTimesheetsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ["my-timesheets"],
        queryFn: () => apiGet<TimeSheet[]>("/timesheets"),
    });

    // Filter by status tab
    const filtered = activeTab === "all"
        ? timesheets
        : timesheets.filter((t) => t.status === activeTab);

    const counts: Record<TabKey, number> = {
        all: timesheets.length,
        pending: timesheets.filter((t) => t.status === "pending").length,
        approved: timesheets.filter((t) => t.status === "approved").length,
        rejected: timesheets.filter((t) => t.status === "rejected").length,
    };

    const totalHours = timesheets.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
    const totalPay = timesheets
        .filter((t) => t.status === "approved")
        .reduce((sum, t) => sum + (t.gross_pay || 0), 0);

    const parseTime = (dateStr: string, timeStr: string | null) => {
        if (!timeStr) return null;
        if (timeStr.includes("T")) return new Date(timeStr);
        return new Date(`${dateStr}T${timeStr}`);
    };

    const formatTimeDisplay = (dateStr: string, timeStr: string | null) => {
        const date = parseTime(dateStr, timeStr);
        if (!date || isNaN(date.getTime())) return "—";
        return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="Timesheets"
            pageDescription="View your work history and pay"
        >
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <MetricCard title="Total Hours" value={formatDecimalHours(totalHours)} icon={<Clock size={24} />} />
                <MetricCard title="Total Earnings" value={`$${totalPay.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} icon={<DollarSign size={24} />} />
                <MetricCard title="Timesheets" value={timesheets.length} icon={<FileText size={24} />} />
                <MetricCard title="Pending" value={counts.pending} icon={<CalendarDays size={24} />} />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "relative px-4 py-2.5 text-sm font-medium transition-colors",
                            activeTab === tab.key
                                ? "text-[hsl(var(--brand))]"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        )}
                    >
                        {tab.label}
                        <span className={cn(
                            "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                            activeTab === tab.key
                                ? "bg-[hsl(var(--brand))] text-white"
                                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                        )}>
                            {counts[tab.key]}
                        </span>
                        {activeTab === tab.key && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand))] rounded-t" />
                        )}
                    </button>
                ))}
            </div>

            {/* Timesheets List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <FileText size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {activeTab === "all" ? "No timesheets yet" : `No ${activeTab} timesheets`}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map((ts) => {
                        const isExpanded = expandedId === ts.timesheet_id;
                        return (
                            <Card key={ts.timesheet_id} className="overflow-hidden transition-shadow hover:shadow-md">
                                {/* Main Row */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : ts.timesheet_id)}
                                    className="flex w-full items-center justify-between p-4 text-left"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Date */}
                                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                                            <span className="text-xs font-medium leading-none">
                                                {new Date(ts.date).toLocaleDateString("en-AU", { month: "short" })}
                                            </span>
                                            <span className="text-lg font-bold leading-none mt-0.5">
                                                {new Date(ts.date).getDate()}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">
                                                {new Date(ts.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                            </p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                                                <span>{formatDecimalHours(ts.actual_hours)} worked</span>
                                                {ts.overtime_hours && ts.overtime_hours > 0 && (
                                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1 rounded border border-orange-100">
                                                        +{formatDecimalHours(ts.overtime_hours)} OT
                                                    </span>
                                                )}
                                                {ts.rate_type && <span className="mx-1">·</span>}
                                                {ts.rate_type && <span className="capitalize">{ts.rate_type.replace("_", " ")} rate</span>}
                                            </p>
                                        </div>

                                        {/* Key figures */}
                                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Rate</p>
                                                <p className="text-sm font-semibold">${ts.hourly_rate?.toFixed(2) ?? "—"}/hr</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Gross Pay</p>
                                                <p className="text-sm font-bold">${ts.gross_pay?.toFixed(2) ?? "0.00"}</p>
                                            </div>
                                        </div>

                                        <StatusBadge status={ts.status || "pending"} />
                                    </div>

                                    <div className="ml-3 shrink-0">
                                        {isExpanded ? <ChevronUp size={18} className="text-[hsl(var(--muted-foreground))]" /> : <ChevronDown size={18} className="text-[hsl(var(--muted-foreground))]" />}
                                    </div>
                                </button>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-4 py-4 animate-slide-up">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered Start</p>
                                                <p className="text-sm font-medium">
                                                    {formatTimeDisplay(ts.date, ts.rostered_start)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered End</p>
                                                <p className="text-sm font-medium">
                                                    {formatTimeDisplay(ts.date, ts.rostered_end)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Actual Start</p>
                                                <p className="text-sm font-medium">
                                                    {formatTimeDisplay(ts.date, ts.actual_start)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Actual End</p>
                                                <p className="text-sm font-medium">
                                                    {formatTimeDisplay(ts.date, ts.actual_end)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered Hours</p>
                                                <p className="text-sm font-medium">{formatDecimalHours(ts.rostered_hours)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Break Hours</p>
                                                <p className="text-sm font-medium text-slate-500">{formatDecimalHours(ts.break_hours)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Overtime Hours</p>
                                                <p className={cn("text-sm font-bold", (ts.overtime_hours ?? 0) > 0 ? "text-orange-600" : "text-slate-500")}>
                                                    {formatDecimalHours(ts.overtime_hours)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rate Type</p>
                                                <p className="text-sm font-medium capitalize">{ts.rate_type?.replace("_", " ") ?? "—"}</p>
                                            </div>
                                        </div>

                                        {/* Flags & Notes */}
                                        {(ts.flags || ts.notes) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                                {ts.flags && (
                                                    <div className="rounded-lg bg-[hsl(var(--warning-light))]/50 border border-[hsl(var(--warning))]/20 p-3">
                                                        <p className="text-xs font-medium text-[hsl(var(--warning))] mb-0.5">⚠ Flags</p>
                                                        <p className="text-sm">{ts.flags}</p>
                                                    </div>
                                                )}
                                                {ts.notes && (
                                                    <div className="rounded-lg bg-[hsl(var(--muted))] p-3">
                                                        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5">Notes</p>
                                                        <p className="text-sm">{ts.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Approved info */}
                                        {ts.approved_at && (
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
                                                {ts.status === "approved" ? "Approved" : "Reviewed"} at {new Date(ts.approved_at).toLocaleString("en-AU")}
                                            </p>
                                        )}

                                        {/* Mobile key figures */}
                                        <div className="flex sm:hidden items-center gap-4 mt-3 pt-3 border-t border-[hsl(var(--border))]">
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Rate</p>
                                                <p className="text-sm font-semibold">${ts.hourly_rate?.toFixed(2) ?? "—"}/hr</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Gross Pay</p>
                                                <p className="text-sm font-bold">${ts.gross_pay?.toFixed(2) ?? "0.00"}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </DashboardLayout>
    );
}
