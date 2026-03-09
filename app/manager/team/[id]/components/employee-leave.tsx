"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiPatch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, CheckCircle, XCircle, Palmtree, Clock } from "lucide-react";
import type { LeaveBalance, LeaveRequest } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";

interface LeaveBalanceWithType extends LeaveBalance {
    LeaveType?: { name: string; is_paid: boolean } | null;
}

interface LeaveRequestWithType extends LeaveRequest {
    LeaveType?: { name: string } | null;
}

export function EmployeeLeave({ employeeId }: { employeeId: string }) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Approval dialog
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Fetch leave data for this specific employee
    const { data: balances = [], isLoading: balancesLoading } = useQuery({
        queryKey: ["employee-leave-balances", employeeId],
        queryFn: () => apiGet<LeaveBalanceWithType[]>("/leave/balances", { employee_id: employeeId }),
        enabled: !!employeeId,
    });

    const { data: requests = [], isLoading: requestsLoading } = useQuery({
        queryKey: ["employee-leave-requests", employeeId],
        queryFn: () => apiGet<LeaveRequestWithType[]>("/leave", { employee_id: employeeId }),
        enabled: !!employeeId,
    });

    // Leave approval/rejection mutation
    const actionMutation = useMutation({
        mutationFn: ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) =>
            apiPut(`/leave/${id}`, { status, rejection_reason }),
        onSuccess: (_, vars) => {
            toast.success(`Leave request ${vars.status}`);
            queryClient.invalidateQueries({ queryKey: ["employee-leave-requests", employeeId] });
            queryClient.invalidateQueries({ queryKey: ["employee-leave-balances", employeeId] });
            setRejectTarget(null);
            setRejectionReason("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function confirmReject() {
        if (!rejectTarget) return;
        actionMutation.mutate({
            id: rejectTarget,
            status: "rejected",
            rejection_reason: rejectionReason || undefined,
        });
    }

    const isLoading = balancesLoading || requestsLoading;

    if (isLoading) return <div className="p-4 text-[hsl(var(--muted-foreground))]">Loading leave data...</div>;

    return (
        <div className="space-y-6">
            {/* Leave Balances */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Leave Balances</CardTitle>
                </CardHeader>
                <CardContent>
                    {balances.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {balances.map((b) => {
                                const remaining = Math.max(0, (b.accrued_hours || 0) - (b.taken_hours || 0));
                                return (
                                    <div key={b.balance_id} className="p-4 border rounded-lg bg-[hsl(var(--muted))]/10 group relative">
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-semibold">{b.LeaveType?.name || "Leave"}</h4>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[hsl(var(--muted-foreground))]">Remaining</span>
                                            <span className="font-bold text-[hsl(var(--success))]">{remaining}h</span>
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-[hsl(var(--muted-foreground))]">Accrued</span>
                                            <span>{b.accrued_hours}h</span>
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-[hsl(var(--muted-foreground))]">Taken</span>
                                            <span>{b.taken_hours}h</span>
                                        </div>
                                        {b.pending_hours > 0 && (
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-[hsl(var(--warning))]">Pending</span>
                                                <span className="text-[hsl(var(--warning))]">{b.pending_hours}h</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                            <Palmtree size={28} className="mx-auto mb-2 opacity-50" />
                            No leave balances found for this employee.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Leave History */}
            <Card>
                <CardHeader>
                    <CardTitle>Leave History</CardTitle>
                </CardHeader>
                <CardContent>
                    {requests.length > 0 ? (
                        <div className="space-y-3">
                            {requests.map((req) => (
                                <div key={req.request_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border rounded-lg bg-[hsl(var(--muted))]/10">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">{req.LeaveType?.name || "Leave"}</p>
                                            <StatusBadge status={req.status} />
                                        </div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {new Date(req.start_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                            {" – "}
                                            {new Date(req.end_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                                            <span className="mx-1.5">·</span>
                                            {req.total_hours}h
                                        </p>
                                        {req.reason && (
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 italic">"{req.reason}"</p>
                                        )}
                                        {req.rejection_reason && (
                                            <p className="text-xs text-[hsl(var(--danger))] mt-0.5">
                                                Rejection: {req.rejection_reason}
                                            </p>
                                        )}
                                    </div>
                                    {req.status === "pending" && (
                                        req.employee_id === user?.employee_id ? (
                                            <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] ml-2">
                                                <Clock size={14} className="inline mr-1 -mt-0.5" />
                                                Requires Owner approval
                                            </span>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[hsl(var(--danger))]"
                                                    onClick={() => setRejectTarget(req.request_id)}
                                                >
                                                    <XCircle size={14} /> Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    onClick={() => actionMutation.mutate({ id: req.request_id, status: "approved" })}
                                                >
                                                    <CheckCircle size={14} /> Approve
                                                </Button>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                            No leave requests found.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Rejection Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                        <DialogDescription>Provide a reason for rejecting this request.</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Input
                            label="Rejection Reason"
                            placeholder="e.g. Insufficient staffing"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(""); }}>Cancel</Button>
                        <Button variant="danger" loading={actionMutation.isPending} onClick={confirmReject}>
                            <XCircle size={16} /> Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
