"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import {
    Clock,
    ArrowDownCircle,
    ArrowUpCircle,
    AlertCircle,
    Monitor,
    X,
    Layers,
    Timer,
} from "lucide-react";
import type { AttendanceLog } from "@/types/database";
import { cn } from "@/lib/utils";

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

function formatTime(iso: string | null) {
    if (!iso) return "--:--";
    return new Date(iso).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/* ===== Component ===== */

export default function OwnerAttendancePage() {
    const today = todayDateString();
    const [fromDate, setFromDate] = useState<string>(today);
    const [toDate, setToDate] = useState<string>(today);
    const [detailRow, setDetailRow] = useState<GroupedAttendance | null>(null);

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
        const groups: Record<string, {
            id: string;
            employee_id: string;
            Employee: AttendanceRecord["Employee"];
            date: string;
            logs: AttendanceRecord[];
            is_manual: boolean;
            device_info: Set<string>;
            override_reasons: Set<string>;
        }> = {};

        records.forEach((rec) => {
            const dateObj = new Date(rec.timestamp);
            const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
            const key = `${rec.employee_id}_${dateKey}`;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    employee_id: rec.employee_id ?? "",
                    Employee: rec.Employee,
                    date: dateKey,
                    logs: [],
                    is_manual: false,
                    device_info: new Set<string>(),
                    override_reasons: new Set<string>(),
                };
            }

            groups[key].logs.push(rec);
            if (rec.override_by) groups[key].is_manual = true;
            if (rec.device_info) groups[key].device_info.add(rec.device_info);
            if (rec.override_reason) groups[key].override_reasons.add(rec.override_reason);
        });

        return Object.values(groups)
            .map((group) => {
                const sorted = [...group.logs].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );

                // Pair clock-ins with nearest following clock-out
                const sessions: Session[] = [];
                let pendingIn: AttendanceRecord | null = null;

                for (const log of sorted) {
                    if (log.event_type === "CLOCK_IN") {
                        // If there was a previous unpaired clock-in, record it as an incomplete session
                        if (pendingIn) {
                            sessions.push({
                                clock_in: pendingIn.timestamp,
                                clock_out: null,
                                duration_minutes: null,
                                is_manual: !!pendingIn.override_by,
                                device_info: pendingIn.device_info || "",
                            });
                        }
                        pendingIn = log;
                    } else if (log.event_type === "CLOCK_OUT") {
                        if (pendingIn) {
                            const inMs = new Date(pendingIn.timestamp).getTime();
                            const outMs = new Date(log.timestamp).getTime();
                            sessions.push({
                                clock_in: pendingIn.timestamp,
                                clock_out: log.timestamp,
                                duration_minutes: (outMs - inMs) / 60000,
                                is_manual: !!pendingIn.override_by || !!log.override_by,
                                device_info: [pendingIn.device_info, log.device_info].filter(Boolean).join(", "),
                            });
                            pendingIn = null;
                        } else {
                            // Orphan clock-out (no matching clock-in)
                            sessions.push({
                                clock_in: null,
                                clock_out: log.timestamp,
                                duration_minutes: null,
                                is_manual: !!log.override_by,
                                device_info: log.device_info || "",
                            });
                        }
                    }
                }

                // Flush any remaining unpaired clock-in
                if (pendingIn) {
                    sessions.push({
                        clock_in: pendingIn.timestamp,
                        clock_out: null,
                        duration_minutes: null,
                        is_manual: !!pendingIn.override_by,
                        device_info: pendingIn.device_info || "",
                    });
                }

                const totalMinutes = sessions.reduce(
                    (sum, s) => sum + (s.duration_minutes ?? 0),
                    0
                );

                const firstIn = sessions.find((s) => s.clock_in)?.clock_in ?? null;
                const lastOut = [...sessions].reverse().find((s) => s.clock_out)?.clock_out ?? null;

                return {
                    id: group.id,
                    employee_id: group.employee_id,
                    Employee: group.Employee,
                    date: group.date,
                    first_in: firstIn,
                    last_out: lastOut,
                    sessions,
                    total_hours: totalMinutes,
                    is_manual: group.is_manual,
                    device_info: Array.from(group.device_info).join(", "),
                    override_reason: Array.from(group.override_reasons).join("; "),
                    raw_logs: sorted,
                } as GroupedAttendance;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [records]);

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
                        {formatTime(row.first_in)}
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
                        {formatTime(row.last_out)}
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
                                className="text-[10px] text-[hsl(var(--muted-foreground))] italic truncate max-w-[120px]"
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
    const totalSessions = groupedRecords.length;
    const missingPunch = groupedRecords.filter(
        (r) => r.sessions.some((s) => !s.clock_in || !s.clock_out)
    ).length;
    const manualEntries = groupedRecords.filter((r) => r.is_manual).length;
    const totalWorkedMinutes = groupedRecords.reduce(
        (sum, r) => sum + r.total_hours,
        0
    );

    const handleRowClick = useCallback((row: GroupedAttendance) => {
        setDetailRow(row);
    }, []);

    return (
        <DashboardLayout
            role="owner"
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
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={groupedRecords}
                searchable
                searchKeys={["Employee.first_name", "Employee.last_name", "date"]}
                searchPlaceholder="Search by employee or date..."
                emptyMessage="No attendance records found for this period"
                emptyIcon={<Clock size={40} />}
                loading={isLoading}
                onRowClick={handleRowClick}
            />

            {/* ── Session Detail Modal ── */}
            {detailRow && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setDetailRow(null)}
                >
                    <div
                        className="relative w-full max-w-lg mx-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl animate-in zoom-in-95"
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

                        {/* Sessions */}
                        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
                            <div className="space-y-3">
                                {detailRow.sessions.map((s, i) => {
                                    const isIncomplete = !s.clock_in || !s.clock_out;
                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                                                isIncomplete
                                                    ? "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-light))]/30"
                                                    : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
                                            )}
                                        >
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
                                                        {formatTime(s.clock_in)}
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
                                                        {formatTime(s.clock_out)}
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

                                            {/* Badges */}
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {s.is_manual && (
                                                    <StatusBadge status="manual" label="Manual" />
                                                )}
                                                {isIncomplete && (
                                                    <span className="text-[10px] font-medium text-[hsl(var(--warning))]">
                                                        Incomplete
                                                    </span>
                                                )}
                                            </div>
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
        </DashboardLayout>
    );
}
