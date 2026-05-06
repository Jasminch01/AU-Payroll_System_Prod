"use client";

import React, { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    ChevronLeft,
    ChevronRight,
    Coffee,
    AlertCircle,
    Clock,
    Timer,
    ArrowDownCircle,
    ArrowUpCircle,
    RefreshCcw,
} from "lucide-react";

/* ===== Types ===== */

interface Employee {
    employee_id: string;
    first_name: string;
    last_name: string;
    role_title?: string;
}

interface CalendarAttendanceRecord {
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
    sessions: any[];
    total_hours: number;
    total_break_minutes: number;
    is_manual: boolean;
    raw_logs: any[];
}

interface AttendanceCalendarProps {
    data: CalendarAttendanceRecord[];
    employees: Employee[];
    shifts?: any[]; // Roster data
    timezone: string;
    loading?: boolean;
    onCellClick: (records: CalendarAttendanceRecord[], employee: Employee, date: string) => void;
    onDateRangeChange: (from: string, to: string) => void;
    // Optional controlled state to persist across view switches
    period?: "week" | "fortnight" | "month";
    onPeriodChange?: (p: "week" | "fortnight" | "month") => void;
    anchor?: Date;
    onAnchorChange?: (d: Date) => void;
}

/* ===== Helpers ===== */

export function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getStartOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function generateDateRange(anchor: Date, period: "week" | "fortnight" | "month"): string[] {
    const dates: string[] = [];
    let start: Date;
    let count: number;

    if (period === "week") {
        start = getStartOfWeek(anchor);
        count = 7;
    } else if (period === "fortnight") {
        start = getStartOfWeek(anchor);
        count = 14;
    } else {
        start = getStartOfMonth(anchor);
        count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    }

    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dates.push(`${yyyy}-${mm}-${dd}`);
    }

    return dates;
}

function formatDuration(totalMinutes: number): string {
    if (totalMinutes <= 0) return "0m";
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function formatTime(iso: string | null, timezone: string): string {
    if (!iso) return "--:--";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "--:--";
    return new Intl.DateTimeFormat("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
    }).format(date);
}

