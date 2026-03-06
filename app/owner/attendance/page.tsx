"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Clock, ArrowDownCircle, ArrowUpCircle, Filter } from "lucide-react";
import type { AttendanceLog, EventType } from "@/types/database";

interface AttendanceRecord extends AttendanceLog {
    Employee?: {
        first_name: string;
        last_name: string;
        role_title: string;
    } | null;
}

export default function OwnerAttendancePage() {
    const [filterType, setFilterType] = useState<string>("all");
    const [fromDate, setFromDate] = useState<string>("");
    const [toDate, setToDate] = useState<string>("");

    const queryParams: Record<string, string> = {};
    if (filterType !== "all") queryParams.event_type = filterType;
    if (fromDate) queryParams.from = fromDate;
    if (toDate) queryParams.to = toDate;

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["attendance", filterType, fromDate, toDate],
        queryFn: () => apiGet<AttendanceRecord[]>("/attendance", queryParams),
    });

    const columns: Column<AttendanceRecord>[] = [
        {
            key: "employee_name",
            label: "Employee",
            sortable: true,
            render: (row) => {
                const emp = row.Employee;
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold">
                            {emp?.first_name?.[0] ?? ""}{emp?.last_name?.[0] ?? ""}
                        </div>
                        <div>
                            <p className="font-medium text-sm">
                                {emp ? `${emp.first_name} ${emp.last_name}` : row.employee_id?.slice(0, 8) + "…"}
                            </p>
                            {emp?.role_title && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{emp.role_title}</p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: "event_type",
            label: "Event",
            sortable: true,
            render: (row) => {
                const isIn = row.event_type === "CLOCK_IN";
                return (
                    <div className="flex items-center gap-2">
                        {isIn ?
                            <ArrowDownCircle size={16} className="text-[hsl(var(--success))]" /> :
                            <ArrowUpCircle size={16} className="text-[hsl(var(--warning))]" />
                        }
                        <span className={`text-sm font-medium ${isIn ? "text-[hsl(var(--success))]" : "text-[hsl(var(--warning))]"}`}>
                            {row.event_type === "CLOCK_IN" ? "Clock In" : "Clock Out"}
                        </span>
                    </div>
                );
            },
        },
        {
            key: "timestamp",
            label: "Time",
            sortable: true,
            render: (row) => (
                <div>
                    <p className="text-sm font-medium">
                        {new Date(row.timestamp).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {new Date(row.timestamp).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                </div>
            ),
        },
        {
            key: "device_info",
            label: "Device",
            render: (row) => (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {row.device_info || "—"}
                </span>
            ),
        },
        {
            key: "override_by",
            label: "Override",
            render: (row) => {
                if (!row.override_by) return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
                return (
                    <div>
                        <StatusBadge status="manual" />
                        {row.override_reason && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 max-w-[140px] truncate" title={row.override_reason}>
                                {row.override_reason}
                            </p>
                        )}
                    </div>
                );
            },
        },
    ];

    // Summary stats
    const clockIns = records.filter((r) => r.event_type === "CLOCK_IN").length;
    const clockOuts = records.filter((r) => r.event_type === "CLOCK_OUT").length;
    const overrides = records.filter((r) => r.override_by).length;

    return (
        <DashboardLayout role="owner" pageTitle="Attendance" pageDescription="Track clock in/out records">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Total Records</p>
                    <p className="text-2xl font-bold mt-1">{records.length}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <p className="text-xs font-medium text-[hsl(var(--success))] uppercase tracking-wider">Clock Ins</p>
                    <p className="text-2xl font-bold mt-1">{clockIns}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <p className="text-xs font-medium text-[hsl(var(--warning))] uppercase tracking-wider">Clock Outs</p>
                    <p className="text-2xl font-bold mt-1">{clockOuts}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                    <p className="text-xs font-medium text-[hsl(var(--info))] uppercase tracking-wider">Manual Overrides</p>
                    <p className="text-2xl font-bold mt-1">{overrides}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-6">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Event Type</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="flex h-9 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                    >
                        <option value="all">All Events</option>
                        <option value="CLOCK_IN">Clock In</option>
                        <option value="CLOCK_OUT">Clock Out</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">From Date</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="flex h-9 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">To Date</label>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="flex h-9 rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                    />
                </div>
                {(filterType !== "all" || fromDate || toDate) && (
                    <button
                        onClick={() => { setFilterType("all"); setFromDate(""); setToDate(""); }}
                        className="flex h-9 items-center gap-1 rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={records}
                searchable
                searchKeys={["employee_id"]}
                searchPlaceholder="Search by employee..."
                emptyMessage="No attendance records found"
                emptyIcon={<Clock size={40} />}
                loading={isLoading}
            />
        </DashboardLayout>
    );
}
