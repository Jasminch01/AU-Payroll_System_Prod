"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPut, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import {
    CheckCircle, XCircle, Clock, DollarSign, FileText,
    ChevronDown, ChevronUp, CalendarDays, User, Pencil,
    Plus, Search, AlertTriangle, Filter, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeSheet, TimesheetStatus } from "@/types/database";

/* ── Types ─────────────────────────────────────────────── */

interface TimesheetRecord extends TimeSheet {
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
}

interface EmployeeOption {
    employee_id: string;
    first_name: string;
    last_name: string;
    role_title: string;
}

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

/* ── Page Component ────────────────────────────────────── */

export default function OwnerTimesheetsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [employeeFilter, setEmployeeFilter] = useState<string>("all");

    // Generate dialog
    const [generateOpen, setGenerateOpen] = useState(false);
    const [genStartDate, setGenStartDate] = useState("");
    const [genEndDate, setGenEndDate] = useState("");
    const [genEmployeeId, setGenEmployeeId] = useState("");

    // Edit dialog
    const [editOpen, setEditOpen] = useState(false);
    const [editingTs, setEditingTs] = useState<TimesheetRecord | null>(null);
    const [editHours, setEditHours] = useState("");
    const [editGrossPay, setEditGrossPay] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editFlags, setEditFlags] = useState("");
    const [editStatus, setEditStatus] = useState<TimesheetStatus>("pending");

    // Reset generate form when dialog closes
    useEffect(() => {
        if (!generateOpen) {
            setGenStartDate("");
            setGenEndDate("");
            setGenEmployeeId("");
        }
    }, [generateOpen]);

    // Reset edit form when dialog closes
    useEffect(() => {
        if (!editOpen) {
            setEditingTs(null);
            setEditHours("");
            setEditGrossPay("");
            setEditNotes("");
            setEditFlags("");
            setEditStatus("pending");
        }
    }, [editOpen]);

    /* ── Queries ────────────────────────────────────────── */

    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ["timesheets"],
        queryFn: () => apiGet<TimesheetRecord[]>("/timesheets"),
    });

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<EmployeeOption[]>("/employees"),
    });

    /* ── Mutations ──────────────────────────────────────── */

    const approveMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TimesheetStatus }) =>
            apiPut(`/timesheets/${id}`, { status }),
        onSuccess: () => {
            toast.success("Timesheet updated");
            queryClient.invalidateQueries({ queryKey: ["timesheets"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const generateMutation = useMutation({
        mutationFn: (data: { start_date: string; end_date: string; employee_id?: string }) =>
            apiPost("/timesheets/generate", data),
        onSuccess: (data: any) => {
            const count = Array.isArray(data) ? data.length : 0;
            toast.success(`Generated ${count} timesheet(s) successfully!`);
            queryClient.invalidateQueries({ queryKey: ["timesheets"] });
            setGenerateOpen(false);
            setGenStartDate("");
            setGenEndDate("");
            setGenEmployeeId("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, ...body }: { id: string; actual_hours?: number; gross_pay?: number; notes?: string; flags?: string; status?: TimesheetStatus }) =>
            apiPut(`/timesheets/${id}`, body),
        onSuccess: () => {
            toast.success("Timesheet adjusted successfully");
            queryClient.invalidateQueries({ queryKey: ["timesheets"] });
            setEditOpen(false);
            setEditingTs(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    /* ── Filtering & Derived State ──────────────────────── */

    const filtered = useMemo(() => {
        let list = timesheets;

        // Status tab filter
        if (activeTab !== "all") {
            list = list.filter((t) => t.status === activeTab);
        }

        // Employee filter
        if (employeeFilter !== "all") {
            list = list.filter((t) => t.employee_id === employeeFilter);
        }

        // Search by employee name
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter((t) => {
                const name = t.Employee
                    ? `${t.Employee.first_name} ${t.Employee.last_name}`.toLowerCase()
                    : "";
                return name.includes(q) || t.date?.includes(q);
            });
        }

        return list;
    }, [timesheets, activeTab, employeeFilter, searchTerm]);

    const counts: Record<TabKey, number> = {
        all: timesheets.length,
        pending: timesheets.filter((t) => t.status === "pending").length,
        approved: timesheets.filter((t) => t.status === "approved").length,
        rejected: timesheets.filter((t) => t.status === "rejected").length,
    };

    const totalHours = timesheets.reduce((s, t) => s + (t.actual_hours || 0), 0);
    const totalGrossPay = timesheets
        .filter((t) => t.status === "approved")
        .reduce((s, t) => s + (t.gross_pay || 0), 0);

    /* ── Unique employees for dropdown ──────────────────── */

    const uniqueEmployees = useMemo(() => {
        const map = new Map<string, { id: string; name: string }>();
        timesheets.forEach((t) => {
            if (t.Employee && t.employee_id) {
                map.set(t.employee_id, {
                    id: t.employee_id,
                    name: `${t.Employee.first_name} ${t.Employee.last_name}`,
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [timesheets]);

    /* ── Helpers ─────────────────────────────────────────── */

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

    const openEditDialog = (ts: TimesheetRecord) => {
        setEditingTs(ts);
        setEditHours(ts.actual_hours?.toString() ?? "");
        setEditGrossPay(ts.gross_pay?.toString() ?? "");
        setEditNotes(ts.notes ?? "");
        setEditFlags(ts.flags ?? "");
        setEditStatus(ts.status || "pending");
        setEditOpen(true);
    };

    const handleGenerate = () => {
        if (!genStartDate || !genEndDate) {
            toast.error("Please select start and end dates");
            return;
        }
        if (new Date(genStartDate) > new Date(genEndDate)) {
            toast.error("Start date must be before end date");
            return;
        }
        const payload: { start_date: string; end_date: string; employee_id?: string } = {
            start_date: genStartDate,
            end_date: genEndDate,
        };
        if (genEmployeeId) payload.employee_id = genEmployeeId;
        generateMutation.mutate(payload);
    };

    const handleSaveEdit = () => {
        if (!editingTs) return;
        editMutation.mutate({
            id: editingTs.timesheet_id,
            actual_hours: editHours ? parseFloat(editHours) : undefined,
            gross_pay: editGrossPay ? parseFloat(editGrossPay) : undefined,
            notes: editNotes || undefined,
            flags: editFlags || undefined,
            status: editStatus,
        });
    };

    const hasFlags = (ts: TimesheetRecord) => {
        return ts.flags && ts.flags.trim().length > 0;
    };

    /* ── Render ──────────────────────────────────────────── */

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Timesheets"
            pageDescription="Review, generate, and manage employee timesheets"
            actions={
                <Button id="generate-timesheets-btn" onClick={() => setGenerateOpen(true)}>
                    <Zap size={16} /> Generate Timesheets
                </Button>
            }
        >
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <MetricCard title="Total Timesheets" value={timesheets.length} icon={<FileText size={24} />} />
                <MetricCard title="Pending Approval" value={counts.pending} icon={<Clock size={24} />} />
                <MetricCard title="Total Hours" value={`${totalHours.toFixed(1)}h`} icon={<CalendarDays size={24} />} />
                <MetricCard title="Approved Pay" value={`$${totalGrossPay.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`} icon={<DollarSign size={24} />} />
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                        id="search-timesheets"
                        type="text"
                        placeholder="Search by name or date…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent pl-9 pr-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                    />
                </div>

                {/* Employee Filter */}
                <div className="relative">
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <select
                        id="employee-filter"
                        value={employeeFilter}
                        onChange={(e) => setEmployeeFilter(e.target.value)}
                        className="h-10 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-8 pr-8 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))] appearance-none cursor-pointer"
                    >
                        <option value="all">All Employees</option>
                        {uniqueEmployees.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] pointer-events-none" />
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        id={`tab-${tab.key}`}
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
                        <p className="text-sm text-[hsl(var(--muted-foreground))]/60 mt-1">
                            Use the "Generate Timesheets" button to create timesheets from attendance data.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map((ts) => {
                        const isExpanded = expandedId === ts.timesheet_id;
                        const flagged = hasFlags(ts);
                        return (
                            <Card
                                key={ts.timesheet_id}
                                className={cn(
                                    "overflow-hidden transition-shadow hover:shadow-md",
                                    flagged && ts.status === "pending" && "border-l-4 border-l-[hsl(var(--warning))]"
                                )}
                            >
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
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium truncate">{getEmployeeName(ts)}</p>
                                                {flagged && (
                                                    <AlertTriangle size={14} className="shrink-0 text-[hsl(var(--warning))]" />
                                                )}
                                            </div>
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
                                                    {formatTimeDisplay(ts.date, ts.roster_start)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">Rostered End</p>
                                                <p className="text-sm font-medium">
                                                    {formatTimeDisplay(ts.date, ts.roster_end)}
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
                                                    <div className="rounded-lg bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 p-3">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <AlertTriangle size={14} className="text-[hsl(var(--warning))]" />
                                                            <p className="text-xs font-semibold text-[hsl(var(--warning))]">Flags</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {ts.flags.split(",").map((flag, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="inline-flex items-center rounded-md bg-[hsl(var(--warning))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning))]"
                                                                >
                                                                    {flag.trim()}
                                                                </span>
                                                            ))}
                                                        </div>
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

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
                                            {/* Edit button — always available for owner */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditDialog(ts);
                                                }}
                                            >
                                                <Pencil size={14} /> Edit / Adjust
                                            </Button>

                                            {ts.status === "pending" && (
                                                <>
                                                    <div className="flex-1" />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-[hsl(var(--danger))]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveMutation.mutate({ id: ts.timesheet_id, status: "rejected" });
                                                        }}
                                                        loading={approveMutation.isPending}
                                                    >
                                                        <XCircle size={16} /> Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="success"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveMutation.mutate({ id: ts.timesheet_id, status: "approved" });
                                                        }}
                                                        loading={approveMutation.isPending}
                                                    >
                                                        <CheckCircle size={16} /> Approve
                                                    </Button>
                                                </>
                                            )}

                                            {ts.status === "rejected" && (
                                                <>
                                                    <div className="flex-1" />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            approveMutation.mutate({ id: ts.timesheet_id, status: "pending" });
                                                        }}
                                                        loading={approveMutation.isPending}
                                                    >
                                                        <Clock size={14} /> Revert to Pending
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Generate Timesheets Dialog ────────────────── */}
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Timesheets</DialogTitle>
                        <DialogDescription>
                            Create timesheets from attendance logs and roster data for the selected date range.
                            Existing pending timesheets will be updated with the latest data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <Input
                            id="gen-start-date"
                            label="Start Date"
                            type="date"
                            value={genStartDate}
                            onChange={(e) => setGenStartDate(e.target.value)}
                        />
                        <Input
                            id="gen-end-date"
                            label="End Date"
                            type="date"
                            value={genEndDate}
                            onChange={(e) => setGenEndDate(e.target.value)}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                                Employee <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <select
                                    id="gen-employee"
                                    value={genEmployeeId}
                                    onChange={(e) => setGenEmployeeId(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))] appearance-none cursor-pointer"
                                >
                                    <option value="">All Employees</option>
                                    {employees.map((e) => (
                                        <option key={e.employee_id} value={e.employee_id}>
                                            {e.first_name} {e.last_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] pointer-events-none" />
                            </div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Leave blank to generate for all employees with attendance data in the range.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerate} loading={generateMutation.isPending}>
                            <Zap size={16} /> Generate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit / Adjust Timesheet Dialog ────────────── */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Timesheet</DialogTitle>
                        <DialogDescription>
                            Manually adjust hours, pay, and status for{" "}
                            <strong>{editingTs ? getEmployeeName(editingTs) : ""}</strong> on{" "}
                            <strong>
                                {editingTs
                                    ? new Date(editingTs.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                                    : ""}
                            </strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="edit-hours"
                                label="Actual Hours"
                                type="number"
                                step="0.25"
                                min="0"
                                value={editHours}
                                onChange={(e) => setEditHours(e.target.value)}
                                hint="Decimal hours (e.g. 7.5)"
                            />
                            <Input
                                id="edit-gross-pay"
                                label="Gross Pay ($)"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editGrossPay}
                                onChange={(e) => setEditGrossPay(e.target.value)}
                            />
                        </div>

                        {/* Status selector */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Status</label>
                            <div className="flex gap-2">
                                {(["pending", "approved", "rejected"] as TimesheetStatus[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setEditStatus(s)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize",
                                            editStatus === s
                                                ? s === "approved"
                                                    ? "bg-[hsl(var(--success))]/10 border-[hsl(var(--success))] text-[hsl(var(--success))]"
                                                    : s === "rejected"
                                                        ? "bg-[hsl(var(--danger))]/10 border-[hsl(var(--danger))] text-[hsl(var(--danger))]"
                                                        : "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))] text-[hsl(var(--warning))]"
                                                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                                        )}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Input
                            id="edit-notes"
                            label="Notes"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            hint="Internal notes about this adjustment"
                        />

                        <Input
                            id="edit-flags"
                            label="Flags"
                            value={editFlags}
                            onChange={(e) => setEditFlags(e.target.value)}
                            hint="Comma-separated flags (e.g. Late Clock-in, Missing Clock-out)"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} loading={editMutation.isPending}>
                            <CheckCircle size={16} /> Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
