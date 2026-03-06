"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { MetricCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import Link from "next/link";
import { Users, CalendarDays, FileText, Palmtree, DollarSign, AlertTriangle } from "lucide-react";

export default function OwnerDashboardPage() {
    const { data: summary, isLoading } = useQuery({
        queryKey: ["analytics-summary"],
        queryFn: () => apiGet<any>("/analytics/summary"),
    });

    const { data: labourData } = useQuery({
        queryKey: ["labour-vs-revenue"],
        queryFn: () => apiGet<any>("/analytics/labour-vs-revenue"),
    });

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Dashboard"
            pageDescription="Your business at a glance"
        >
            {/* Labour Alert Banner */}
            {labourData?.alert_status === "over" && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger-light))] p-4">
                    <AlertTriangle size={20} className="text-[hsl(var(--danger))] shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-[hsl(var(--danger))]">Labour Cost Alert</p>
                        <p className="text-sm text-[hsl(var(--danger))]/80">
                            Labour is at <strong>{labourData?.labour_percentage?.toFixed(1)}%</strong> of revenue — above your {labourData?.threshold_max}% threshold.
                        </p>
                    </div>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard
                    title="Active Employees"
                    value={isLoading ? "—" : summary?.active_employees ?? 0}
                    icon={<Users size={24} />}
                />
                <MetricCard
                    title="Shifts Today"
                    value={isLoading ? "—" : summary?.shifts_today ?? 0}
                    icon={<CalendarDays size={24} />}
                />
                <MetricCard
                    title="Pending Timesheets"
                    value={isLoading ? "—" : summary?.pending_timesheets ?? 0}
                    icon={<FileText size={24} />}
                />
                <MetricCard
                    title="Pending Leave"
                    value={isLoading ? "—" : summary?.pending_leave ?? 0}
                    icon={<Palmtree size={24} />}
                />
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <MetricCard
                    title="Est. Labour Cost Today"
                    value={isLoading ? "—" : `$${(summary?.estimated_labour_cost_today ?? 0).toLocaleString()}`}
                    icon={<DollarSign size={24} />}
                />
                {labourData && (
                    <MetricCard
                        title="Labour %"
                        value={`${labourData?.labour_percentage?.toFixed(1) ?? "—"}%`}
                        description={`Target: ${labourData?.threshold_min ?? 25}% – ${labourData?.threshold_max ?? 35}%`}
                        icon={<AlertTriangle size={24} />}
                    />
                )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Invite Employee", href: "/owner/employees", icon: <Users size={18} /> },
                        { label: "Create Roster", href: "/owner/roster", icon: <CalendarDays size={18} /> },
                        { label: "Review Timesheets", href: "/owner/timesheets", icon: <FileText size={18} /> },
                        { label: "Run Payroll", href: "/owner/payroll", icon: <DollarSign size={18} /> },
                    ].map((action) => (
                        <Link
                            key={action.label}
                            href={action.href}
                            className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-4 text-center text-sm font-medium text-[hsl(var(--muted-foreground))] transition-all hover:border-[hsl(var(--brand))] hover:text-[hsl(var(--brand))] hover:shadow-sm"
                        >
                            {action.icon}
                            {action.label}
                        </Link>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
