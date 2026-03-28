"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { MetricCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { apiGet, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { Users, CalendarDays, FileText, Palmtree, DollarSign, AlertTriangle, ArrowLeftRight, CheckCircle, XCircle, ShieldCheck, TrendingUp, Info } from "lucide-react";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';


export default function OwnerDashboardPage() {
    const queryClient = useQueryClient();
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const xeroStatusParam = searchParams?.get('xero');
    const xeroErrorMsg = searchParams?.get('msg');

    const { data: summary, isLoading } = useQuery({
        queryKey: ["analytics-summary"],
        queryFn: () => apiGet<any>("/analytics/summary"),
    });

    const { data: labourData } = useQuery({
        queryKey: ["labour-vs-revenue"],
        queryFn: () => apiGet<any>("/analytics/labour-vs-revenue"),
    });

    // Owners handle Manager shift swaps
    const { data: shiftSwaps = [] } = useQuery({
        queryKey: ["owner-swap-approvals"],
        queryFn: () => apiGet<any[]>("/shifts/swaps?status=pending_approval"),
    });

    const { data: compliance, isLoading: isComplianceLoading } = useQuery({
        queryKey: ["compliance-check"],
        queryFn: () => apiGet<any>("/analytics/compliance"),
    });


    const swapMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
            apiPut(`/shifts/swaps/${id}`, { action }),
        onSuccess: () => {
            toast.success("Manager shift swap updated");
            queryClient.invalidateQueries({ queryKey: ["owner-swap-approvals"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const pendingManagerSwaps = shiftSwaps.filter((swap: any) => {
        const reqRole = swap.Requester?.User?.[0]?.role || 'employee';
        return reqRole === 'manager';
    });

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Dashboard"
            pageDescription="Your business at a glance"
        >
            {/* Xero Connection Banner */}
            {xeroStatusParam === 'connected' && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-[hsl(var(--success))]/20 bg-[hsl(var(--success-light))] p-4">
                    <CheckCircle size={20} className="text-[hsl(var(--success))] shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-[hsl(var(--success))]">Xero Connected</p>
                        <p className="text-sm text-[hsl(var(--success))]/80">Your business accounts are successfully connected to Xero.</p>
                    </div>
                </div>
            )}

            {xeroStatusParam === 'error' && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger-light))] p-4">
                    <AlertTriangle size={20} className="text-[hsl(var(--danger))] shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-[hsl(var(--danger))]">Xero Connection Failed</p>
                        <p className="text-sm text-[hsl(var(--danger))]/80">{xeroErrorMsg || "Something went wrong. Please try again."}</p>
                    </div>
                </div>
            )}

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





            {/* Metric Cards — Row 1: Core stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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

            {/* Metric Cards — Row 2: Financial + Swaps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <MetricCard
                    title="Est. Labour Cost Today"
                    value={isLoading ? "—" : `$${(summary?.estimated_labour_cost_today ?? 0).toLocaleString()}`}
                    icon={<DollarSign size={24} />}
                />
                <MetricCard
                    title="Labour %"
                    value={labourData ? `${labourData?.labour_percentage?.toFixed(1) ?? "—"}%` : (isLoading ? "—" : "N/A")}
                    description={labourData ? `Target: ${labourData?.threshold_min ?? 25}% – ${labourData?.threshold_max ?? 35}%` : undefined}
                    icon={<TrendingUp size={24} />}
                />
                <MetricCard
                    title="Pending Swaps"
                    value={isLoading ? "—" : shiftSwaps.length ?? 0}
                    icon={<ArrowLeftRight size={24} />}
                />
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold">Labour vs Revenue</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Weekly efficiency tracking</p>
                        </div>
                        <div className="flex items-center gap-2 text-[hsl(var(--success))] bg-[hsl(var(--success-light))] px-3 py-1 rounded-full text-xs font-bold">
                            <TrendingUp size={14} /> +12.5%
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={labourData?.chart_data?.length > 0 ? labourData.chart_data : [
                                    { date: 'Mon', revenue: 0, labour: 0 },
                                    { date: 'Tue', revenue: 0, labour: 0 },
                                    { date: 'Wed', revenue: 0, labour: 0 },
                                    { date: 'Thu', revenue: 0, labour: 0 },
                                    { date: 'Fri', revenue: 0, labour: 0 },
                                    { date: 'Sat', revenue: 0, labour: 0 },
                                    { date: 'Sun', revenue: 0, labour: 0 },
                                ]}
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
                                <Bar dataKey="labour" fill="hsl(var(--danger))" opacity={0.6} radius={[4, 4, 0, 0]} name="Labour Cost" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={cn(
                    "rounded-2xl border p-6 flex flex-col transition-all duration-300 shadow-sm",
                    compliance?.score === 100
                        ? "border-[hsl(var(--success))]/20 bg-[hsl(var(--success-light))]/30 shadow-[0_0_20px_-12px_hsl(var(--success))]"
                        : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                )}>
                    {compliance?.score === 100 ? (
                        <div className="flex flex-col items-center text-center justify-center h-full space-y-4 py-4">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-full bg-[hsl(var(--success))] text-white flex items-center justify-center shadow-lg shadow-[hsl(var(--success))]/20 animate-in zoom-in-50 duration-500">
                                    <ShieldCheck size={32} />
                                </div>
                                <div className="absolute -right-1 -bottom-1 h-6 w-6 rounded-full bg-white border-2 border-[hsl(var(--success))] text-[hsl(var(--success))] flex items-center justify-center">
                                    <CheckCircle size={14} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-[hsl(var(--success))]">Fully Compliant</h3>
                                <p className="text-sm text-[hsl(var(--success))]/70 font-medium max-w-[200px] mt-1 leading-relaxed">
                                    Your business is 100% ready for Australian payroll.
                                </p>
                            </div>
                            <div className="w-full h-1.5 bg-[hsl(var(--success))]/10 rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-[hsl(var(--success))] w-full rounded-full" />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full shrink-0 bg-[hsl(var(--muted))]/20 text-[hsl(var(--muted-foreground))]">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Setup Checklist</h3>
                                    <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                                        {isComplianceLoading ? "Checking status..." : `${compliance?.score}% Complete`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                {compliance?.alerts?.length > 0 ? (
                                    <ul className="space-y-3">
                                        {compliance.alerts.map((alert: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted))]/10 border border-[hsl(var(--border))]/30">
                                                <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground))]/40 mt-1.5 shrink-0" />
                                                <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium leading-tight">{alert}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Settings audit required.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>


        </DashboardLayout>
    );
}
