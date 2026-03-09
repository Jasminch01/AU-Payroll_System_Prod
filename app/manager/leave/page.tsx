"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { apiGet, apiPut, apiPost, apiDelete, apiUpload } from "@/lib/api-client";
import { toast } from "sonner";
import {
    CheckCircle, XCircle, Palmtree, Calendar, Clock, Plus, Upload, Trash2, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveRequest, LeaveType, LeaveBalance } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";

interface LeaveRecord extends LeaveRequest {
    Employee?: { first_name: string; last_name: string } | null;
    LeaveType?: { name: string; is_paid: boolean; requires_doc: boolean } | null;
}

type StatusTab = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
];

export default function ManagerLeavePage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [statusTab, setStatusTab] = useState<StatusTab>("all");

    // Request Leave State
    const [requestOpen, setRequestOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [leaveTypeId, setLeaveTypeId] = useState("");
    const [totalHours, setTotalHours] = useState("");
    const [reason, setReason] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [cancelId, setCancelId] = useState<string | null>(null);

    // Rejection dialog
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Data queries
    const { data: leaveRequests = [], isLoading } = useQuery({
        queryKey: ["leave-requests"],
        queryFn: () => apiGet<LeaveRecord[]>("/leave"),
    });

    const { data: leaveTypes = [] } = useQuery({
        queryKey: ["leave-types"],
        queryFn: () => apiGet<LeaveType[]>("/leave/types"),
    });

    const { data: leaveBalances = [] } = useQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => apiGet<LeaveBalance[]>("/leave/balances"),
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

    const requestMutation = useMutation({
        mutationFn: (data: any) => apiPost("/leave", data),
        onSuccess: () => {
            toast.success("Leave request submitted!");
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
            setRequestOpen(false);
            resetRequestForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/leave/${id}`),
        onSuccess: () => {
            toast.success("Leave request cancelled");
            queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
            setCancelId(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function resetRequestForm() {
        setStartDate("");
        setEndDate("");
        setLeaveTypeId("");
        setTotalHours("");
        setReason("");
        setFile(null);
        setUploading(false);
    }

    async function handleRequestSubmit() {
        if (!leaveTypeId) return toast.error("Select a leave type");
        if (!startDate || !endDate) return toast.error("Select dates");

        const selectedType = leaveTypes.find(lt => lt.leave_type_id === leaveTypeId);
        if (selectedType?.requires_doc && !file) {
            return toast.error(`A supporting document is required for ${selectedType.name}`);
        }

        let documentUrl = "";
        if (file) {
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append("file", file);
                const uploadRes = await apiUpload<{ url: string }>("/upload/document", formData);
                documentUrl = uploadRes.url;
            } catch (err: any) {
                setUploading(false);
                return toast.error("File upload failed: " + err.message);
            }
            setUploading(false);
        }

        requestMutation.mutate({
            leave_type_id: leaveTypeId,
            start_date: startDate,
            end_date: endDate,
            total_hours: Number(totalHours) || 8, // fallback
            reason: reason || undefined,
            document_url: documentUrl || undefined,
        });
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
            role="manager"
            pageTitle="Leave Management"
            pageDescription="Review and manage employee leave requests"
            actions={
                <Button onClick={() => setRequestOpen(true)}>
                    <Plus size={16} /> Request Leave
                </Button>
            }
        >
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
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                                            {getEmployeeInitials(lr)}
                                        </div>
                                        <div>
                                            <p className="font-medium">
                                                {getEmployeeName(lr)}
                                                {lr.employee_id === user?.employee_id && (
                                                    <Badge variant="secondary" className="ml-2">My Request</Badge>
                                                )}
                                            </p>
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
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {lr.reason && (
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] italic">"{lr.reason}"</p>
                                                )}
                                                {lr.document_url && (
                                                    <a
                                                        href={lr.document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] flex items-center gap-1 text-[hsl(var(--brand))] hover:underline"
                                                    >
                                                        <FileText size={10} /> View Document
                                                    </a>
                                                )}
                                            </div>
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
                                            lr.employee_id === user?.employee_id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] ml-2">
                                                        <Clock size={12} className="inline mr-1 -mt-0.5" />
                                                        Awaiting Owner
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-[hsl(var(--danger))]"
                                                        onClick={() => setCancelId(lr.request_id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            ) : (
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
                                            )
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ===== DIALOGS ===== */}

            {/* Request Leave Dialog */}
            <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request My Time Off</DialogTitle>
                        <DialogDescription>Submit your own leave request for owner review</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Leave Type</label>
                            <select
                                value={leaveTypeId}
                                onChange={(e) => setLeaveTypeId(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                <option value="" disabled>Select leave type</option>
                                {leaveTypes.map((lt) => (
                                    <option key={lt.leave_type_id} value={lt.leave_type_id}>
                                        {lt.name} {lt.is_paid ? "" : "(Unpaid)"}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <Input
                            label="Total Hours"
                            type="number"
                            placeholder="e.g. 8"
                            value={totalHours}
                            onChange={(e) => setTotalHours(e.target.value)}
                        />
                        <Input
                            label="Reason (optional)"
                            placeholder="e.g. Personal appointments"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />

                        {leaveTypes.find(lt => lt.leave_type_id === leaveTypeId)?.requires_doc && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">
                                    Supporting Document
                                    <span className="text-[hsl(var(--danger))] ml-1">*</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="file"
                                            id="manager-leave-doc"
                                            className="sr-only"
                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        />
                                        <label
                                            htmlFor="manager-leave-doc"
                                            className={cn(
                                                "flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--muted))]",
                                                file ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                                            )}
                                        >
                                            <span className="truncate">{file ? file.name : "Choose file..."}</span>
                                            <Upload size={16} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRequestOpen(false); resetRequestForm(); }}>Cancel</Button>
                        <Button
                            onClick={handleRequestSubmit}
                            loading={requestMutation.isPending || uploading}
                        >
                            {uploading ? "Uploading..." : "Submit My Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            {/* Confirm Cancel Dialog */}
            <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Leave Request?</DialogTitle>
                        <DialogDescription>This will delete your leave request. This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelId(null)}>Keep It</Button>
                        <Button
                            variant="danger"
                            loading={cancelMutation.isPending}
                            onClick={() => cancelId && cancelMutation.mutate(cancelId)}
                        >
                            Yes, Cancel Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
