"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { MetricCard } from "@/components/ui/card";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { Users, CalendarDays, FileText, Palmtree, Clock } from "lucide-react";

export default function ManagerDashboardPage() {
    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    const { data: timesheets = [] } = useQuery({
        queryKey: ["timesheets"],
        queryFn: () => apiGet<any[]>("/timesheets"),
    });

    const { data: leaveRequests = [] } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const activeEmployees = employees.filter((e: any) => e.status === "active");
    const pendingTimesheets = timesheets.filter((t: any) => t.status === "pending");
    const pendingLeave = leaveRequests.filter((l: any) => l.status === "pending");

    return (
        <DashboardLayout
            role="manager"
            pageTitle="Dashboard"
            pageDescription="Your team overview"
        >
            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard title="Team Members" value={activeEmployees.length} icon={<Users size={24} />} />
                <MetricCard title="Pending Timesheets" value={pendingTimesheets.length} icon={<FileText size={24} />} />
                <MetricCard title="Pending Leave" value={pendingLeave.length} icon={<Palmtree size={24} />} />
                <MetricCard title="Shifts Today" value="—" icon={<CalendarDays size={24} />} />
            </div>

            {/* Pending Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Timesheets Preview */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Clock size={18} /> Pending Timesheets
                        </h2>
                        {pendingTimesheets.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">All caught up! ✓</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingTimesheets.slice(0, 5).map((ts: any) => (
                                    <div key={ts.timesheet_id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                                        <div>
                                            <p className="text-sm font-medium">{ts.employee_id}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {new Date(ts.date).toLocaleDateString("en-AU")} · {ts.actual_hours?.toFixed(1)}h
                                            </p>
                                        </div>
                                        <StatusBadge status="pending" />
                                    </div>
                                ))}
                                {pendingTimesheets.length > 5 && (
                                    <a href="/manager/timesheets" className="text-sm text-[hsl(var(--brand))] hover:underline">
                                        View all {pendingTimesheets.length} →
                                    </a>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pending Leave Preview */}
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Palmtree size={18} /> Pending Leave
                        </h2>
                        {pendingLeave.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No pending requests ✓</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingLeave.slice(0, 5).map((lr: any) => (
                                    <div key={lr.request_id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                                        <div>
                                            <p className="text-sm font-medium">{lr.employee_id}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {new Date(lr.start_date).toLocaleDateString("en-AU")} – {new Date(lr.end_date).toLocaleDateString("en-AU")}
                                            </p>
                                        </div>
                                        <StatusBadge status="pending" />
                                    </div>
                                ))}
                                {pendingLeave.length > 5 && (
                                    <a href="/manager/leave" className="text-sm text-[hsl(var(--brand))] hover:underline">
                                        View all {pendingLeave.length} →
                                    </a>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
