"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";
import { ShieldCheck } from "lucide-react";

export default function OwnerAuditPage() {
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["audit-log"],
        queryFn: () => apiGet<any[]>("/audit-log"),
    });

    return (
        <DashboardLayout role="owner" pageTitle="Audit Log" pageDescription="Track all system changes">
            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
                </div>
            ) : (
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Time</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Action</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Table</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Record ID</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Changed By</th>
                                    <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <ShieldCheck size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                                            <p className="text-[hsl(var(--muted-foreground))]">No audit records yet</p>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log: any) => (
                                        <tr key={log.audit_id || log.log_id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors">
                                            <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                                {new Date(log.changed_at).toLocaleString("en-AU")}
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={log.action?.toLowerCase()} /></td>
                                            <td className="px-4 py-3 font-medium">{log.table_name}</td>
                                            <td className="px-4 py-3 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                                                {log.record_id?.slice(0, 12)}...
                                            </td>
                                            <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{log.changed_by || "—"}</td>
                                            <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{log.reason || "—"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
