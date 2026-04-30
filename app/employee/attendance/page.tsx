"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import {
    Card, CardContent, Button, StatusBadge,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
    Input, Label, Textarea
} from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Clock, Plus, History, Calendar as CalendarIcon, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidator } from "@/hooks/use-realtime-invalidator";

export default function EmployeeAttendancePage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        clock_in: "09:00",
        clock_out: "17:00",
        break_duration: "30",
        reason: ""
    });

    // Queries
    const { data: logs = [], isLoading: loadingLogs } = useQuery({
        queryKey: ["my-attendance-logs"],
        queryFn: () => apiGet<any>("/attendance/me").then(res => res.logs || []),
    });

    const { data: requests = [], isLoading: loadingRequests } = useQuery({
        queryKey: ["my-attendance-requests"],
        queryFn: () => apiGet<any[]>("/attendance/requests"),
    });

    // Real-time invalidation
    const realtimeConfigs = useMemo(() => [
        { table: 'AttendanceLog', queryKeys: [['my-attendance-logs']] },
        { table: 'AttendanceRequest', queryKeys: [['my-attendance-requests']] }
    ], []);
    useRealtimeInvalidator(realtimeConfigs);

    // Mutations
    const requestMutation = useMutation({
        mutationFn: (data: any) => {
            // Convert time strings to ISO timestamps on the selected date
            const baseDate = data.date;
            const clockIn = `${baseDate}T${data.clock_in}:00`;
            const clockOut = `${baseDate}T${data.clock_out}:00`;

            return apiPost("/attendance/requests", {
                date: baseDate,
                clock_in: new Date(clockIn).toISOString(),
                clock_out: new Date(clockOut).toISOString(),
                break_duration: parseInt(data.break_duration),
                reason: data.reason
            });
        },
        onSuccess: () => {
            toast.success("Manual attendance request submitted!");
            setRequestDialogOpen(false);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                clock_in: "09:00",
                clock_out: "17:00",
                break_duration: "30",
                reason: ""
            });
            queryClient.invalidateQueries({ queryKey: ["my-attendance-requests"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        requestMutation.mutate(formData);
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="Attendance History"
            pageDescription="View your logs and request manual entries"
            actions={
                <Button onClick={() => setRequestDialogOpen(true)} className="gap-2">
                    <Plus size={16} /> Request Manual Entry
                </Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Requests Section */}
                <div className="lg:col-span-1 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <AlertCircle size={20} className="text-[hsl(var(--brand))]" />
                        Pending Requests
                    </h2>
                    
                    {loadingRequests ? (
                        <div className="space-y-3">{[1, 2].map(i => <Card key={i} className="h-24 skeleton" />)}</div>
                    ) : requests.filter((r: any) => r.status === 'pending').length === 0 ? (
                        <Card className="bg-[hsl(var(--muted))]/10 border-dashed">
                            <CardContent className="p-8 text-center text-[hsl(var(--muted-foreground))]">
                                No pending requests
                            </CardContent>
                        </Card>
                    ) : (
                        requests.filter((r: any) => r.status === 'pending').map((req: any) => (
                            <Card key={req.request_id} className="overflow-hidden border-l-4 border-l-warning">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-sm">{new Date(req.date).toLocaleDateString("en-AU", { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                        <StatusBadge status="pending" />
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                                        {new Date(req.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(req.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </p>
                                    {req.reason && <p className="text-[10px] italic line-clamp-1">"{req.reason}"</p>}
                                </CardContent>
                            </Card>
                        ))
                    )}

                    {/* Processed Requests */}
                    {requests.filter((r: any) => r.status !== 'pending').length > 0 && (
                        <>
                            <h2 className="text-lg font-semibold pt-4">Recent Decisions</h2>
                            <div className="space-y-3">
                                {requests.filter((r: any) => r.status !== 'pending').slice(0, 3).map((req: any) => (
                                    <Card key={req.request_id} className={cn("opacity-80", req.status === 'approved' ? "border-l-4 border-l-success" : "border-l-4 border-l-danger")}>
                                        <CardContent className="p-3">
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs font-semibold">{new Date(req.date).toLocaleDateString("en-AU")}</p>
                                                <StatusBadge status={req.status} />
                                            </div>
                                            {req.manager_note && <p className="text-[10px] mt-1 text-[hsl(var(--muted-foreground))]">Note: {req.manager_note}</p>}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Logs Section */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <History size={20} className="text-[hsl(var(--brand))]" />
                        Attendance Logs
                    </h2>

                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date</th>
                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Event</th>
                                        <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Time</th>
                                        <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">Source</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[hsl(var(--border))]">
                                    {loadingLogs ? (
                                        [1, 2, 3, 4, 5].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={4} className="px-4 py-4"><div className="h-4 bg-[hsl(var(--muted))] rounded w-full" /></td>
                                            </tr>
                                        ))
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-[hsl(var(--muted-foreground))] italic">
                                                No attendance logs found.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log: any) => (
                                            <tr key={log.log_id} className="hover:bg-[hsl(var(--muted))]/5 transition-colors">
                                                <td className="px-4 py-3 font-medium">
                                                    {new Date(log.timestamp).toLocaleDateString("en-AU", { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                        log.event_type === 'CLOCK_IN' ? "bg-success-light text-success" : 
                                                        log.event_type === 'CLOCK_OUT' ? "bg-danger-light text-danger" : "bg-info-light text-info"
                                                    )}>
                                                        {log.event_type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 tabular-nums font-semibold">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs text-[hsl(var(--muted-foreground))]">
                                                    {log.override_by ? "Manual (Manager)" : "Device"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Manual Entry Dialog */}
            <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>Request Manual Entry</DialogTitle>
                            <DialogDescription>
                                Fill in the details of your attendance. This will be sent to your manager for approval.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="date" className="text-right">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, date: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="clock_in" className="text-right">Clock In</Label>
                                <Input
                                    id="clock_in"
                                    type="time"
                                    value={formData.clock_in}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, clock_in: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="clock_out" className="text-right">Clock Out</Label>
                                <Input
                                    id="clock_out"
                                    type="time"
                                    value={formData.clock_out}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, clock_out: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="break" className="text-right">Break (min)</Label>
                                <Input
                                    id="break"
                                    type="number"
                                    value={formData.break_duration}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, break_duration: e.target.value })}
                                    className="col-span-3"
                                    min="0"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="reason" className="text-right pt-2">Reason</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Explain why you are entering manually (e.g. forgot to clock in)"
                                    value={formData.reason}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, reason: e.target.value })}
                                    className="col-span-3 min-h-[80px]"
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" loading={requestMutation.isPending}>Submit Request</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
