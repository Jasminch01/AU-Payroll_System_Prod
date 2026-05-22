"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import {
    groupAttendanceIntoSessions,
    GroupedAttendanceSession,
    WorkSession,
    calculateTotalHours
} from "@/lib/attendance-grouper";
import { ManualEntryModal } from "@/components/attendance/manual-entry-modal";
import { AttendanceCalendar, getStartOfWeek } from "@/components/attendance/attendance-calendar";
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
    ArrowRight,
    List,
    CalendarDays,
    Search,
    ClipboardList,
    CheckCircle2,
    XCircle,
    MinusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceLog } from "@/types/database";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { EditAttendanceModal } from "@/components/attendance/edit-attendance-modal";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { getDateInTimezone } from "@/lib/timezone-utils";

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
    break_minutes: number;
    is_manual: boolean;
    device_info: string;
    raw_logs: any[];
}

interface GroupedAttendance {
    rostered_minutes: number;
    id: string;
    employee_id: string;
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
    date: string;
    searchDate?: string; // For search: formatted + ISO date
    first_in: string | null;
    last_out: string | null;
    sessions: Session[];
    total_hours: number; // sum of completed session durations
    total_break_minutes: number;
    is_manual: boolean;
    device_info: string;
    override_reason?: string;
    raw_logs: AttendanceRecord[];
}

/* ===== Helpers ===== */

