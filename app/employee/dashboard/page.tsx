"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { MetricCard } from "@/components/ui/card";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { CalendarDays, Clock, Palmtree, DollarSign } from "lucide-react";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeDashboardPage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: shifts = [] } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
    });

    // Real-time listener for shifts
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('employee-dashboard-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'Shift',
                    filter: user?.employee_id ? `employee_id=eq.${user.employee_id}` : undefined
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Shift',
                    filter: user?.employee_id ? `employee_id=eq.${user.employee_id}` : undefined
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'Shift'
                },
                () => queryClient.invalidateQueries({ queryKey: ["my-shifts"] })
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.employee_id, queryClient]);

    const { data: leaveBalances = [] } = useQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => apiGet<any[]>("/leave/balances"),
    });

    const { data: timesheets = [] } = useQuery({
        queryKey: ["my-timesheets"],
        queryFn: () => apiGet<any[]>("/timesheets"),
    });

    const { data: swapRequests = [] } = useQuery({
        queryKey: ["my-swap-requests"],
        queryFn: () => apiGet<any[]>("/shifts/swaps"),
    });

    // Find next upcoming shift
    const now = new Date();
    const upcomingShifts = shifts
        .filter((s: any) => new Date(s.start_time) > now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const nextShift = upcomingShifts[0];

    // Total leave balance
    const totalLeaveHours = leaveBalances.reduce((sum: number, lb: any) => sum + (lb.balance_hours || 0), 0);

    // Latest timesheet gross pay
    const latestTimesheet = timesheets[0];

    const getShiftStatus = (shift: any) => {
        if (!shift) return "upcoming";
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);

        // Check for active swap/transfer requests for THIS shift
        const activeRequest = (swapRequests || []).find((sr: any) => 
            sr.shift_id === shift.shift_id && 
            ['pending_acceptance', 'pending_approval'].includes(sr.status)
        );

        if (activeRequest) {
            if (!activeRequest.target_employee_id) {
                return activeRequest.manager_note === 'swap' ? "pooled_swap" : "pooled_transfer";
            }
            return activeRequest.target_shift_id ? "swap_pending" : "transfer_pending";
        }

        if (end < now) return "completed";
        if (start <= now && end >= now) return "ongoing";
        return "upcoming";
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="Dashboard"
            pageDescription="Your work at a glance"
        >
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard
                    title="Upcoming Shifts"
                    value={upcomingShifts.length}
                    icon={<CalendarDays size={24} />}
                />
                <MetricCard
                    title="Leave Balance"
                    value={`${totalLeaveHours}h`}
                    icon={<Palmtree size={24} />}
                />
                <MetricCard
                    title="This Week Hours"
                    value={timesheets.length > 0 ? `${timesheets.reduce((s: number, t: any) => s + (t.actual_hours || 0), 0).toFixed(1)}h` : "0h"}
                    icon={<Clock size={24} />}
                />
                <MetricCard
                    title="Last Pay"
                    value={latestTimesheet ? `$${latestTimesheet.gross_pay?.toFixed(2)}` : "—"}
                    icon={<DollarSign size={24} />}
                />
            </div>

            {/* Next Shift Card */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Next Shift</h2>
                    {nextShift ? (
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))]">
                                <CalendarDays size={28} className="text-[hsl(var(--brand))]" />
                            </div>
                            <div>
                                <p className="font-semibold text-lg">
                                    {new Date(nextShift.start_time).toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" })}
                                </p>
                                <p className="text-[hsl(var(--muted-foreground))]">
                                    {new Date(nextShift.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                    {" – "}
                                    {new Date(nextShift.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>
                            <div className="ml-auto">
                                 <StatusBadge status={getShiftStatus(nextShift)} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))]">No upcoming shifts scheduled.</p>
                    )}
                </CardContent>
            </Card>

            {/* Leave Balances */}
            {leaveBalances.length > 0 && (
                <Card>
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold mb-4">Leave Balances</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {leaveBalances.map((lb: any) => (
                                <div key={lb.balance_id} className="rounded-xl bg-[hsl(var(--muted))] p-4 text-center">
                                    <p className="text-2xl font-bold">{lb.balance_hours}h</p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{lb.leave_type || "Leave"}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </DashboardLayout>
    );
}
