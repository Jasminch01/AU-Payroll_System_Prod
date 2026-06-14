"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { MetricCard } from "@/components/ui/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiPut } from "@/lib/api-client";
import { 
    Users, CalendarDays, FileText, Palmtree, Clock, MonitorPlay, 
    ArrowLeftRight, TrendingUp, CheckCircle, XCircle, ClipboardList 
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatDecimalHours } from "@/lib/utils";

export default function ManagerDashboardPage() {
    const queryClient = useQueryClient();

    const { data: summary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ["analytics-summary"],
        queryFn: () => apiGet<any>("/analytics/summary"),
    });

    const { data: labourData } = useQuery({
        queryKey: ["labour-vs-revenue"],
        queryFn: () => apiGet<any>("/analytics/labour-vs-revenue"),
    });

    const { data: timesheets = [] } = useQuery({
        queryKey: ["timesheets"],
        queryFn: () => apiGet<any[]>("/timesheets"),
    });

    const { data: leaveRequests = [] } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const { data: shiftSwaps = [] } = useQuery({
        queryKey: ["manager-swap-approvals"],
        queryFn: () => apiGet<any[]>("/shifts/swaps?status=pending_approval"),
    });

    const { data: myShifts = [] } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
    });

    const swapMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
            apiPut(`/shifts/swaps/${id}`, { action }),
        onSuccess: () => {
            toast.success("Shift swap updated");
            queryClient.invalidateQueries({ queryKey: ["manager-swap-approvals"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const pendingTimesheets = timesheets.filter((t: any) => t.status === "pending");
    const pendingLeave = leaveRequests.filter((l: any) => l.status === "pending");
    
    // Show all accepted/claimed swaps awaiting approval (works for both Employee and Manager swaps)
    const pendingTeamSwaps = shiftSwaps.filter((swap: any) => {
        // Only show swaps that have been accepted by someone (target_employee_id filled in)
        return swap.status === 'pending_approval' && !!swap.target_employee_id;
    });

    // Find next upcoming shift for the manager
    const now = new Date();
    const nextShift = myShifts
        .filter((s: any) => new Date(s.start_time) > now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

    return (
        <DashboardLayout
            role="manager"
            pageTitle="Dashboard"
            pageDescription="Manage your team and operations"
        >
            {/* Core Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <MetricCard 
                    title="Active Team" 
                    value={isLoadingSummary ? "—" : summary?.active_employees ?? 0} 
                    icon={<Users size={24} />} 
                />
                <MetricCard 
                    title="Shifts Today" 
                    value={isLoadingSummary ? "—" : summary?.shifts_today ?? 0} 
                    icon={<CalendarDays size={24} />} 
                />
                <MetricCard 
                    title="Pending Timesheets" 
                    value={isLoadingSummary ? "—" : summary?.pending_timesheets ?? 0} 
                    icon={<FileText size={24} />} 
                />
                <MetricCard 
                    title="Pending Leave" 
                    value={isLoadingSummary ? "—" : summary?.pending_leave ?? 0} 
                    icon={<Palmtree size={24} />} 
                />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <MetricCard
                    title="Labour %"
                    value={labourData ? `${labourData?.labour_percentage?.toFixed(1) ?? "—"}%` : "—"}
                    description={labourData ? `Target: ${labourData?.threshold_min}% – ${labourData?.threshold_max}%` : "Efficiency tracking"}
                    icon={<TrendingUp size={24} />}
                />
                <MetricCard
                    title="Est. Labour Cost Today"
                    value={isLoadingSummary ? "—" : `$${(summary?.estimated_labour_cost_today ?? 0).toLocaleString()}`}
                    icon={<Clock size={24} />}
                />
                <MetricCard
                    title="Team Swaps"
                    value={pendingTeamSwaps.length}
                    icon={<ArrowLeftRight size={24} />}
                />
            </div>

            {/* Next Shift Card - Prominent for Manager */}
            {nextShift && (
                <Card className="mb-8 border-[hsl(var(--brand))]/20 bg-[hsl(var(--brand-light))]/10 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CalendarDays size={120} />
                    </div>
                    <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--brand))] text-white shadow-xl shadow-[hsl(var(--brand))]/30">
                                    <CalendarDays size={32} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-[hsl(var(--brand))] uppercase tracking-widest">Your Next Assigned Shift</p>
                                    <h3 className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {new Date(nextShift.start_time).toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" })}
                                    </h3>
                                    <p className="text-lg font-medium text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                                        <Clock size={18} />
                                        {new Date(nextShift.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                        {" - "}
                                        {new Date(nextShift.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                    </p>
                                    {nextShift.ShiftChecklistItem && nextShift.ShiftChecklistItem.length > 0 && (
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold text-[10px] uppercase">
                                                <ClipboardList size={11} className="shrink-0" />
                                                {nextShift.ShiftChecklistItem.filter((item: any) => item.status === 'done').length}/{nextShift.ShiftChecklistItem.length} Tasks
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Link href="/manager/shifts">
                                <Button className="rounded-xl px-8 h-12 bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))]/90 text-white font-bold shadow-lg shadow-[hsl(var(--brand))]/20">
                                    View Full Roster
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Charts and Approvals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Efficiency Chart */}
                <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold">Labour Efficiency</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Weekly labour vs daily revenue</p>
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={labourData?.chart_data?.length > 0 ? labourData.chart_data : []}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                                />
                                <Tooltip 
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        border: '1px solid hsl(var(--border))',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                    }}
                                />
                                <Bar dataKey="revenue" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} name="Revenue" />
                                <Bar dataKey="labour" fill="hsl(var(--danger))" opacity={0.6} radius={[4, 4, 0, 0]} name="Labour" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Swap Approvals */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowLeftRight size={20} className="text-[hsl(var(--brand))]" />
                            Team Swaps
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
                        {pendingTeamSwaps.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center h-full space-y-3 opacity-60">
                                <CheckCircle size={32} className="text-[hsl(var(--success))]" />
                                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">All swaps clear</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendingTeamSwaps.map((swap: any) => (
                                    <div key={swap.request_id} className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-[10px] font-bold">
                                                {swap.Requester?.first_name?.[0]}{swap.Requester?.last_name?.[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{swap.Requester?.first_name} {swap.Requester?.last_name}</p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                                                    {new Date(swap.Shift?.start_time).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="flex-1 h-8 text-[10px] font-bold"
                                                onClick={() => swapMutation.mutate({ id: swap.request_id, action: "reject" })}
                                            >
                                                <XCircle size={12} className="mr-1" /> Deny
                                            </Button>
                                            <Button 
                                                variant="success" 
                                                size="sm" 
                                                className="flex-1 h-8 text-[10px] font-bold"
                                                onClick={() => swapMutation.mutate({ id: swap.request_id, action: "approve" })}
                                            >
                                                <CheckCircle size={12} className="mr-1" /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* General Pending List Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                             <Clock size={18} /> Pending Timesheets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pendingTimesheets.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Nothing to review.</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingTimesheets.slice(0, 4).map((ts: any) => (
                                    <div key={ts.timesheet_id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--muted))]/10 text-xs font-bold">
                                                {ts.Employee?.first_name?.[0]}{ts.Employee?.last_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{ts.Employee?.first_name} {ts.Employee?.last_name}</p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                    {new Date(ts.date).toLocaleDateString()} · {formatDecimalHours(ts.actual_hours)}
                                                </p>
                                            </div>
                                        </div>
                                        <Link href="/manager/timesheets">
                                            <Button variant="ghost" size="sm" className="h-8 text-[10px]">Review</Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                             <Palmtree size={18} /> Leave Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pendingLeave.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No requests found.</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingLeave.slice(0, 4).map((lr: any) => (
                                    <div key={lr.request_id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--info-light))] text-[hsl(var(--info))] text-xs font-bold">
                                                {lr.Employee?.first_name?.[0]}{lr.Employee?.last_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{lr.Employee?.first_name} {lr.Employee?.last_name}</p>
                                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate max-w-[150px]">
                                                    {new Date(lr.start_date).toLocaleDateString()} - {new Date(lr.end_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Link href="/manager/leave">
                                            <Button variant="ghost" size="sm" className="h-8 text-[10px]">Review</Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick Launch */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center md:text-left">
                    <h3 className="font-bold">Operational Tools</h3>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Access shared hardware or kiosk settings.</p>
                </div>
                <div className="flex gap-4">
                    <Link href="/kiosk" target="_blank">
                        <Button variant="outline" className="gap-2 font-bold h-10 rounded-xl px-6">
                            <MonitorPlay size={18} />
                            Launch Kiosk
                        </Button>
                    </Link>
                </div>
            </div>
        </DashboardLayout>
    );
}
