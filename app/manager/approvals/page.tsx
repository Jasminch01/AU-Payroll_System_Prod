"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Palmtree, Calendar } from "lucide-react";

export default function ManagerApprovalsPage() {
    const queryClient = useQueryClient();

    const { data: timesheets = [] } = useQuery({
        queryKey: ["timesheets"],
        queryFn: () => apiGet<any[]>("/timesheets"),
    });

    const { data: leaveRequests = [] } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const timesheetMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => apiPut(`/timesheets/${id}`, { status }),
        onSuccess: () => { toast.success("Timesheet updated"); queryClient.invalidateQueries({ queryKey: ["timesheets"] }); },
        onError: (err: Error) => toast.error(err.message),
    });

    const leaveMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => apiPut(`/leave/${id}`, { status }),
        onSuccess: () => { toast.success("Leave updated"); queryClient.invalidateQueries({ queryKey: ["leave-requests"] }); },
        onError: (err: Error) => toast.error(err.message),
    });

    const pendingTimesheets = timesheets.filter((t: any) => t.status === "pending");
    const pendingLeave = leaveRequests.filter((l: any) => l.status === "pending");

    return (
        <DashboardLayout
            role="manager"
            pageTitle="Approvals"
            pageDescription={`${pendingTimesheets.length + pendingLeave.length} pending items`}
        >
            {/* Timesheets */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock size={18} /> Timesheets</h2>
                {pendingTimesheets.length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-[hsl(var(--muted-foreground))]">All timesheets approved ✓</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {pendingTimesheets.map((ts: any) => (
                            <Card key={ts.timesheet_id} className="animate-slide-up">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--warning-light))]">
                                                <Clock size={18} className="text-[hsl(var(--warning))]" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{ts.Employee ? `${ts.Employee.first_name} ${ts.Employee.last_name}` : ts.employee_id?.slice(0, 8) + "…"}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{new Date(ts.date).toLocaleDateString("en-AU")} · {ts.actual_hours?.toFixed(1)}h · ${ts.gross_pay?.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" className="text-[hsl(var(--danger))]" onClick={() => timesheetMutation.mutate({ id: ts.timesheet_id, status: "rejected" })}>
                                                <XCircle size={16} /> Reject
                                            </Button>
                                            <Button size="sm" variant="success" onClick={() => timesheetMutation.mutate({ id: ts.timesheet_id, status: "approved" })}>
                                                <CheckCircle size={16} /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Leave Requests */}
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Palmtree size={18} /> Leave Requests</h2>
                {pendingLeave.length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-[hsl(var(--muted-foreground))]">No pending leave ✓</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {pendingLeave.map((lr: any) => (
                            <Card key={lr.request_id} className="animate-slide-up">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--info-light))]">
                                                <Calendar size={18} className="text-[hsl(var(--info))]" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{lr.Employee ? `${lr.Employee.first_name} ${lr.Employee.last_name}` : lr.employee_id?.slice(0, 8) + "…"}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    {new Date(lr.start_date).toLocaleDateString("en-AU")} – {new Date(lr.end_date).toLocaleDateString("en-AU")} · {lr.total_hours}h
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" className="text-[hsl(var(--danger))]" onClick={() => leaveMutation.mutate({ id: lr.request_id, status: "rejected" })}>
                                                <XCircle size={16} /> Reject
                                            </Button>
                                            <Button size="sm" variant="success" onClick={() => leaveMutation.mutate({ id: lr.request_id, status: "approved" })}>
                                                <CheckCircle size={16} /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