function todayDateString(timezone: string): string {
    return getDateInTimezone(new Date().toISOString(), timezone);
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

export default function OwnerAttendancePage() {
    const { businessTimezone } = useBusinessTimezone();
    const [fromDate, setFromDate] = useState<string>("");
    const [toDate, setToDate] = useState<string>("");

    // Initialize dates once timezone is available
    useEffect(() => {
        if (businessTimezone && !fromDate && !toDate) {
            const today = todayDateString(businessTimezone);
            setFromDate(today);
            setToDate(today);
        }
    }, [businessTimezone]);

    const today = useMemo(() => todayDateString(businessTimezone), [businessTimezone]);
    const [detailRow, setDetailRow] = useState<GroupedAttendance | null>(null);
    const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
    const [calendarAnchor, setCalendarAnchor] = useState<Date>(() => getStartOfWeek(new Date()));
    const [calendarPeriod, setCalendarPeriod] = useState<"week" | "fortnight" | "month">("week");
    const [selectedManualEntry, setSelectedManualEntry] = useState<{ employeeId: string; date: string; inTime?: string; outTime?: string } | null>(null);
    const queryClient = useQueryClient();

    // Supabase Realtime Subscription for live updates
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('attendance-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'AttendanceLog'
                },
                () => {
                    // Invalidate both current and broader query keys
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

    const { data: records = [], isLoading: isLoadingAttendance } = useQuery({
        queryKey: ["attendance-raw", fromDate, toDate],
        queryFn: () =>
            apiGet<AttendanceRecord[]>("/attendance", queryParams),
    });

    const { data: shifts = [], isLoading: isLoadingShifts } = useQuery({
        queryKey: ["attendance-shifts", fromDate, toDate],
        queryFn: () => apiGet<any[]>("/shift", queryParams),
        enabled: !!fromDate && !!toDate
    });

    const activeShift = useMemo(() => {
        if (!detailRow) return null;
        return shifts.find(
            (s: any) => s.employee_id === detailRow.employee_id && s.shift_date === detailRow.date
        );
    }, [detailRow, shifts]);

    const { data: checklistItems = [], isLoading: isLoadingChecklist } = useQuery({
        queryKey: ["shift-checklist-attendance", activeShift?.shift_id],
        queryFn: () => apiGet<any[]>(`/shift/${activeShift?.shift_id}/checklist`),
        enabled: !!activeShift?.shift_id
    });

    const isLoading = isLoadingAttendance || isLoadingShifts;

    /* ── Session-aware grouping ── */
    const groupedRecords = useMemo(() => {
        // Build roster map for lookup
        const rosterMap = new Map<string, number>();
        for (const shift of shifts) {
            if (!shift.employee_id || !shift.start_time || !shift.end_time) continue;
            const dateStr = shift.start_time.split('T')[0];
            const key = `${shift.employee_id}_${dateStr}`;
            const start = new Date(shift.start_time);
            const end = new Date(shift.end_time);
            const diffMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
            rosterMap.set(key, (rosterMap.get(key) || 0) + diffMinutes);
        }

        // Use the new cross-midnight aware grouping function
        const groupedSessions = groupAttendanceIntoSessions(records, businessTimezone);

        // Filter logic: only show records where clock_in_date is within the selected date range
        const filteredSessions = groupedSessions.filter((group) => {
            if (!fromDate && !toDate) return true; // No filter = show all

            // String comparison on YYYY-MM-DD format is reliable and timezone-safe
            if (fromDate && toDate) {
                return group.clock_in_date >= fromDate && group.clock_in_date <= toDate;
            }
            if (fromDate) {
                return group.clock_in_date >= fromDate;
            }
            if (toDate) {
                return group.clock_in_date <= toDate;
            }
            return true;
        });

        return filteredSessions
            .flatMap((group) =>
                group.sessions.map((session) => {
                    // Build a Session object for each work session
                    const sessionObj: Session = {
                        clock_in: session.clock_in?.timestamp ?? null,
                        clock_out: session.clock_out?.timestamp ?? null,
                        duration_minutes: session.duration_minutes,
                        break_minutes: session.break_minutes,
                        is_manual: !!session.clock_in?.override_by || !!session.clock_out?.override_by,
                        device_info: [
                            session.clock_in?.device_info,
                            session.clock_out?.device_info,
                        ]
                            .filter(Boolean)
                            .join(", "),
                        breaks: session.breaks || [],
                        raw_logs: session.all_logs || []
                    };

                    const totalMinutes = session.duration_minutes ?? 0;
                    const totalBreakMinutes = session.break_minutes ?? 0;
                    const rosterMinutes = rosterMap.get(`${group.employee_id}_${group.clock_in_date}`) || 0;

                    return {
                        id: `${group.employee_id}_${group.clock_in_date}_${session.clock_in?.timestamp}`,
                        employee_id: group.employee_id,
                        Employee: group.Employee,
                        date: group.clock_in_date,
                        searchDate: `${group.clock_in_date} ${new Intl.DateTimeFormat("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                        }).format(new Date(group.clock_in_date))}`,
                        first_in: session.clock_in?.timestamp ?? null,
                        last_out: session.clock_out?.timestamp ?? null,
                        sessions: [sessionObj],
                        total_hours: totalMinutes,
                        total_break_minutes: totalBreakMinutes,
                        rostered_minutes: rosterMinutes,
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
    }, [records, shifts, fromDate, toDate, businessTimezone]);

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

    const filteredData: GroupedAttendance[] = useMemo(() => {
        if (!searchQuery) return groupedRecords;

        const q = searchQuery.toLowerCase();
        return groupedRecords.filter(row => {
            const firstName = row.Employee?.first_name?.toLowerCase() || "";
            const lastName = row.Employee?.last_name?.toLowerCase() || "";
            const searchDate = row.searchDate?.toLowerCase() || "";
            const fullName = `${firstName} ${lastName}`;

            return fullName.includes(q) || firstName.includes(q) || lastName.includes(q) || searchDate.includes(q);
        });
    }, [groupedRecords, searchQuery]);

    const filteredEmployees = useMemo(() => {
        if (!searchQuery) return employees;
        const q = searchQuery.toLowerCase();
        return employees.filter((e: any) => {
            const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
            const role = e.role_title?.toLowerCase() || "";
            return fullName.includes(q) || role.includes(q);
        });
    }, [employees, searchQuery]);

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
                    (s: Session) => !s.clock_in || !s.clock_out
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
            key: "rostered_hours",
            label: "Rostered",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                    <span className={cn(
                        "text-sm font-medium tabular-nums",
                        row.rostered_minutes > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]/40"
                    )}>
                        {row.rostered_minutes > 0 ? formatDuration(row.rostered_minutes) : "—"}
                    </span>
                </div>
            ),
        },
        {
            key: "total_break",
            label: "Total Break",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <Coffee size={14} className="text-amber-600 shrink-0" />
                    <span className="text-sm font-medium tabular-nums text-amber-700">
                        {formatDuration(row.total_break_minutes)}
                    </span>
                </div>
            ),
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
                if (!row.is_manual) return <StatusBadge status="auto" label="Auto" ghost />;
                return (
                    <div className="flex flex-col gap-0.5">
                        <StatusBadge status="manual" label="Manual" ghost />
                        {row.override_reason && (
                            <p
                                className="text-[10px] text-[hsl(var(--muted-foreground))] italic truncate max-w-[80px]"
                                title={row.override_reason}
                            >
                                {row.override_reason}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: "actions",
            label: "Edit",
            render: (row) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Open the session editor
                        setEditingLog({
                            ...row.raw_logs[0], // Start with the first log
                            all_logs: row.raw_logs,
                            Employee: row.Employee,
                            session_id: row.id
                        });
                        setIsEditModalOpen(true);
                    }}
                    className="p-2 rounded-lg bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))] hover:text-white transition-all shadow-sm active:scale-90"
                    title="Edit Session"
                >
                    <Edit2 size={14} />
                </button>
            ),
        }
    ];

    /* ── Summary stats ── */
    const totalSessions = filteredData.length;
    const missingPunch = filteredData.filter(
        (r: GroupedAttendance) => r.sessions.some((s: Session) => !s.clock_in || !s.clock_out)
    ).length;
    const manualEntries = filteredData.filter((r: GroupedAttendance) => r.is_manual).length;
    const totalWorkedMinutes = filteredData.reduce(
        (sum, r: GroupedAttendance) => sum + r.total_hours,
        0
    );
    const totalBreakMinutesAll = filteredData.reduce(
        (sum, r: GroupedAttendance) => sum + r.total_break_minutes,
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Coffee size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                            Total Breaks
                        </p>
                        <p className="text-2xl font-bold mt-0.5">
                            {formatDuration(totalBreakMinutesAll)}
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

            {/* Filters & View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-[hsl(var(--muted))] rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode("list")}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                viewMode === "list"
                                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            )}
                            title="List View"
                        >
                            <List size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("calendar")}
                            className={cn(
                                "p-2 rounded-md transition-all",
                                viewMode === "calendar"
                                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            )}
                            title="Calendar View"
                        >
                            <CalendarDays size={16} />
                        </button>
                    </div>

                    {/* Date filters — only show in list mode */}
                    {viewMode === "list" && (
                        <>
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
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))] transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    
                    <Button
                        onClick={() => setIsManualEntryModalOpen(true)}
                        className="fixed bottom-24 right-6 size-10 lg:h-9 lg:w-auto p-0 lg:px-4 lg:py-2 gap-2 shadow-2xl shadow-[hsl(var(--brand))]/40 lg:shadow-md hover:shadow-lg transition-all lg:ml-2 rounded-full lg:rounded-lg z-50 lg:static shrink-0"
                    >
                        <Plus size={24} className="lg:w-4 lg:h-4" />
                        <span className="hidden lg:inline">Manual Entry</span>
                    </Button>
                </div>
            </div>

            {/* View: List or Calendar */}
            {viewMode === "list" ? (
                <DataTable
                    columns={columns}
                    data={filteredData}
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
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLog({ ...row.raw_logs[0], all_logs: row.raw_logs, Employee: row.Employee });
                                            setIsEditModalOpen(true);
                                        }}
                                        className="p-2 -mr-2 rounded-full hover:bg-[hsl(var(--brand-light))]/50 transition-colors"
                                    >
                                        <Edit2 size={16} className="text-[hsl(var(--brand))]" />
                                    </button>
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
            ) : (
                <AttendanceCalendar
                    data={filteredData}
                    employees={filteredEmployees.map((e: any) => ({
                        employee_id: e.employee_id,
                        first_name: e.first_name,
                        last_name: e.last_name,
                        role_title: e.role_title,
                    }))}
                    shifts={shifts}
                    timezone={businessTimezone}
                    loading={isLoading}
                    anchor={calendarAnchor}
                    onAnchorChange={setCalendarAnchor}
                    period={calendarPeriod}
                    onPeriodChange={setCalendarPeriod}
                    onCellClick={(records, employee, date) => {
                        if (records.length > 0) {
                            setDetailRow(records[0] as GroupedAttendance);
                        } else {
                            // Pre-fill manual entry for empty/absent cells
                            const shift = shifts.find((s: any) => s.employee_id === employee.employee_id && s.start_time?.startsWith(date));
                            setSelectedManualEntry({ 
                                employeeId: employee.employee_id, 
                                date: date,
                                inTime: shift ? formatTime(shift.start_time, businessTimezone) : undefined,
                                outTime: shift ? formatTime(shift.end_time, businessTimezone) : undefined
                            });
                            setIsManualEntryModalOpen(true);
                        }
                    }}
                    onDateRangeChange={(from, to) => {
                        setFromDate(from);
                        setToDate(to);
                    }}
                />
            )}

            {/* ── Slide-Over Detail Panel ── */}
            {detailRow && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in"
                        onClick={() => setDetailRow(null)}
                    />
                    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-2xl animate-in slide-in-from-right">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                                    {detailRow.Employee?.first_name?.[0]}{detailRow.Employee?.last_name?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-[hsl(var(--foreground))] truncate">
                                        {detailRow.Employee
                                            ? `${detailRow.Employee.first_name} ${detailRow.Employee.last_name}`
                                            : "Unknown"}
                                    </h3>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                        {new Date(detailRow.date).toLocaleDateString("en-AU", {
                                            weekday: "long", day: "numeric", month: "long", year: "numeric",
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetailRow(null)}
                                className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-[hsl(var(--border))]">
                            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[hsl(var(--brand-light))]/30 border border-[hsl(var(--brand))]/10">
                                <Timer size={16} className="text-[hsl(var(--brand))]" />
                                <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Worked</span>
                                <span className="text-lg font-black text-[hsl(var(--brand))] tabular-nums">{formatDuration(detailRow.total_hours)}</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))]">
                                <CalendarDays size={16} className="text-[hsl(var(--muted-foreground))]" />
                                <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Rostered</span>
                                <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">{formatDuration(detailRow.rostered_minutes)}</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-amber-50 border border-amber-200/30">
                                <Coffee size={16} className="text-amber-600" />
                                <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Breaks</span>
                                <span className="text-lg font-black text-amber-700 tabular-nums">{formatDuration(detailRow.total_break_minutes)}</span>
                            </div>
                        </div>

                        {/* Sessions */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider mb-3 flex items-center gap-1.5">
                                <Layers size={12} />
                                {detailRow.sessions.length} {detailRow.sessions.length === 1 ? "Session" : "Sessions"}
                            </p>
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
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                                                            Out
                                                        </p>
                                                        <div className="flex items-center gap-1">
                                                            <ArrowUpCircle
                                                                size={12}
                                                                className={cn(
                                                                    s.clock_out
                                                                        ? "text-[hsl(var(--warning))]"
                                                                        : "text-[hsl(var(--muted-foreground))]/40"
                                                                )}
                                                            />
                                                            <span className="font-semibold text-sm">
                                                                {formatTime(s.clock_out, businessTimezone)}
                                                            </span>
                                                        </div>
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

                                                {/* Edit Button - Mobile Only */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Pass only logs for this specific session
                                                        setEditingLog({
                                                            ...s.raw_logs[0],
                                                            all_logs: s.raw_logs,
                                                            Employee: detailRow.Employee
                                                        });
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="flex sm:hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--warning-light))]/50 text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))] hover:text-white transition-all shadow-sm"
                                                    title="Edit this session"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
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

                            {/* Checklist Section */}
                            <div className="mt-6 pt-6 border-t border-[hsl(var(--border))]">
                                <p className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider mb-3 flex items-center gap-1.5">
                                    <ClipboardList size={12} />
                                    Shift Checklist
                                </p>
                                
                                {!activeShift ? (
                                    <div className="p-4 rounded-xl bg-[hsl(var(--muted))]/20 border border-[hsl(var(--border))]/50 text-center text-xs text-[hsl(var(--muted-foreground))] font-medium">
                                        No scheduled shift found on this date.
                                    </div>
                                ) : isLoadingChecklist ? (
                                    <div className="space-y-2">
                                        <div className="h-10 bg-[hsl(var(--muted))]/30 animate-pulse rounded-xl" />
                                        <div className="h-10 bg-[hsl(var(--muted))]/30 animate-pulse rounded-xl" />
                                    </div>
                                ) : !checklistItems || checklistItems.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-[hsl(var(--muted))]/20 border border-[hsl(var(--border))]/50 text-center text-xs text-[hsl(var(--muted-foreground))] font-medium">
                                        No checklist tasks assigned to this shift.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Progress Bar */}
                                        {(() => {
                                            const total = checklistItems.length;
                                            const completed = checklistItems.filter((item: any) => item.status === 'done').length;
                                            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                                            return (
                                                <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 space-y-2">
                                                    <div className="flex justify-between items-center text-xs font-bold text-[hsl(var(--foreground))]">
                                                        <span>Task Completion</span>
                                                        <span>{completed}/{total} Tasks ({percent}%)</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-[hsl(var(--brand))] rounded-full transition-all duration-500 ease-out" 
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Tasks List */}
                                        <div className="space-y-2">
                                            {checklistItems.map((item: any) => {
                                                const isDone = item.status === 'done';
                                                const isNotDone = item.status === 'not_done';
                                                const isNa = item.status === 'not_applicable';
                                                const isPending = item.status === 'pending';

                                                return (
                                                    <div 
                                                        key={item.checklist_item_id}
                                                        className="flex flex-col gap-2 p-3.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={cn(
                                                                        "text-sm font-semibold text-[hsl(var(--foreground))]",
                                                                        isDone && "line-through text-[hsl(var(--muted-foreground))]"
                                                                    )}>
                                                                        {item.task_text}
                                                                    </span>
                                                                    {item.is_required && (
                                                                        <span className="text-[9px] uppercase font-black tracking-wider text-[hsl(var(--danger))] bg-[hsl(var(--danger-light))]/30 px-1.5 py-0.5 rounded">
                                                                            Required
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {item.instructions && (
                                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                        {item.instructions}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Status Badge */}
                                                            <div>
                                                                {isDone && (
                                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--success))] bg-[hsl(var(--success-light))]/20 px-2 py-0.5 rounded-lg border border-[hsl(var(--success))]/10">
                                                                        <CheckCircle2 size={12} />
                                                                        Done
                                                                    </span>
                                                                )}
                                                                {isNotDone && (
                                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--danger))] bg-[hsl(var(--danger-light))]/20 px-2 py-0.5 rounded-lg border border-[hsl(var(--danger))]/10">
                                                                        <XCircle size={12} />
                                                                        Not Done
                                                                    </span>
                                                                )}
                                                                {isNa && (
                                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/50 px-2 py-0.5 rounded-lg border border-[hsl(var(--border))]">
                                                                        <MinusCircle size={12} />
                                                                        N/A
                                                                    </span>
                                                                )}
                                                                {isPending && (
                                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                                                        <Clock size={12} className="text-amber-500" />
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Audit Reason Callout */}
                                                        {item.reason && (
                                                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[hsl(var(--muted))]/50 border border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                                <AlertCircle size={13} className="text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
                                                                <div className="min-w-0">
                                                                    <span className="font-semibold text-[hsl(var(--foreground))]">Reason: </span>
                                                                    <span className="italic">"{item.reason}"</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 pt-4 pb-10 sm:pb-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20">
                            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                {detailRow.is_manual && <StatusBadge status="manual" label="Manual Entry" />}
                            </div>
                            <button
                                onClick={() => {
                                    setEditingLog({ ...detailRow.raw_logs[0], all_logs: detailRow.raw_logs, Employee: detailRow.Employee });
                                    setIsEditModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))] hover:bg-[hsl(var(--brand))]/15 px-4 py-3 rounded-xl transition-colors shadow-sm"
                            >
                                <Edit2 size={14} /> Edit Session
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Manual Entry Modal ── */}
            <ManualEntryModal
                isOpen={isManualEntryModalOpen}
                onClose={() => {
                    setIsManualEntryModalOpen(false);
                    setSelectedManualEntry(null);
                }}
                employees={employees.map((e: any) => ({
                    employee_id: e.employee_id,
                    first_name: e.first_name,
                    last_name: e.last_name,
                }))}
                fromDate={fromDate}
                toDate={toDate}
                defaultEmployeeId={selectedManualEntry?.employeeId}
                defaultDate={selectedManualEntry?.date}
                defaultInTime={selectedManualEntry?.inTime}
                defaultOutTime={selectedManualEntry?.outTime}
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
                    role="owner"
                />
            )}
        </DashboardLayout>
    );
}
