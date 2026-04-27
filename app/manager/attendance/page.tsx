"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { groupAttendanceIntoSessions } from "@/lib/attendance-grouper";
import { ManualEntryModal } from "@/components/attendance/manual-entry-modal";
import {
    Clock,
    ArrowDownCircle,
    ArrowUpCircle,
    AlertCircle,
    Monitor,
    X,
    Layers,
    Timer,
    ChevronRight,
    Plus,
    Edit2,
    Coffee,
    ArrowRight
} from "lucide-react";
import type { AttendanceLog } from "@/types/database";
import { cn } from "@/lib/utils";
import { EditAttendanceModal } from "@/components/attendance/edit-attendance-modal";
import { useBusinessTimezone } from "@/lib/timezone-context";

/* ===== Types ===== */

interface AttendanceRecord extends AttendanceLog {
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
}

/** A single clock-in → clock-out pair */
interface Session {
    breaks: any;
    clock_in: string | null;
    clock_out: string | null;
    duration_minutes: number | null; // null when session is still open
    is_manual: boolean;
    device_info: string;
}

interface GroupedAttendance {
    id: string;
    employee_id: string;
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
    date: string;
    first_in: string | null;
    last_out: string | null;
    sessions: Session[];
    total_hours: number; // sum of completed session durations
    is_manual: boolean;
    device_info: string;
    override_reason?: string;
    raw_logs: AttendanceRecord[];
}

/* ===== Helpers ===== */

function todayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(totalMinutes: number): string {
    if (totalMinutes <= 0) return "0h 0m";
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null, timezone: string) {
    if (!iso) return "--:--";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "--:--";

    return new Intl.DateTimeFormat("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone
    }).format(date);
}

/* ===== Component ===== */

