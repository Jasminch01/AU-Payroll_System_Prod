"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPut, apiPost, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { DollarSign, CheckCircle, Send, FileText, Plus, Trash2, CreditCard } from "lucide-react";

export default function OwnerPayrollPage() {
    const queryClient = useQueryClient();
    const [generateOpen, setGenerateOpen] = useState(false);
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");

    // Reset form when dialog closes
    React.useEffect(() => {
        if (!generateOpen) {
            setPeriodStart("");
            setPeriodEnd("");
        }
    }, [generateOpen]);

    const { data: payrolls = [], isLoading } = useQuery({
        queryKey: ["payrolls"],
        queryFn: () => apiGet<any[]>("/payroll"),
    });

    // Generate Payroll
    const generateMutation = useMutation({
        mutationFn: (data: { period_start: string; period_end: string }) =>
            apiPost("/payroll", data),
        onSuccess: () => {
            toast.success("Payroll generated successfully!");
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
            setGenerateOpen(false);
            setPeriodStart("");
            setPeriodEnd("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Approve Payroll
    const approveMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/payroll/${id}`, { status: "approved" }),
        onSuccess: () => {
            toast.success("Payroll approved!");
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Mark as Paid
    const markPaidMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/payroll/${id}`, { status: "paid" }),
        onSuccess: () => {
            toast.success("Payroll marked as paid!");
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Delete Draft
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/payroll/${id}`),
        onSuccess: () => {
            toast.success("Draft payroll deleted");
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Sync to Xero (requires payroll_id)
    const syncXeroMutation = useMutation({
        mutationFn: (payrollId: string) => apiPost("/xero/sync-payroll", { payroll_id: payrollId }),
        onSuccess: () => toast.success("Synced to Xero successfully!"),
        onError: (err: Error) => toast.error(err.message),
    });

    const drafts = payrolls.filter((p: any) => p.status === "draft");
    const approved = payrolls.filter((p: any) => p.status === "approved");
    const paid = payrolls.filter((p: any) => p.status === "paid");

    const handleGenerate = () => {
        if (!periodStart || !periodEnd) {
            toast.error("Please select start and end dates");
            return;
        }
        if (new Date(periodStart) >= new Date(periodEnd)) {
            toast.error("Start date must be before end date");
            return;
        }
        generateMutation.mutate({ period_start: periodStart, period_end: periodEnd });
    };

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Payroll"
            pageDescription="Generate, review, approve, and sync payroll"
            actions={
                <Button onClick={() => setGenerateOpen(true)}>
                    <Plus size={16} /> Generate Payroll
                </Button>
            }
        >
            {/* Draft Payrolls */}
            {drafts.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Draft Payrolls</h2>
                    <div className="space-y-3">
                        {drafts.map((p: any) => (
                            <Card key={p.payroll_id} className="animate-slide-up">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--warning-light))]">
                                                <FileText size={22} className="text-[hsl(var(--warning))]" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">
                                                    {new Date(p.period_start).toLocaleDateString("en-AU")} – {new Date(p.period_end).toLocaleDateString("en-AU")}
                                                </p>
                                                <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                                    <span>Gross: <strong>${p.total_gross?.toLocaleString()}</strong></span>
                                                    <span>Net: <strong>${p.total_net?.toLocaleString()}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={p.status} />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[hsl(var(--danger))]"
                                                onClick={() => {
                                                    if (confirm("Delete this draft payroll?")) {
                                                        deleteMutation.mutate(p.payroll_id);
                                                    }
                                                }}
                                                loading={deleteMutation.isPending}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </Button>
                                            <Button variant="success" onClick={() => approveMutation.mutate(p.payroll_id)} loading={approveMutation.isPending}>
                                                <CheckCircle size={16} /> Approve
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Approved Payrolls (ready for payment/Xero sync) */}
            {approved.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Approved — Ready for Payment</h2>
                    <div className="space-y-3">
                        {approved.map((p: any) => (
                            <Card key={p.payroll_id} className="animate-slide-up">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--success))]/10">
                                                <CheckCircle size={22} className="text-[hsl(var(--success))]" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">
                                                    {new Date(p.period_start).toLocaleDateString("en-AU")} – {new Date(p.period_end).toLocaleDateString("en-AU")}
                                                </p>
                                                <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                                    <span>Gross: <strong>${p.total_gross?.toLocaleString()}</strong></span>
                                                    <span>Net: <strong>${p.total_net?.toLocaleString()}</strong></span>
                                                    {p.approved_at && <span>Approved: {new Date(p.approved_at).toLocaleDateString("en-AU")}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={p.status} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => syncXeroMutation.mutate(p.payroll_id)}
                                                loading={syncXeroMutation.isPending}
                                            >
                                                <Send size={14} /> Sync to Xero
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => markPaidMutation.mutate(p.payroll_id)}
                                                loading={markPaidMutation.isPending}
                                            >
                                                <CreditCard size={14} /> Mark Paid
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Paid History */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Payroll History</h2>
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
                    </div>
                ) : paid.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <DollarSign size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-[hsl(var(--muted-foreground))]">No completed payroll history yet</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]/70 mt-1">Generate payroll from approved timesheets to get started</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Period</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Gross</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Net</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Approved At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paid.map((p: any) => (
                                    <tr key={p.payroll_id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors">
                                        <td className="px-4 py-3 font-medium">
                                            {new Date(p.period_start).toLocaleDateString("en-AU")} – {new Date(p.period_end).toLocaleDateString("en-AU")}
                                        </td>
                                        <td className="px-4 py-3">${p.total_gross?.toLocaleString()}</td>
                                        <td className="px-4 py-3">${p.total_net?.toLocaleString()}</td>
                                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                                            {p.approved_at ? new Date(p.approved_at).toLocaleDateString("en-AU") : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Generate Payroll Dialog */}
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Payroll</DialogTitle>
                        <DialogDescription>
                            Select the pay period to generate payroll from approved timesheets.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input
                            label="Period Start"
                            type="date"
                            value={periodStart}
                            onChange={(e) => setPeriodStart(e.target.value)}
                        />
                        <Input
                            label="Period End"
                            type="date"
                            value={periodEnd}
                            onChange={(e) => setPeriodEnd(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerate} loading={generateMutation.isPending}>
                            <Plus size={16} /> Generate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
