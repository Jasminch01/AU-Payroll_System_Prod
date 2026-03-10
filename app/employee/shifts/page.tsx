"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { CalendarDays, Clock, ArrowLeftRight, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeShiftsPage() {
    const queryClient = useQueryClient();
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [targetEmployee, setTargetEmployee] = useState("");
    const { user } = useAuth();

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
    });

    const { data: swapRequests = [] } = useQuery({
        queryKey: ["my-swap-requests"],
        queryFn: () => apiGet<any[]>("/shifts/swaps"),
    });

    const swapMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shifts/swaps", data),
        onSuccess: () => {
            toast.success("Swap request sent!");
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            setSwapDialogOpen(false);
            setTargetEmployee("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const respondSwapMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
            apiPut(`/shifts/swaps/${id}`, { action }),
        onSuccess: () => {
            toast.success("Swap response recorded!");
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const now = new Date();
    const upcoming = shifts.filter((s: any) => new Date(s.start_time) >= now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const past = shifts.filter((s: any) => new Date(s.start_time) < now)
        .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const pendingIncomingSwaps = swapRequests.filter((sr: any) =>
        sr.target_employee_id === user?.employee_id && sr.status === 'pending_acceptance'
    );

    return (
        <DashboardLayout
            role="employee"
            pageTitle="My Shifts"
            pageDescription={`${upcoming.length} upcoming shifts`}
        >
            {/* Incoming Swap Requests */}
            {pendingIncomingSwaps.length > 0 && (
                <div className="mb-8 p-4 bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning))] rounded-xl">
                    <h2 className="text-lg font-semibold text-[hsl(var(--warning-foreground))] mb-3 flex items-center gap-2">
                        <ArrowLeftRight size={18} /> Shift Swap Invitations
                    </h2>
                    <div className="space-y-3">
                        {pendingIncomingSwaps.map((sr: any) => (
                            <div key={sr.request_id} className="bg-white rounded-lg p-3 flex flex-wrap gap-4 items-center justify-between shadow-sm">
                                <div>
                                    <p className="font-medium text-sm">
                                        <span className="font-bold">{sr.Requester?.first_name} {sr.Requester?.last_name}</span> wants to swap their shift:
                                    </p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {new Date(sr.Shift?.start_time).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
                                        {" · "}
                                        {new Date(sr.Shift?.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                        {" – "}
                                        {new Date(sr.Shift?.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" className="text-[hsl(var(--danger))]" onClick={() => respondSwapMutation.mutate({ id: sr.request_id, action: "decline" })}>
                                        <X size={14} className="mr-1" /> Decline
                                    </Button>
                                    <Button size="sm" variant="success" onClick={() => respondSwapMutation.mutate({ id: sr.request_id, action: "accept" })}>
                                        <Check size={14} className="mr-1" /> Accept
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Shifts */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                    </div>
                ) : upcoming.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <CalendarDays size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-[hsl(var(--muted-foreground))]">No upcoming shifts</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {upcoming.map((shift: any) => (
                            <Card key={shift.shift_id} className="animate-slide-up">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))]">
                                                <CalendarDays size={22} className="text-[hsl(var(--brand))]" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">
                                                    {new Date(shift.start_time).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
                                                </p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {new Date(shift.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                                    {" – "}
                                                    {new Date(shift.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={shift.status || "confirmed"} />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setSelectedShift(shift); setSwapDialogOpen(true); }}
                                            >
                                                <ArrowLeftRight size={14} /> Swap
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Past Shifts */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Past Shifts</h2>
                <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date</th>
                                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Time</th>
                                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {past.slice(0, 10).map((shift: any) => (
                                <tr key={shift.shift_id} className="border-b border-[hsl(var(--border))]">
                                    <td className="px-4 py-3 font-medium">{new Date(shift.start_time).toLocaleDateString("en-AU")}</td>
                                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                                        {new Date(shift.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                        {" – "}
                                        {new Date(shift.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={shift.status || "completed"} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Swap Request Dialog */}
            <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Shift Swap</DialogTitle>
                        <DialogDescription>
                            Request to swap your shift on{" "}
                            {selectedShift && new Date(selectedShift.start_time).toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Target Employee ID</label>
                            <input
                                type="text"
                                placeholder="Enter colleague's employee ID"
                                value={targetEmployee}
                                onChange={(e) => setTargetEmployee(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (!targetEmployee) return toast.error("Enter target employee ID");
                                swapMutation.mutate({
                                    shift_id: selectedShift?.shift_id,
                                    target_employee_id: targetEmployee,
                                });
                            }}
                            loading={swapMutation.isPending}
                        >
                            <ArrowLeftRight size={16} /> Send Swap Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