function getRangeLabel(dates: string[]): string {
    if (dates.length === 0) return "";
    const first = new Date(dates[0] + "T00:00:00");
    const last = new Date(dates[dates.length - 1] + "T00:00:00");

    const fmtFirst = first.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const fmtLast = last.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${fmtFirst} – ${fmtLast}`;
}

function isWeekend(dateStr: string): boolean {
    const d = new Date(dateStr + "T00:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
}

/* ===== Component ===== */

export function AttendanceCalendar({
    data,
    employees,
    shifts = [],
    timezone,
    loading = false,
    onCellClick,
    onDateRangeChange,
    onAnchorChange,
    anchor: propsAnchor,
    onPeriodChange,
    period: propsPeriod,
}: AttendanceCalendarProps) {
    const [localPeriod, setLocalPeriod] = useState<"week" | "fortnight" | "month">("week");
    const [localAnchor, setLocalAnchor] = useState(() => getStartOfWeek(new Date()));

    const period = propsPeriod || localPeriod;
    const anchor = propsAnchor || localAnchor;

    const setPeriod = (p: "week" | "fortnight" | "month") => {
        if (onPeriodChange) onPeriodChange(p);
        else setLocalPeriod(p);
    };

    const setAnchor = (d: Date) => {
        if (onAnchorChange) onAnchorChange(d);
        else setLocalAnchor(d);
    };

    const dates = useMemo(() => generateDateRange(anchor, period), [anchor, period]);

    const todayStr = useMemo(() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }, []);

    const rangeLabel = useMemo(() => getRangeLabel(dates), [dates]);

    // Sync date range with parent
    useEffect(() => {
        if (dates.length > 0) {
            onDateRangeChange(dates[0], dates[dates.length - 1]);
        }
    }, [dates]);

    // Build lookup: employeeId_date → records[]
    const dataMap = useMemo(() => {
        const map = new Map<string, CalendarAttendanceRecord[]>();
        for (const record of data) {
            const key = `${record.employee_id}_${record.date}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(record);
        }
        return map;
    }, [data]);

    // Build roster lookup: employeeId_date → rosterMinutes
    const rosterMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const shift of shifts) {
            if (!shift.employee_id || !shift.start_time || !shift.end_time) continue;

            // Extract date from start_time (ISO string)
            const dateStr = shift.start_time.split('T')[0];
            const key = `${shift.employee_id}_${dateStr}`;

            const start = new Date(shift.start_time);
            const end = new Date(shift.end_time);
            const diffMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));

            map.set(key, (map.get(key) || 0) + diffMinutes);
        }
        return map;
    }, [shifts]);

    // Navigation
    const navigate = (dir: 1 | -1) => {
        const d = new Date(anchor);
        if (period === "week") d.setDate(d.getDate() + 7 * dir);
        else if (period === "fortnight") d.setDate(d.getDate() + 14 * dir);
        else d.setMonth(d.getMonth() + dir);
        setAnchor(d);
    };

    const goToToday = () => {
        if (period === "month") {
            setAnchor(getStartOfMonth(new Date()));
        } else {
            setAnchor(getStartOfWeek(new Date()));
        }
    };

    const handlePeriodChange = (p: "week" | "fortnight" | "month") => {
        setPeriod(p);
    };

    const isCompact = period === "month" || period === "fortnight";

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Period selector */}
                <div className="flex items-center bg-[hsl(var(--muted))] rounded-lg p-0.5">
                    {(["week", "fortnight", "month"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePeriodChange(p)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize",
                                period === p
                                    ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-semibold min-w-[180px] text-center text-[hsl(var(--foreground))]">
                        {rangeLabel}
                    </span>
                    <button
                        onClick={() => navigate(1)}
                        className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        onClick={goToToday}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand))]/90 transition-colors shadow-sm"
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 z-20 bg-[hsl(var(--card))]/60 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCcw className="w-8 h-8 text-[hsl(var(--brand))] animate-spin" />
                            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Syncing data...</span>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-[hsl(var(--muted))]/40">
                                <th className="sticky left-0 z-10 bg-[hsl(var(--muted))]/60 backdrop-blur-sm px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] min-w-[160px] border-r border-[hsl(var(--border))]/50">
                                    Employee
                                </th>
                                {dates.map((dateStr) => {
                                    const d = new Date(dateStr + "T00:00:00");
                                    const isToday = dateStr === todayStr;
                                    const weekend = isWeekend(dateStr);
                                    return (
                                        <th
                                            key={dateStr}
                                            className={cn(
                                                "px-1 py-3 text-center min-w-[60px] border-r border-[hsl(var(--border))]/30 last:border-r-0",
                                                isToday && "bg-[hsl(var(--brand))]/8",
                                                weekend && !isToday && "bg-[hsl(var(--muted))]/30"
                                            )}
                                        >
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold tracking-wider",
                                                    isToday ? "text-[hsl(var(--brand))]" : weekend ? "text-[hsl(var(--muted-foreground))]/50" : "text-[hsl(var(--muted-foreground))]"
                                                )}>
                                                    {d.toLocaleDateString("en-AU", { weekday: "short" })}
                                                </span>
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    isToday
                                                        ? "bg-[hsl(var(--brand))] text-white w-7 h-7 rounded-full flex items-center justify-center"
                                                        : weekend ? "text-[hsl(var(--muted-foreground))]/60" : "text-[hsl(var(--foreground))]"
                                                )}>
                                                    {d.getDate()}
                                                </span>
                                            </div>
                                            {isToday && (
                                                <div className="h-0.5 w-full bg-[hsl(var(--brand))] rounded-full mt-1" />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]/40">
                            {employees.map((emp) => (
                                <tr key={emp.employee_id} className="hover:bg-[hsl(var(--muted))]/10 transition-colors">
                                    <td className="sticky left-0 z-10 bg-[hsl(var(--card))] backdrop-blur-sm px-4 py-2.5 border-r border-[hsl(var(--border))]/50">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-[10px] font-bold">
                                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                                                    {emp.first_name} {emp.last_name}
                                                </p>
                                                {emp.role_title && (
                                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                                                        {emp.role_title}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {dates.map((dateStr) => {
                                        const key = `${emp.employee_id}_${dateStr}`;
                                        const records = dataMap.get(key) || [];
                                        const isToday = dateStr === todayStr;
                                        const weekend = isWeekend(dateStr);

                                        return (
                                            <CalendarCell
                                                key={dateStr}
                                                records={records}
                                                rosterMinutes={rosterMap.get(key) || 0}
                                                dateStr={dateStr}
                                                todayStr={todayStr}
                                                isToday={isToday}
                                                isWeekend={weekend}
                                                isCompact={isCompact}
                                                timezone={timezone}
                                                onClick={() => onCellClick(records, emp, dateStr)}
                                            />
                                        );
                                    })}
                                </tr>
                            ))}
                            {employees.length === 0 && (
                                <tr>
                                    <td colSpan={dates.length + 1} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-[hsl(var(--muted-foreground))]">
                                            <Clock size={32} className="opacity-20" />
                                            <p className="text-sm">No employees found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-1">
                <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">Legend:</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[hsl(var(--muted))]/50 border border-[hsl(var(--border))]" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">No Record</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Manual</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2 border-l border-[hsl(var(--border))] pl-4">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">WR: Worked Hours</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-medium">RH: Rostered Hours</span>
                </div>
            </div>
        </div>
    );
}

/* ===== Calendar Cell ===== */

function CalendarCell({
    records,
    rosterMinutes,
    dateStr,
    todayStr,
    isToday,
    isWeekend,
    isCompact,
    timezone,
    onClick,
}: {
    records: CalendarAttendanceRecord[];
    rosterMinutes: number;
    dateStr: string;
    todayStr: string;
    isToday: boolean;
    isWeekend: boolean;
    isCompact: boolean;
    timezone: string;
    onClick: () => void;
}) {
    const hasRecords = records.length > 0;
    const totalMinutes = records.reduce((sum, r) => sum + r.total_hours, 0);
    const totalBreakMinutes = records.reduce((sum, r) => sum + r.total_break_minutes, 0);
    const isPartial = records.some((r) => r.sessions.some((s: any) => !s.clock_in || !s.clock_out));
    const isManual = records.some((r) => r.is_manual);
    
    // Parent sorts records DESCENDING (newest first)
    // For a single day's cell:
    // records[0] is the LATEST session
    // records[records.length - 1] is the EARLIEST session
    const firstIn = records[records.length - 1]?.first_in;
    const lastOut = records[0]?.last_out;
    const sessionCount = records.reduce((sum, r) => sum + r.sessions.length, 0);

    let bgClass = "";
    let textClass = "";

    if (hasRecords && !isPartial) {
        bgClass = "bg-emerald-50 hover:bg-emerald-100 border-emerald-200/60";
        textClass = "text-[hsl(var(--foreground))]";
    } else if (hasRecords && isPartial) {
        bgClass = "bg-amber-50 hover:bg-amber-100 border-amber-200/60";
        textClass = "text-[hsl(var(--foreground))]";
    } else {
        bgClass = "bg-transparent hover:bg-[hsl(var(--muted))]/30 border-transparent";
        textClass = "text-[hsl(var(--muted-foreground))]/30";
    }

    const tooltipParts: string[] = [];
    tooltipParts.push(`Rostered: ${rosterMinutes > 0 ? formatDuration(rosterMinutes) : '0m'}`);
    if (hasRecords) {
        tooltipParts.push(`Worked: ${formatDuration(totalMinutes)}`);
        if (firstIn) tooltipParts.push(`In: ${formatTime(firstIn, timezone)}`);
        if (lastOut) tooltipParts.push(`Out: ${formatTime(lastOut, timezone)}`);
        if (totalBreakMinutes > 0) {
            tooltipParts.push(`Total Break: ${formatDuration(totalBreakMinutes)}`);
            // Show individual break times
            for (const rec of records) {
                for (const sess of rec.sessions) {
                    if (sess.breaks && sess.breaks.length > 0) {
                        for (let b = 0; b < sess.breaks.length; b++) {
                            const brk = sess.breaks[b];
                            if (brk.event_type === 'BREAK_START') {
                                const end = sess.breaks.find((bx: any, idx: number) => idx > b && bx.event_type === 'BREAK_END');
                                const startTime = formatTime(brk.timestamp, timezone);
                                const endTime = end ? formatTime(end.timestamp, timezone) : 'ongoing';
                                tooltipParts.push(`  Break: ${startTime} → ${endTime}`);
                            }
                        }
                    }
                }
            }
        }
        if (isManual) tooltipParts.push("Manual entry");
        if (sessionCount > 1) tooltipParts.push(`${sessionCount} sessions`);
    } else {
        tooltipParts.push(rosterMinutes > 0 ? "No attendance recorded" : "No records");
    }

    // Comparison logic: mismatch if rostered but no record, or hours differ significantly
    // Only flag as absent if the date is in the past
    const isPast = dateStr < todayStr;
    const isAbsent = rosterMinutes > 0 && !hasRecords && isPast;
    const hasMismatch = (rosterMinutes > 0 && hasRecords && Math.abs(totalMinutes - rosterMinutes) > 15) || isAbsent;

    return (
        <td
            className={cn(
                "px-1 py-1.5 border-r border-[hsl(var(--border))]/30 last:border-r-0",
                isToday && "bg-[hsl(var(--brand))]/5",
                isWeekend && !isToday && "bg-[hsl(var(--muted))]/15"
            )}
        >
            <button
                onClick={onClick}
                title={tooltipParts.join("\n")}
                className={cn(
                    "w-full rounded-lg border px-1.5 py-1.5 transition-all cursor-pointer relative group",
                    "active:scale-95",
                    bgClass
                )}
            >
                {hasRecords ? (
                    <div className="flex flex-col items-center gap-0.5">
                        <span className={cn("font-bold tabular-nums flex items-center gap-1 w-full justify-center", textClass, isCompact ? "text-[10px]" : "text-xs")}>
                            <span className="text-[8px] font-bold w-3 text-right shrink-0">WR: </span>
                            <span>{formatDuration(totalMinutes)}</span>
                        </span>

                        <span className={cn(
                            "font-bold tabular-nums flex items-center gap-1 w-full justify-center",
                            isCompact ? "text-[10px]" : "text-xs",
                            rosterMinutes > 0 ? textClass : "text-amber-600"
                        )}>
                            <span className="text-[8px] font-bold w-3 text-right shrink-0">RH: </span>
                            <span>{formatDuration(rosterMinutes)}</span>
                        </span>

                        {!isCompact && firstIn && lastOut && (
                            <span className={cn("text-[9px] tabular-nums opacity-70", textClass)}>
                                {formatTime(firstIn, timezone)}–{formatTime(lastOut, timezone)}
                            </span>
                        )}
                        {(isPartial || (hasMismatch && hasRecords)) && (
                            <AlertCircle size={10} className={cn("absolute top-0.5 right-0.5", isPartial ? "text-amber-500" : "text-rose-400")} />
                        )}
                        {isManual && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute bottom-0.5 right-0.5" />
                        )}
                    </div>
                ) : isAbsent ? (
                    <span className="text-[10px] font-bold text-rose-500 opacity-60">ABSENT</span>
                ) : (
                    <span className={cn("text-[10px]", textClass)}>—</span>
                )}
            </button>
        </td>
    );
}
