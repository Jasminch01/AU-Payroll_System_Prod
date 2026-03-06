"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Palmtree, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveRequest } from "@/types/database";

interface LeaveRecord extends LeaveRequest {
    Employee?: {
        first_name: string;
        last_name: string;
    } | null;
    LeaveType?: {
        name: string;
        is_paid: boolean;
    } | null;
}

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

export default function OwnerLeavePage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabKey>("all");

    const { data: leaveRequests = [], isLoading } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<LeaveRecord[]>("/leave"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            apiPut(`/leave/${id}`, { status }),
        onSuccess: () => {
            toast.success("Leave request updated");
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const filtered = activeTab === "all"
        ? leaveRequests
        : leaveRequests.filter((l) => l.status === activeTab);

    const counts: Record<TabKey, number> = {
        all: leaveRequests.length,
        pending: leaveRequests.filter((l) => l.status === "pending").length,
        approved: leaveRequests.filter((l) => l.status === "approved").length,
        rejected: leaveRequests.filter((l) => l.status === "rejected").length,
    };

    const getEmployeeName = (lr: LeaveRecord) => {
        const emp = lr.Employee;
        if (emp) return `${emp.first_name} ${emp.last_name}`;
        return lr.employee_id?.slice(0, 8) + "…";
    };

    const getEmployeeInitials = (lr: LeaveRecord) => {
        const emp = lr.Employee;
        if (emp) return `${emp.first_name?.[0] ?? ""}${emp.last_name?.[0] ?? ""}`;
        return "??";
    };

    const totalPendingHours = leaveRequests
        .filter((l) => l.status === "pending")
        .reduce((s, l) => s + (l.total_hours || 0), 0);

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Leave Requests"
            pageDescription="Review and manage leave requests"
        >
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <MetricCard title="Total Requests" value={leaveRequests.length} icon={<Calendar size={24} />} />
                <MetricCard title="Pending" value={counts.pending} icon={<Clock size={24} />} />
                <MetricCard title="Pending Hours" value={`${totalPendingHours}h`} icon={<Palmtree size={24} />} />
                <MetricCard title="Approved" value={counts.approved} icon={<CheckCircle size={24} />} />
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

            {/* Leave Requests List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Palmtree size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {activeTab === "all" ? "No leave requests" : `No ${activeTab} leave requests`}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((lr) => (
                        <Card key={lr.request_id} className="animate-slide-up">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                                            {getEmployeeInitials(lr)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{getEmployeeName(lr)}</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {lr.LeaveType?.name ?? "Leave"}
                                                {lr.LeaveType?.is_paid === false && (
                                                    <span className="ml-1.5 text-xs text-[hsl(var(--warning))]">(Unpaid)</span>
                                                )}
                                                <span className="mx-1.5">·</span>
                                                {new Date(lr.start_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                                                {" – "}
                                                {new Date(lr.end_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                                <span className="mx-1.5">·</span>
                                                {lr.total_hours}h
                                            </p>
                                            {lr.reason && (
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 italic">"{lr.reason}"</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={lr.status} />
                                        {lr.status === "pending" && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[hsl(var(--danger))]"
                                                    onClick={() => updateMutation.mutate({ id: lr.request_id, status: "rejected" })}
                                                >
                                                    <XCircle size={16} /> Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    onClick={() => updateMutation.mutate({ id: lr.request_id, status: "approved" })}
                                                >
                                                    <CheckCircle size={16} /> Approve
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
