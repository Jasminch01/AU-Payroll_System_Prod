"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import {
    CheckCircle, XCircle, Clock, DollarSign, FileText,
    ChevronDown, ChevronUp, CalendarDays, User, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeSheet, TimesheetStatus } from "@/types/database";

interface TimesheetRecord extends TimeSheet {
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
}

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string; color: string }[] = [
    { key: "all", label: "All", color: "" },
    { key: "pending", label: "Pending", color: "text-[hsl(var(--warning))]" },
    { key: "approved", label: "Approved", color: "text-[hsl(var(--success))]" },
    { key: "rejected", label: "Rejected", color: "text-[hsl(var(--danger))]" },
];

export default function OwnerTimesheetsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ["timesheets"],
        queryFn: () => apiGet<TimesheetRecord[]>("/timesheets"),
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TimesheetStatus }) =>
            apiPut(`/timesheets/${id}`, { status }),
        onSuccess: () => {
            toast.success("Timesheet updated");
            queryClient.invalidateQueries({ queryKey: ["timesheets"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Filter by status tab
    const filtered = activeTab === "all"
        ? timesheets
        : timesheets.filter((t) => t.status === activeTab);

    // Counts for tabs
    const counts: Record<TabKey, number> = {
        all: timesheets.length,
        pending: timesheets.filter((t) => t.status === "pending").length,
        approved: timesheets.filter((t) => t.status === "approved").length,
        rejected: timesheets.filter((t) => t.status === "rejected").length,
    };

    // Summary stats
    const totalHours = timesheets.reduce((s, t) => s + (t.actual_hours || 0), 0);
    const totalGrossPay = timesheets
        .filter((t) => t.status === "approved")
        .reduce((s, t) => s + (t.gross_pay || 0), 0);

    const getEmployeeName = (ts: TimesheetRecord) => {
        const emp = ts.Employee;
        if (emp) return `${emp.first_name} ${emp.last_name}`;
        return ts.employee_id?.slice(0, 8) + "…";
    };

    const getEmployeeInitials = (ts: TimesheetRecord) => {
        const emp = ts.Employee;
        if (emp) return `${emp.first_name?.[0] ?? ""}${emp.last_name?.[0] ?? ""}`;
        return "??";
    };

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Timesheets"
            pageDescription="Review and approve employee timesheets"
        >
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <MetricCard title="Total Timesheets" value={timesheets.length} icon={<FileText size={24} />} />
                <MetricCard title="Pending Approval" value={counts.pending} icon={<Clock size={24} />} />
                <MetricCard title="Total Hours" value={`${totalHours.toFixed(1)}h`} icon={<CalendarDays size={24} />} />
                <MetricCard title="Approved Pay" value={`$${totalGrossPay.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} icon={<DollarSign size={24} />} />
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
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <FileText size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {activeTab === "all" ? "No timesheets found" : `No ${activeTab} timesheets`}
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
                                        {/* Avatar */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                                            {getEmployeeInitials(ts)}
                                        </div>

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium truncate">{getEmployeeName(ts)}</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {new Date(ts.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                                                {ts.Employee?.role_title && <span className="mx-1.5">·</span>}
                                                {ts.Employee?.role_title}
                                            </p>
                                        </div>

                                        {/* Key figures */}
                                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Hours</p>
                                                <p className="text-sm font-semibold">{ts.actual_hours?.toFixed(1) ?? "—"}h</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Rate</p>
                                                <p className="text-sm font-semibold">${ts.hourly_rate?.toFixed(2) ?? "—"}/hr</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Gross Pay</p>
                                                <p className="text-sm font-semibold">${ts.gross_pay?.toFixed(2) ?? "0.00"}</p>
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
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered Start</p>
                                                <p className="text-sm font-medium">
                                                    {ts.roster_start ? new Date(ts.roster_start).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered End</p>
                                                <p className="text-sm font-medium">
                                                    {ts.roster_end ? new Date(ts.roster_end).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Actual Start</p>
                                                <p className="text-sm font-medium">
                                                    {ts.actual_start ? new Date(ts.actual_start).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Actual End</p>
                                                <p className="text-sm font-medium">
                                                    {ts.actual_end ? new Date(ts.actual_end).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered Hours</p>
                                                <p className="text-sm font-medium">{ts.rostered_hours?.toFixed(1) ?? "—"}h</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rate Type</p>
                                                <p className="text-sm font-medium capitalize">{ts.rate_type?.replace("_", " ") ?? "—"}</p>
                                            </div>
                                        </div>

                                        {/* Flags & Notes */}
                                        {(ts.flags || ts.notes) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                                        {ts.approved_by && (
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                                                {ts.status === "approved" ? "Approved" : "Reviewed"} at {ts.approved_at ? new Date(ts.approved_at).toLocaleString("en-AU") : "—"}
                                            </p>
                                        )}

                                        {/* Actions for pending */}
                                        {ts.status === "pending" && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[hsl(var(--danger))]"
                                                    onClick={() => approveMutation.mutate({ id: ts.timesheet_id, status: "rejected" })}
                                                    loading={approveMutation.isPending}
                                                >
                                                    <XCircle size={16} /> Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    onClick={() => approveMutation.mutate({ id: ts.timesheet_id, status: "approved" })}
                                                    loading={approveMutation.isPending}
                                                >
                                                    <CheckCircle size={16} /> Approve
                                                </Button>
                                            </div>
                                        )}
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
