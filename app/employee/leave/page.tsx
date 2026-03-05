"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Palmtree, Plus, Calendar } from "lucide-react";

export default function EmployeeLeavePage() {
    const queryClient = useQueryClient();
    const [requestOpen, setRequestOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [leaveType, setLeaveType] = useState("annual");
    const [reason, setReason] = useState("");

    const { data: leaveRequests = [], isLoading } = useQuery({
        queryKey: ["my-leave"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const { data: leaveBalances = [] } = useQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => apiGet<any[]>("/leave/balances"),
    });

    const { data: leaveTypes = [] } = useQuery({
        queryKey: ["leave-types"],
        queryFn: () => apiGet<any[]>("/leave/types"),
    });

    const requestMutation = useMutation({
        mutationFn: (data: any) => apiPost("/leave", data),
        onSuccess: () => {
            toast.success("Leave request submitted!");
            queryClient.invalidateQueries({ queryKey: ["my-leave", "my-leave-balances"] });
            setRequestOpen(false);
            setStartDate("");
            setEndDate("");
            setReason("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    return (
        <DashboardLayout
            role="employee"
            pageTitle="Leave"
            pageDescription="View balances and request time off"
            actions={
                <Button onClick={() => setRequestOpen(true)}>
                    <Plus size={16} /> Request Leave
                </Button>
            }
        >
            {/* Leave Balances */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {leaveBalances.map((lb: any) => (
                    <Card key={lb.balance_id} className="animate-slide-up">
                        <CardContent className="p-5 text-center">
                            <p className="text-3xl font-bold text-[hsl(var(--brand))]">{lb.balance_hours}h</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{lb.leave_type || "Leave"}</p>
                            <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))] mt-3">
                                <div
                                    className="h-full rounded-full bg-[hsl(var(--brand))] transition-all"
                                    style={{ width: `${Math.min((lb.balance_hours / (lb.max_hours || 160)) * 100, 100)}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Leave Requests */}
            <h2 className="text-lg font-semibold mb-4">My Requests</h2>
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                </div>
            ) : leaveRequests.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Palmtree size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                        <p className="text-[hsl(var(--muted-foreground))]">No leave requests yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {leaveRequests.map((lr: any) => (
                        <Card key={lr.request_id} className="animate-slide-up">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--info-light))]">
                                            <Calendar size={18} className="text-[hsl(var(--info))]" />
                                        </div>
                                        <div>
                                            <p className="font-medium capitalize">{lr.leave_type} Leave</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {new Date(lr.start_date).toLocaleDateString("en-AU")} – {new Date(lr.end_date).toLocaleDateString("en-AU")}
                                                {" · "}{lr.total_hours}h
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge status={lr.status} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Request Leave Dialog */}
            <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Time Off</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Leave Type</label>
                            <select
                                value={leaveType}
                                onChange={(e) => setLeaveType(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                {leaveTypes.length > 0
                                    ? leaveTypes.map((lt: any) => (
                                        <option key={lt.leave_type_id} value={lt.name}>{lt.name}</option>
                                    ))
                                    : <>
                                        <option value="annual">Annual Leave</option>
                                        <option value="sick">Sick Leave</option>
                                        <option value="personal">Personal Leave</option>
                                        <option value="unpaid">Unpaid Leave</option>
                                    </>
                                }
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <Input
                            label="Reason (optional)"
                            placeholder="e.g. Family holiday"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (!startDate || !endDate) return toast.error("Select dates");
                                requestMutation.mutate({
                                    leave_type: leaveType,
                                    start_date: startDate,
                                    end_date: endDate,
                                    reason,
                                });
                            }}
                            loading={requestMutation.isPending}
                        >
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
