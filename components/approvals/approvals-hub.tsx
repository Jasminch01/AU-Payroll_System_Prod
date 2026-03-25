"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiGet, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Palmtree, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type ApprovalStatus = "all" | "pending" | "approved" | "rejected";

interface ApprovalsHubProps {
    role: "owner" | "manager";
}

export function ApprovalsHub({ role }: ApprovalsHubProps) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState("timesheets");
    const [statusFilter, setStatusFilter] = useState<ApprovalStatus>("pending");

    // Rejection dialog
    const [rejectTarget, setRejectTarget] = useState<{ id: string; type: "timesheet" | "leave" | "swap" } | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Queries - Fetch all to allow quick filtering
    const { data: timesheets = [], isLoading: loadingTS } = useQuery({
        queryKey: ["timesheets", "all"],
        queryFn: () => apiGet<any[]>("/timesheets"),
    });

    const { data: leaveRequests = [], isLoading: loadingLeave } = useQuery({
        queryKey: ["leave-requests", "all"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const { data: shiftSwaps = [], isLoading: loadingSwaps } = useQuery({
        queryKey: ["shift-swaps", "all"],
        queryFn: () => apiGet<any[]>("/shifts/swaps"),
    });

    // Mutations
    const timesheetMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => apiPut(`/timesheets/${id}`, { status }),
        onSuccess: () => {
            toast.success("Timesheet updated");
            queryClient.invalidateQueries({ queryKey: ["timesheets"] });
            setRejectTarget(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const leaveMutation = useMutation({
        mutationFn: ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) =>
            apiPut(`/leave/${id}`, { status, rejection_reason }),
        onSuccess: () => {
            toast.success("Leave updated");
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            setRejectTarget(null);
            setRejectionReason("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const swapMutation = useMutation({
        mutationFn: ({ id, action, note }: { id: string; action: "approve" | "reject"; note?: string }) =>
            apiPut(`/shifts/swaps/${id}`, { action, manager_note: note }),
        onSuccess: () => {
            toast.success("Shift swap updated");
            queryClient.invalidateQueries({ queryKey: ["shift-swaps"] });
            setRejectTarget(null);
            setRejectionReason("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Filtering Logic
    const filterByStatus = (items: any[]) => {
        if (statusFilter === "all") return items;
        return items.filter(item => {
            const status = item.status?.toLowerCase();
            if (statusFilter === "pending") return status === "pending" || status === "pending_approval";
            return status === statusFilter;
        });
    };

    const filteredTS = filterByStatus(timesheets);
    const filteredLeave = filterByStatus(leaveRequests);
    const filteredSwaps = filterByStatus(shiftSwaps);

    const pendingCount =
        timesheets.filter((t: any) => t.status === "pending").length +
        leaveRequests.filter((l: any) => l.status === "pending").length +
        shiftSwaps.filter((s: any) => s.status === "pending_approval").length;

    function handleRejectTrigger(id: string, type: "timesheet" | "leave" | "swap") {
        setRejectTarget({ id, type });
    }

    function confirmReject() {
        if (!rejectTarget) return;

        if (rejectTarget.type === "timesheet") {
            timesheetMutation.mutate({ id: rejectTarget.id, status: "rejected" });
        } else if (rejectTarget.type === "leave") {
            leaveMutation.mutate({
                id: rejectTarget.id,
                status: "rejected",
                rejection_reason: rejectionReason || undefined,
            });
        } else if (rejectTarget.type === "swap") {
            swapMutation.mutate({
                id: rejectTarget.id,
                action: "reject",
                note: rejectionReason || undefined
            });
        }
    }

    const StatusFilterButtons = () => (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {(["all", "pending", "approved", "rejected"] as ApprovalStatus[]).map((status) => (
                <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="capitalize text-xs rounded-full px-4"
                >
                    {status}
                </Button>
            ))}
        </div>
    );

    return (
        <DashboardLayout
            role={role}
            pageTitle="Approvals Hub"
            pageDescription={`${pendingCount} items awaiting review`}
        >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="timesheets" className="flex items-center gap-2">
                        <Clock size={16} /> Timesheets
                    </TabsTrigger>
                    <TabsTrigger value="leave" className="flex items-center gap-2">
                        <Palmtree size={16} /> Leave
                    </TabsTrigger>
                    <TabsTrigger value="swaps" className="flex items-center gap-2">
                        <ArrowLeftRight size={16} /> Swaps
                    </TabsTrigger>
                </TabsList>

                <StatusFilterButtons />

                {/* Timesheets Content */}
                <TabsContent value="timesheets" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {loadingTS ? (
                        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="h-20 skeleton" />)}</div>
                    ) : filteredTS.length === 0 ? (
                        <Card><CardContent className="p-12 text-center text-muted-foreground">No timesheets found ✓</CardContent></Card>
                    ) : (
                        filteredTS.map((ts: any) => (
                            <Card key={ts.timesheet_id}>
                                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-warning-light flex items-center justify-center text-warning">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{ts.Employee ? `${ts.Employee.first_name} ${ts.Employee.last_name}` : "Unknown Employee"}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(ts.date).toLocaleDateString("en-AU")} · {ts.actual_hours?.toFixed(1)}h
                                                {ts.gross_pay !== null && ` · $${ts.gross_pay.toFixed(2)}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={ts.status} />
                                        {(ts.status === "pending" || ts.status === "pending_approval") && (
                                            <>
                                                <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleRejectTrigger(ts.timesheet_id, "timesheet")}>
                                                    <XCircle size={16} className="mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" variant="success" onClick={() => timesheetMutation.mutate({ id: ts.timesheet_id, status: "approved" })}>
                                                    <CheckCircle size={16} className="mr-1" /> Approve
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* Leave Content */}
                <TabsContent value="leave" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {loadingLeave ? (
                        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="h-20 skeleton" />)}</div>
                    ) : filteredLeave.length === 0 ? (
                        <Card><CardContent className="p-12 text-center text-muted-foreground">No leave requests found ✓</CardContent></Card>
                    ) : (
                        filteredLeave.map((lr: any) => (
                            <Card key={lr.request_id}>
                                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-info-light flex items-center justify-center text-info">
                                            <Palmtree size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{lr.Employee ? `${lr.Employee.first_name} ${lr.Employee.last_name}` : "Unknown"}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {lr.LeaveType?.name || "Leave"} · {new Date(lr.start_date).toLocaleDateString("en-AU")} - {new Date(lr.end_date).toLocaleDateString("en-AU")} ({lr.total_hours}h)
                                            </p>
                                            {lr.reason && <p className="text-xs italic text-muted-foreground mt-1">"{lr.reason}"</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={lr.status} />
                                        {lr.status === "pending" && (
                                            <>
                                                <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleRejectTrigger(lr.request_id, "leave")}>
                                                    <XCircle size={16} className="mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" variant="success" onClick={() => leaveMutation.mutate({ id: lr.request_id, status: "approved" })}>
                                                    <CheckCircle size={16} className="mr-1" /> Approve
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* Swaps Content */}
                <TabsContent value="swaps" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {loadingSwaps ? (
                        <div className="space-y-3">{[1, 2, 3].map(i => <Card key={i} className="h-20 skeleton" />)}</div>
                    ) : filteredSwaps.length === 0 ? (
                        <Card><CardContent className="p-12 text-center text-muted-foreground">No shift swaps found ✓</CardContent></Card>
                    ) : (
                        filteredSwaps.map((swap: any) => (
                            <Card key={swap.request_id} className={cn(swap.status === "pending_approval" && "border-warning bg-warning-light")}>
                                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-warning-light flex items-center justify-center text-warning">
                                            <ArrowLeftRight size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold">
                                                {swap.Requester?.first_name} {swap.Requester?.last_name} ↔️ {swap.TargetEmployee?.first_name} {swap.TargetEmployee?.last_name || "Anyone"}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(swap.Shift?.start_time).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} ·
                                                {new Date(swap.Shift?.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })} -
                                                {new Date(swap.Shift?.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={swap.status} />
                                        {swap.status === "pending_approval" && (
                                            <>
                                                <Button variant="outline" size="sm" className="bg-white text-danger" onClick={() => handleRejectTrigger(swap.request_id, "swap")}>
                                                    <XCircle size={16} className="mr-1" /> Reject
                                                </Button>
                                                <Button size="sm" variant="success" onClick={() => swapMutation.mutate({ id: swap.request_id, action: "approve" })}>
                                                    <CheckCircle size={16} className="mr-1" /> Approve
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* Rejection Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Request</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to reject this {rejectTarget?.type} request? Please provide a reason if necessary.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Reason for rejection (optional)"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(""); }}>Cancel</Button>
                        <Button
                            variant="danger"
                            onClick={confirmReject}
                            loading={timesheetMutation.isPending || leaveMutation.isPending || swapMutation.isPending}
                        >
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
