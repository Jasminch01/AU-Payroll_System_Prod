"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiDelete, apiUpload } from "@/lib/api-client";
import { toast } from "sonner";
import { Palmtree, Plus, Calendar, Trash2, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveType, LeaveBalance } from "@/types/database";

interface LeaveBalanceWithType extends LeaveBalance {
    LeaveType?: { name: string; is_paid: boolean } | null;
}

export default function EmployeeLeavePage() {
    const queryClient = useQueryClient();
    const [requestOpen, setRequestOpen] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [leaveTypeId, setLeaveTypeId] = useState("");
    const [totalHours, setTotalHours] = useState("");
    const [reason, setReason] = useState("");
    const [cancelId, setCancelId] = useState<string | null>(null);

    const { data: leaveRequests = [], isLoading } = useQuery({
        queryKey: ["my-leave"],
        queryFn: () => apiGet<any[]>("/leave"),
    });

    const { data: leaveBalances = [] } = useQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => apiGet<LeaveBalanceWithType[]>("/leave/balances"),
    });

    const { data: leaveTypes = [] } = useQuery({
        queryKey: ["leave-types"],
        queryFn: () => apiGet<LeaveType[]>("/leave/types"),
    });

    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Auto-select first leave type
    const selectedTypeId = leaveTypeId || leaveTypes[0]?.leave_type_id || "";

    // Find full leave type object
    const selectedType = leaveTypes.find(lt => lt.leave_type_id === selectedTypeId);

    // Calculate hours from date range (8h per weekday)
    const estimatedHours = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        let hours = 0;
        const d = new Date(start);
        while (d <= end) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) hours += 8; // skip weekends
            d.setDate(d.getDate() + 1);
        }
        return hours;
    }, [startDate, endDate]);

    const requestMutation = useMutation({
        mutationFn: (data: any) => apiPost("/leave", data),
        onSuccess: () => {
            toast.success("Leave request submitted!");
            queryClient.invalidateQueries({ queryKey: ["my-leave"] });
            queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
            setRequestOpen(false);
            resetForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/leave/${id}`),
        onSuccess: () => {
            toast.success("Leave request cancelled");
            queryClient.invalidateQueries({ queryKey: ["my-leave"] });
            queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
            setCancelId(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    function resetForm() {
        setStartDate("");
        setEndDate("");
        setLeaveTypeId("");
        setTotalHours("");
        setReason("");
        setFile(null);
        setUploading(false);
    }

    async function handleSubmit() {
        if (!selectedTypeId) return toast.error("Select a leave type");
        if (!startDate || !endDate) return toast.error("Select dates");
        const hours = totalHours ? Number(totalHours) : estimatedHours;
        if (!hours || hours <= 0) return toast.error("Enter valid hours");

        // Enforce document if required
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
            leave_type_id: selectedTypeId,
            start_date: startDate,
            end_date: endDate,
            total_hours: hours,
            reason: reason || undefined,
            document_url: documentUrl || undefined,
        });
    }

    // Find leave type name for each balance
    const getBalanceRemaining = (b: LeaveBalanceWithType) => {
        return Math.max(0, (b.accrued_hours || 0) - (b.taken_hours || 0));
    };

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
                {leaveBalances.length === 0 ? (
                    <Card className="col-span-full animate-slide-up">
                        <CardContent className="p-5 text-center text-[hsl(var(--muted-foreground))]">
                            No leave balances set up yet
                        </CardContent>
                    </Card>
                ) : (
                    leaveBalances.map((lb) => {
                        const remaining = getBalanceRemaining(lb);
                        const total = lb.accrued_hours || 0;
                        const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
                        return (
                            <Card key={lb.balance_id} className="animate-slide-up">
                                <CardContent className="p-5 text-center">
                                    <p className="text-3xl font-bold text-[hsl(var(--brand))]">{remaining}h</p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                        {lb.LeaveType?.name || "Leave"}
                                    </p>
                                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                                        {lb.taken_hours || 0}h used · {total}h accrued
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))] mt-3">
                                        <div
                                            className="h-full rounded-full bg-[hsl(var(--brand))] transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
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
                                            <p className="font-medium capitalize">
                                                {lr.LeaveType?.name || lr.leave_type || "Leave"}
                                            </p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {new Date(lr.start_date).toLocaleDateString("en-AU")} – {new Date(lr.end_date).toLocaleDateString("en-AU")}
                                                {" · "}{lr.total_hours}h
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
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[hsl(var(--danger))]"
                                                onClick={() => setCancelId(lr.request_id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
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
                        <DialogDescription>Submit a new leave request for review</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Leave Type</label>
                            <select
                                value={selectedTypeId}
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
                            placeholder={estimatedHours ? `Estimated: ${estimatedHours}h` : "e.g. 40"}
                            value={totalHours}
                            onChange={(e) => setTotalHours(e.target.value)}
                            hint={estimatedHours ? `Auto-estimated ${estimatedHours}h (8h × weekdays)` : undefined}
                        />
                        <Input
                            label="Reason (optional)"
                            placeholder="e.g. Family holiday"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />

                        {selectedType?.requires_doc && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">
                                    Supporting Document
                                    <span className="text-[hsl(var(--danger))] ml-1">*</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="file"
                                            id="leave-doc"
                                            className="sr-only"
                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        />
                                        <label
                                            htmlFor="leave-doc"
                                            className={cn(
                                                "flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--muted))]",
                                                file ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                                            )}
                                        >
                                            <span className="truncate">{file ? file.name : "Choose file..."}</span>
                                            <Upload size={16} />
                                        </label>
                                    </div>
                                    {file && (
                                        <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-10">
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                    A medical certificate or proof is required for this leave type. Max 5MB (JPG, PNG, PDF).
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRequestOpen(false); resetForm(); }}>Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={requestMutation.isPending || uploading}
                        >
                            {uploading ? "Uploading..." : "Submit Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Cancel Dialog */}
            <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Leave Request?</DialogTitle>
                        <DialogDescription>This will delete your pending leave request. This action cannot be undone.</DialogDescription>
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