export default function ManagerAttendancePage() {
    const { businessTimezone } = useBusinessTimezone();
    const today = todayDateString();
    const [fromDate, setFromDate] = useState<string>(today);
    const [toDate, setToDate] = useState<string>(today);
    const [detailRow, setDetailRow] = useState<GroupedAttendance | null>(null);
    const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const queryClient = useQueryClient();

    // Supabase Realtime Subscription for live updates
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('manager-attendance-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'AttendanceLog'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["attendance-raw"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const { data: employees = [] } = useQuery({
        queryKey: ["employees-active"],
        queryFn: () => apiGet<any[]>("/employees?status=active"),
    });

    const queryParams: Record<string, string> = {};
    if (fromDate) queryParams.from = fromDate;
    if (toDate) queryParams.to = toDate;

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["attendance-raw", fromDate, toDate],
        queryFn: () =>
            apiGet<AttendanceRecord[]>("/attendance", queryParams),
    });

    /* ── Session-aware grouping ── */
    const groupedRecords = useMemo(() => {
        // Use the new cross-midnight aware grouping function
        const groupedSessions = groupAttendanceIntoSessions(records, businessTimezone);

        return groupedSessions
            .flatMap((group) =>
                group.sessions.map((session) => {
                    // Build a Session object for each work session
                    const sessionObj: Session = {
                        clock_in: session.clock_in?.timestamp ?? null,
                        clock_out: session.clock_out?.timestamp ?? null,
                        duration_minutes: session.duration_minutes,
                        is_manual: !!session.clock_in?.override_by || !!session.clock_out?.override_by,
                        device_info: [
                            session.clock_in?.device_info,
                            session.clock_out?.device_info,
                        ]
                            .filter(Boolean)
                            .join(", "),
                        breaks: undefined
                    };

                    const totalMinutes = session.duration_minutes ?? 0;

                    return {
                        id: `${group.employee_id}_${group.clock_in_date}_${session.clock_in?.timestamp}`,
                        employee_id: group.employee_id,
                        Employee: group.Employee,
                        date: group.clock_in_date,
                        first_in: session.clock_in?.timestamp ?? null,
                        last_out: session.clock_out?.timestamp ?? null,
                        sessions: [sessionObj],
                        total_hours: totalMinutes,
                        is_manual:
                            !!session.clock_in?.override_by ||
                            !!session.clock_out?.override_by,
                        device_info: [
                            session.clock_in?.device_info,
                            session.clock_out?.device_info,
                        ]
                            .filter(Boolean)
                            .join(", "),
                        override_reason: [
                            session.clock_in?.override_reason,
                            session.clock_out?.override_reason,
                        ]
                            .filter(Boolean)
                            .join("; "),
                        raw_logs: session.all_logs as AttendanceRecord[],
                    } as GroupedAttendance;
                })
            )
            .sort((a, b) => {
                const dateA = new Date(a.first_in || a.date).getTime();
                const dateB = new Date(b.first_in || b.date).getTime();
                return dateB - dateA;
            });
    }, [records, businessTimezone]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return groupedRecords;
        
        const q = searchQuery.toLowerCase();
        return groupedRecords.filter(row => {
            const firstName = row.Employee?.first_name?.toLowerCase() || "";
            const lastName = row.Employee?.last_name?.toLowerCase() || "";
            const fullName = `${firstName} ${lastName}`;
            return fullName.includes(q) || firstName.includes(q) || lastName.includes(q);
        });
    }, [groupedRecords, searchQuery]);
    // Extract unique employees for manual entry modal
    const uniqueEmployees = useMemo(() => {
        const employees = new Map<string, { employee_id: string; first_name: string; last_name: string }>();
        for (const record of groupedRecords) {
            if (record.Employee && !employees.has(record.employee_id)) {
                employees.set(record.employee_id, {
                    employee_id: record.employee_id,
                    first_name: record.Employee.first_name,
                    last_name: record.Employee.last_name,
                });
            }
        }
        return Array.from(employees.values()).sort((a, b) =>
            `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        );
    }, [groupedRecords]);

    /* ── Table columns ── */
    const columns: Column<GroupedAttendance>[] = [
        {
            key: "employee_name",
            label: "Employee",
            sortable: true,
            render: (row) => {
                const emp = row.Employee;
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold shadow-sm">
                            {emp?.first_name?.[0] ?? ""}
                            {emp?.last_name?.[0] ?? ""}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-[hsl(var(--foreground))]">
                                {emp
                                    ? `${emp.first_name} ${emp.last_name}`
                                    : row.employee_id?.slice(0, 8) + "…"}
                            </p>
                            {emp?.role_title && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {emp.role_title}
                                </p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: "date",
            label: "Date",
            sortable: true,
            render: (row) => (
                <div className="text-sm font-medium">
                    {new Date(row.date).toLocaleDateString("en-AU", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                    })}
                </div>
            ),
        },
        {
            key: "first_in",
            label: "First In",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <ArrowDownCircle
                        size={16}
                        className={cn(
                            row.first_in
                                ? "text-[hsl(var(--success))]"
                                : "text-[hsl(var(--muted-foreground))]/40"
                        )}
                    />
                    <span
                        className={cn(
                            "text-sm font-medium",
                            row.first_in
                                ? "text-[hsl(var(--foreground))]"
                                : "text-[hsl(var(--muted-foreground))]/50"
                        )}
                    >
                        {formatTime(row.first_in, businessTimezone)}
                    </span>
                </div>
            ),
        },
        {
            key: "last_out",
            label: "Last Out",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <ArrowUpCircle
                        size={16}
                        className={cn(
                            row.last_out
                                ? "text-[hsl(var(--warning))]"
                                : "text-[hsl(var(--muted-foreground))]/40"
                        )}
                    />
                    <span
                        className={cn(
                            "text-sm font-medium",
                            row.last_out
                                ? "text-[hsl(var(--foreground))]"
                                : "text-[hsl(var(--muted-foreground))]/50"
                        )}
                    >
                        {formatTime(row.last_out, businessTimezone)}
                    </span>
                </div>
            ),
        },
        {
            key: "total_hours",
            label: "Total Hours",
            sortable: true,
            render: (row) => {
                const hasIncomplete = row.sessions.some(
                    (s) => !s.clock_in || !s.clock_out
                );
                return (
                    <div className="flex items-center gap-2">
                        <Timer size={14} className="text-[hsl(var(--brand))] shrink-0" />
                        <span className="text-sm font-semibold tabular-nums">
                            {formatDuration(row.total_hours)}
                        </span>
                        {hasIncomplete && (
                            <span
                                className="text-[10px] font-medium text-[hsl(var(--warning))] bg-[hsl(var(--warning-light))] px-1.5 py-0.5 rounded-full"
                                title="Incomplete session — missing clock in or out"
                            >
                                partial
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: "sessions_count",
            label: "Sessions",
            render: (row) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setDetailRow(row);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))] hover:bg-[hsl(var(--brand))]/15 px-2.5 py-1 rounded-full transition-colors"
                >
                    <Layers size={12} />
                    {row.sessions.length} {row.sessions.length === 1 ? "session" : "sessions"}
                </button>
            ),
        },
        {
            key: "override",
            label: "Status",
            render: (row) => {
                if (!row.is_manual) return <StatusBadge status="auto" label="Auto" />;
                return (
                    <div className="flex flex-col gap-0.5">
                        <StatusBadge status="manual" label="Manual" />
                        {row.override_reason && (
                            <p
                                className="text-[10px] text-[hsl(var(--muted-foreground))] italic truncate max-w-30"
                                title={row.override_reason}
                            >
                                {row.override_reason}
                            </p>
                        )}
                    </div>
                );
            },
        },
    ];

    /* ── Summary stats ── */
    const totalSessions = filteredData.length;
    const missingPunch = filteredData.filter(
        (r) => r.sessions.some((s) => !s.clock_in || !s.clock_out)
    ).length;
    const manualEntries = filteredData.filter((r) => r.is_manual).length;
    const totalWorkedMinutes = filteredData.reduce(
        (sum, r) => sum + r.total_hours,
        0
    );

    const handleRowClick = useCallback((row: GroupedAttendance) => {
        setDetailRow(row);
    }, []);

    return (
        <DashboardLayout
            role="manager"
            pageTitle="Attendance"
            pageDescription="Review employee clock in/out records"
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                            Total Shifts
                        </p>
                        <p className="text-2xl font-bold mt-0.5">{totalSessions}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--success-light))] text-[hsl(var(--success))]">
                        <Timer size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                            Total Hours
                        </p>
                        <p className="text-2xl font-bold mt-0.5">
                            {formatDuration(totalWorkedMinutes)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))]">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-[hsl(var(--warning))] uppercase tracking-wider">
                            Incomplete
                        </p>
                        <p className="text-2xl font-bold mt-0.5">{missingPunch}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--info-light))] text-[hsl(var(--info))]">
                        <Monitor size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-[hsl(var(--info))] uppercase tracking-wider">
                            Manual Entries
                        </p>
                        <p className="text-2xl font-bold mt-0.5">{manualEntries}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                            From
                        </span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="bg-transparent text-sm focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                            To
                        </span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="bg-transparent text-sm focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setFromDate(today);
                            setToDate(today);
                        }}
                        className={cn(
                            "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                            fromDate === today && toDate === today
                                ? "bg-[hsl(var(--brand))] text-white"
                                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--brand-light))] hover:text-[hsl(var(--brand))]"
                        )}
                    >
                        Today
                    </button>
                    {(fromDate !== today || toDate !== today) && (
                        <button
                            onClick={() => {
                                setFromDate("");
                                setToDate("");
                            }}
                            className="text-xs font-medium text-[hsl(var(--brand))] hover:underline underline-offset-4"
                        >
                            All Time
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsManualEntryModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white text-sm font-medium hover:bg-[hsl(var(--brand))]/90 transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    Manual Entry
                </button>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={filteredData}
                searchable
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by employee or date..."
                emptyMessage="No attendance records found for this period"
                emptyIcon={<Clock size={40} />}
                loading={isLoading}
                onRowClick={handleRowClick}
                pageSize={10}
                maxHeight="calc(100vh - 430px)"
                mobileCardRender={(row) => (
                    <div className="p-4 flex flex-col gap-3 border-b border-[hsl(var(--border))] last:border-0 active:bg-[hsl(var(--muted))]/30 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold shadow-sm">
                                    {row.Employee?.first_name?.[0] ?? ""}{row.Employee?.last_name?.[0] ?? ""}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[hsl(var(--foreground))]">
                                        {row.Employee ? `${row.Employee.first_name} ${row.Employee.last_name}` : "Unknown"}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">
                                        {new Date(row.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-black text-[hsl(var(--brand))]">{formatDuration(row.total_hours)}</span>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-bold">{row.sessions.length} {row.sessions.length === 1 ? 'session' : 'sessions'}</span>
                                </div>
                                <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]/40" />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--success))] font-bold bg-[hsl(var(--success-light))]/20 px-2 py-1 rounded-lg">
                                <ArrowDownCircle size={12} />
                                {formatTime(row.first_in, businessTimezone)}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--warning))] font-bold bg-[hsl(var(--warning-light))]/20 px-2 py-1 rounded-lg">
                                <ArrowUpCircle size={12} />
                                {formatTime(row.last_out, businessTimezone)}
                            </div>
                            {row.is_manual && <StatusBadge status="manual" className="scale-75 origin-left" />}
                        </div>
                    </div>
                )}
            />

            {/* ── Session Detail Modal ── */}
            {detailRow && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setDetailRow(null)}
                >
                    <div
                        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl animate-in zoom-in-95 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[hsl(var(--border))]">
                            <div>
                                <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
                                    Session Breakdown
                                </h3>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                                    {detailRow.Employee
                                        ? `${detailRow.Employee.first_name} ${detailRow.Employee.last_name}`
                                        : detailRow.employee_id?.slice(0, 8) + "…"}{" "}
                                    ·{" "}
                                    {new Date(detailRow.date).toLocaleDateString("en-AU", {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailRow(null)}
                                className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
                            <div className="space-y-3">
                                {detailRow.sessions.map((s, i) => {
                                    const isIncomplete = !s.clock_in || !s.clock_out;
                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex flex-col gap-4 p-4 rounded-xl border transition-colors",
                                                isIncomplete
                                                    ? "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-light))]/10"
                                                    : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Session number */}
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold">
                                                    {i + 1}
                                                </div>

                                                {/* Times */}
                                                <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                                                            In
                                                        </p>
                                                        <p className="font-semibold flex items-center gap-1">
                                                            <ArrowDownCircle
                                                                size={12}
                                                                className={cn(
                                                                    s.clock_in
                                                                        ? "text-[hsl(var(--success))]"
                                                                        : "text-[hsl(var(--muted-foreground))]/40"
                                                                )}
                                                            />
                                                            {formatTime(s.clock_in, businessTimezone)}
                                                            {s.clock_in && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const log = detailRow.raw_logs.find(rx => rx.timestamp === s.clock_in && rx.event_type === 'CLOCK_IN');
                                                                        if (log) {
                                                                            setEditingLog({ ...log, Employee: detailRow.Employee });
                                                                            setIsEditModalOpen(true);
                                                                        }
                                                                    }}
                                                                    className="ml-auto p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))] transition-colors"
                                                                    title="Edit Clock In"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                                                            Out
                                                        </p>
                                                        <p className="font-semibold flex items-center gap-1">
                                                            <ArrowUpCircle
                                                                size={12}
                                                                className={cn(
                                                                    s.clock_out
                                                                        ? "text-[hsl(var(--warning))]"
                                                                        : "text-[hsl(var(--muted-foreground))]/40"
                                                                )}
                                                            />
                                                            {formatTime(s.clock_out, businessTimezone)}
                                                            {s.clock_out && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const log = detailRow.raw_logs.find(rx => rx.timestamp === s.clock_out && rx.event_type === 'CLOCK_OUT');
                                                                        if (log) {
                                                                            setEditingLog({ ...log, Employee: detailRow.Employee });
                                                                            setIsEditModalOpen(true);
                                                                        }
                                                                    }}
                                                                    className="ml-auto p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))] transition-colors"
                                                                    title="Edit Clock Out"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                                                            Duration
                                                        </p>
                                                        <p className="font-semibold tabular-nums">
                                                            {s.duration_minutes != null
                                                                ? formatDuration(s.duration_minutes)
                                                                : "—"}
                                                        </p>
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Breaks Section */}
                                            {s.breaks && s.breaks.length > 0 && (
                                                <div className="mt-2 pt-3 border-t border-[hsl(var(--border))]/50">
                                                    <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold mb-2 flex items-center gap-1.5">
                                                        <Coffee size={12} className="text-[hsl(var(--brand))]" />
                                                        Breaks ({s.breaks.length / 2 | 0})
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                                        {(() => {
                                                            const pairs = [];
                                                            for (let b = 0; b < s.breaks.length; b++) {
                                                                if (s.breaks[b].event_type === 'BREAK_START') {
                                                                    const end = s.breaks.find((bx: any, idx: number) => idx > b && bx.event_type === 'BREAK_END');
                                                                    pairs.push({ start: s.breaks[b], end });
                                                                }
                                                            }
                                                            return pairs.map((pair, idx) => (
                                                                <div key={idx} className="flex items-center justify-between text-xs bg-[hsl(var(--background))] px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))]/50">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[hsl(var(--muted-foreground))] font-medium">#{idx + 1}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-semibold text-[hsl(var(--foreground))]">{formatTime(pair.start.timestamp, businessTimezone)}</span>
                                                                            <ArrowRight size={10} className="text-[hsl(var(--muted-foreground))]" />
                                                                            <span className="font-semibold text-[hsl(var(--foreground))]">{pair.end ? formatTime(pair.end.timestamp, businessTimezone) : '—'}</span>
                                                                        </div>
                                                                    </div>
                                                                    {pair.start && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingLog({ ...pair.start, Employee: detailRow.Employee });
                                                                                setIsEditModalOpen(true);
                                                                            }}
                                                                            className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand))]"
                                                                        >
                                                                            <Edit2 size={10} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer summary */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 rounded-b-2xl">
                            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                <Layers size={14} />
                                <span>
                                    {detailRow.sessions.length}{" "}
                                    {detailRow.sessions.length === 1 ? "session" : "sessions"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Timer size={14} className="text-[hsl(var(--brand))]" />
                                <span className="text-sm font-bold">
                                    Total: {formatDuration(detailRow.total_hours)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Manual Entry Modal ── */}
            <ManualEntryModal
                isOpen={isManualEntryModalOpen}
                onClose={() => setIsManualEntryModalOpen(false)}
                employees={employees}
                fromDate={fromDate}
                toDate={toDate}
            />

            {/* ── Edit Entry Modal ── */}
            {editingLog && (
                <EditAttendanceModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditingLog(null);
                        // Also close detail row to refresh the view
                        setDetailRow(null);
                    }}
                    log={editingLog}
                    fromDate={fromDate}
                    toDate={toDate}
                />
            )}
        </DashboardLayout>
    );
}
