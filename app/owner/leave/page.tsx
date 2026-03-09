"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import {
    CheckCircle, XCircle, Palmtree, Calendar, Clock, Plus,
    Settings2, FileText, ToggleLeft, ToggleRight, Pencil, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveRequest, LeaveType as LeaveTypeRecord } from "@/types/database";

interface LeaveRecord extends LeaveRequest {
    Employee?: { first_name: string; last_name: string } | null;
    LeaveType?: { name: string; is_paid: boolean } | null;
}

type MainTab = "requests" | "types";
type StatusTab = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

export default function OwnerLeavePage() {
    const queryClient = useQueryClient();
    const [mainTab, setMainTab] = useState<MainTab>("requests");
    const [statusTab, setStatusTab] = useState<StatusTab>("all");

    // Rejection dialog
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // New leave type dialog
    const [typeDialogOpen, setTypeDialogOpen] = useState(false);
    const [typeName, setTypeName] = useState("");
    const [typeIsPaid, setTypeIsPaid] = useState(true);
    const [typeAccrualRate, setTypeAccrualRate] = useState("");
    const [typeMaxCarryOver, setTypeMaxCarryOver] = useState("");
    const [typeRequiresDoc, setTypeRequiresDoc] = useState(false);
    const [editTypeTarget, setEditTypeTarget] = useState<LeaveTypeRecord | null>(null);

    // Data queries
    const { data: leaveRequests = [], isLoading } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<LeaveRecord[]>("/leave"),
    });

    const { data: leaveTypes = [], isLoading: typesLoading } = useQuery({
        queryKey: ["leave-types"],
        queryFn: () => apiGet<LeaveTypeRecord[]>("/leave/types"),
    });

    // Mutations
    const approveMutation = useMutation({
        mutationFn: ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) =>
            apiPut(`/leave/${id}`, { status, rejection_reason }),
        onSuccess: (_, vars) => {
            toast.success(`Leave request ${vars.status}`);
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            setRejectTarget(null);
            setRejectionReason("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const createTypeMutation = useMutation({
        mutationFn: (data: any) => apiPost("/leave/types", data),
        onSuccess: () => {
            toast.success("Leave type created & balances initialized!");
            queryClient.invalidateQueries({ queryKey: ["leave-types"] });
            setTypeDialogOpen(false);
            resetTypeForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateTypeMutation = useMutation({
        mutationFn: ({ id, ...data }: any) => apiPut(`/leave/types/${id}`, data),
        onSuccess: () => {
            toast.success("Leave type updated!");
            queryClient.invalidateQueries({ queryKey: ["leave-types"] });
            setTypeDialogOpen(false);
            resetTypeForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteTypeMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/leave/types/${id}`),
        onSuccess: () => {
            toast.success("Leave type deleted");
            queryClient.invalidateQueries({ queryKey: ["leave-types"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function resetTypeForm() {
        setTypeName("");
        setTypeIsPaid(true);
        setTypeAccrualRate("");
        setTypeMaxCarryOver("");
        setTypeRequiresDoc(false);
        setEditTypeTarget(null);
    }

    function handleSaveType() {
        if (!typeName.trim()) return toast.error("Enter a leave type name");
        const payload = {
            name: typeName.trim(),
            is_paid: typeIsPaid,
            accrual_rate: typeAccrualRate ? Number(typeAccrualRate) : undefined,
            max_carry_over: typeMaxCarryOver ? Number(typeMaxCarryOver) : undefined,
            requires_doc: typeRequiresDoc,
        };

        if (editTypeTarget) {
            updateTypeMutation.mutate({ id: editTypeTarget.leave_type_id, ...payload });
        } else {
            createTypeMutation.mutate(payload);
        }
    }

    function openEditType(lt: LeaveTypeRecord) {
        setEditTypeTarget(lt);
        setTypeName(lt.name);
        setTypeIsPaid(lt.is_paid);
        setTypeAccrualRate(lt.accrual_rate?.toString() || "");
        setTypeMaxCarryOver(lt.max_carry_over?.toString() || "");
        setTypeRequiresDoc(lt.requires_doc);
        setTypeDialogOpen(true);
    }

    function handleReject(id: string) {
        setRejectTarget(id);
    }

    function confirmReject() {
        if (!rejectTarget) return;
        approveMutation.mutate({
            id: rejectTarget,
            status: "rejected",
            rejection_reason: rejectionReason || undefined,
        });
    }

    // Filtering
    const filtered = statusTab === "all"
        ? leaveRequests
        : leaveRequests.filter((l) => l.status === statusTab);

    const counts: Record<StatusTab, number> = {
        all: leaveRequests.length,
        pending: leaveRequests.filter((l) => l.status === "pending").length,
        approved: leaveRequests.filter((l) => l.status === "approved").length,
        rejected: leaveRequests.filter((l) => l.status === "rejected").length,
    };

    const totalPendingHours = leaveRequests
        .filter((l) => l.status === "pending")
        .reduce((s, l) => s + (l.total_hours || 0), 0);

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

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Leave Management"
            pageDescription="Review requests and configure leave types"
            actions={
                mainTab === "types" ? (
                    <Button onClick={() => setTypeDialogOpen(true)}>
                        <Plus size={16} /> New Leave Type
                    </Button>
                ) : undefined
            }
        >
            {/* Main Tabs: Requests vs Types */}
            <div className="flex items-center gap-1 mb-6">
                <button
                    onClick={() => setMainTab("requests")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        mainTab === "requests"
                            ? "bg-[hsl(var(--brand))] text-white shadow-sm"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    )}
                >
                    <Calendar size={16} /> Leave Requests
                </button>
                <button
                    onClick={() => setMainTab("types")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        mainTab === "types"
                            ? "bg-[hsl(var(--brand))] text-white shadow-sm"
                            : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    )}
                >
                    <Settings2 size={16} /> Leave Types
                </button>
            </div>

            {mainTab === "requests" && (
                <>
                    {/* Summary Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                        <MetricCard title="Total Requests" value={leaveRequests.length} icon={<Calendar size={24} />} />
                        <MetricCard title="Pending" value={counts.pending} icon={<Clock size={24} />} />
                        <MetricCard title="Pending Hours" value={`${totalPendingHours}h`} icon={<Palmtree size={24} />} />
                        <MetricCard title="Approved" value={counts.approved} icon={<CheckCircle size={24} />} />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] mb-6">
                        {STATUS_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusTab(tab.key)}
                                className={cn(
                                    "relative px-4 py-2.5 text-sm font-medium transition-colors",
                                    statusTab === tab.key
                                        ? "text-[hsl(var(--brand))]"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                {tab.label}
                                <span className={cn(
                                    "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                                    statusTab === tab.key
                                        ? "bg-[hsl(var(--brand))] text-white"
                                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                )}>
                                    {counts[tab.key]}
                                </span>
                                {statusTab === tab.key && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--brand))] rounded-t" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Request List */}
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Palmtree size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                                <p className="text-[hsl(var(--muted-foreground))]">
                                    {statusTab === "all" ? "No leave requests" : `No ${statusTab} leave requests`}
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
                                                    {lr.rejection_reason && (
                                                        <p className="text-xs text-[hsl(var(--danger))] mt-0.5">
                                                            Rejection: {lr.rejection_reason}
                                                        </p>
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
                                                            onClick={() => handleReject(lr.request_id)}
                                                        >
                                                            <XCircle size={16} /> Reject
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="success"
                                                            onClick={() => approveMutation.mutate({ id: lr.request_id, status: "approved" })}
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
                </>
            )}

            {/* Leave Types Tab */}
            {mainTab === "types" && (
                <>
                    {typesLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                        </div>
                    ) : leaveTypes.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Settings2 size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                                <p className="text-[hsl(var(--muted-foreground))] mb-3">No leave types configured</p>
                                <Button onClick={() => setTypeDialogOpen(true)}>
                                    <Plus size={16} /> Create First Leave Type
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {leaveTypes.map((lt) => (
                                <Card key={lt.leave_type_id} className="animate-slide-up">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-base">{lt.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant={lt.is_paid ? "success" : "warning"}>
                                                        {lt.is_paid ? "Paid" : "Unpaid"}
                                                    </Badge>
                                                    {lt.requires_doc && (
                                                        <Badge variant="secondary">
                                                            <FileText size={10} className="mr-1" /> Docs Required
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                                                <Palmtree size={18} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--brand))]"
                                                onClick={() => openEditType(lt)}
                                            >
                                                <Pencil size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--danger))]"
                                                onClick={() => {
                                                    if (confirm(`Are you sure you want to delete "${lt.name}"? This might affect existing balances.`)) {
                                                        deleteTypeMutation.mutate(lt.leave_type_id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                        <div className="space-y-1.5 text-sm">
                                            {lt.accrual_rate !== null && lt.accrual_rate !== undefined && (
                                                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                                                    <span>Accrual Rate</span>
                                                    <span className="font-medium text-[hsl(var(--foreground))]">
                                                        {lt.accrual_rate} hrs/hr worked
                                                    </span>
                                                </div>
                                            )}
                                            {lt.max_carry_over !== null && lt.max_carry_over !== undefined && (
                                                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                                                    <span>Max Carry-Over</span>
                                                    <span className="font-medium text-[hsl(var(--foreground))]">
                                                        {lt.max_carry_over}h
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Rejection Reason Dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={() => { setRejectTarget(null); setRejectionReason(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                        <DialogDescription>Provide a reason for rejecting this leave request (optional but recommended).</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Input
                            label="Rejection Reason"
                            placeholder="e.g. Insufficient staffing during this period"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(""); }}>Cancel</Button>
                        <Button
                            variant="danger"
                            loading={approveMutation.isPending}
                            onClick={confirmReject}
                        >
                            <XCircle size={16} /> Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Leave Type Dialog */}
            <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editTypeTarget ? "Edit Leave Type" : "Create Leave Type"}</DialogTitle>
                        <DialogDescription>
                            {editTypeTarget
                                ? "Update the configuration for this leave category."
                                : "Define a new leave category. Balances will be auto-created for all active employees."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            label="Leave Type Name"
                            placeholder="e.g. Annual Leave, Sick Leave"
                            value={typeName}
                            onChange={(e) => setTypeName(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Accrual Rate (hrs/hr worked)"
                                type="number"
                                step="0.0001"
                                placeholder="e.g. 0.0769"
                                value={typeAccrualRate}
                                onChange={(e) => setTypeAccrualRate(e.target.value)}
                                hint="AU Annual Leave: ~0.0769"
                            />
                            <Input
                                label="Max Carry-Over (hours)"
                                type="number"
                                placeholder="e.g. 40"
                                value={typeMaxCarryOver}
                                onChange={(e) => setTypeMaxCarryOver(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-6">
                            <button
                                type="button"
                                onClick={() => setTypeIsPaid(!typeIsPaid)}
                                className="flex items-center gap-2 text-sm font-medium transition-colors"
                            >
                                {typeIsPaid
                                    ? <ToggleRight size={24} className="text-[hsl(var(--success))]" />
                                    : <ToggleLeft size={24} className="text-[hsl(var(--muted-foreground))]" />
                                }
                                {typeIsPaid ? "Paid Leave" : "Unpaid Leave"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setTypeRequiresDoc(!typeRequiresDoc)}
                                className="flex items-center gap-2 text-sm font-medium transition-colors"
                            >
                                {typeRequiresDoc
                                    ? <ToggleRight size={24} className="text-[hsl(var(--success))]" />
                                    : <ToggleLeft size={24} className="text-[hsl(var(--muted-foreground))]" />
                                }
                                Requires Document
                            </button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setTypeDialogOpen(false); resetTypeForm(); }}>Cancel</Button>
                        <Button
                            loading={createTypeMutation.isPending || updateTypeMutation.isPending}
                            onClick={handleSaveType}
                        >
                            {editTypeTarget ? "Save Changes" : <><Plus size={16} /> Create Leave Type</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
