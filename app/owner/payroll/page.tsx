"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { DollarSign, CheckCircle, Send, FileText } from "lucide-react";

export default function OwnerPayrollPage() {
    const queryClient = useQueryClient();

    const { data: payrolls = [], isLoading } = useQuery({
        queryKey: ["payrolls"],
        queryFn: () => apiGet<any[]>("/payroll"),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/payroll/${id}`, { status: "approved" }),
        onSuccess: () => {
            toast.success("Payroll approved!");
            queryClient.invalidateQueries({ queryKey: ["payrolls"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const syncXeroMutation = useMutation({
        mutationFn: () => apiPost("/xero/sync-payroll"),
        onSuccess: () => toast.success("Synced to Xero successfully!"),
        onError: (err: Error) => toast.error(err.message),
    });

    const drafts = payrolls.filter((p: any) => p.status === "draft");
    const approved = payrolls.filter((p: any) => p.status === "approved");
    const paid = payrolls.filter((p: any) => p.status === "paid");

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Payroll"
            pageDescription="Review, approve, and sync payroll"
            actions={
                <Button variant="outline" onClick={() => syncXeroMutation.mutate()} loading={syncXeroMutation.isPending}>
                    <Send size={16} /> Sync to Xero
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

            {/* Approved & Paid */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Payroll History</h2>
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
                            {[...approved, ...paid].map((p: any) => (
                                <tr key={p.payroll_id} className="border-b border-[hsl(var(--border))]">
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
            </div>
        </DashboardLayout>
    );
}
