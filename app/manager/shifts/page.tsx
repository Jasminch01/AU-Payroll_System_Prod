"use client";

import React, { useState, useEffect } from "react";
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
import { CalendarDays, Clock, ArrowLeftRight, Check, X, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import { ShiftSwapDialog } from "@/components/shifts/swap-dialog";
import { createClient } from "@/lib/supabase/client";

export default function ManagerShiftsPage() {
    const queryClient = useQueryClient();
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const { user } = useAuth();

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ["my-shifts"],
        queryFn: () => apiGet<any[]>("/shifts/me"),
    });

    const { data: swapRequests = [] } = useQuery({
        queryKey: ["my-swap-requests"],
        queryFn: () => apiGet<any[]>("/shifts/swaps"),
    });

    // Real-time listener
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('manager-shifts-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Shift'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ShiftSwapRequest'
                },
                (payload) => {
                    console.log('Real-time ShiftSwapRequest change received:', payload);
                    queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
                    queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
                }
            )
            .subscribe((status) => {
                console.log('Supabase real-time subscription status (manager):', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const respondSwapMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" | "cancel" }) =>
            apiPut(`/shifts/swaps/${id}`, { action }),
        onSuccess: (data: any, variables: any) => {
            toast.success(variables.action === 'cancel' ? "Request cancelled!" : "Response recorded!");
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const claimShiftMutation = useMutation({
        mutationFn: (id: string) => apiPut(`/shifts/swaps/${id}`, { action: "accept" }),
        onSuccess: () => {
            toast.success("Shift claimed successfully!");
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

    const openPoolShifts = swapRequests.filter((sr: any) => 
        !sr.target_employee_id && sr.status === 'pending_approval' && sr.requester_id !== user?.employee_id
    );

    const getShiftStatus = (shift: any) => {
        const now = new Date();
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);

        // Check for active swap/transfer requests for THIS shift
        const activeRequest = (swapRequests || []).find((sr: any) => 
            String(sr.shift_id) === String(shift.shift_id) && 
            ['pending_acceptance', 'pending_approval'].includes(sr.status)
        );

        if (activeRequest) {
            if (!activeRequest.target_employee_id) {
                return activeRequest.manager_note === 'swap' ? "pooled_swap" : "pooled_transfer";
            }
            return activeRequest.target_shift_id ? "swap_pending" : "transfer_pending";
        }

        if (end < now) return "completed";
        if (start <= now && end >= now) return "ongoing";
        return "upcoming";
    };

    return (
        <DashboardLayout
            role="manager"
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

            {/* Shift Pool */}
            {openPoolShifts.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Users size={18} className="text-[hsl(var(--brand))]" /> Available to Claim
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {openPoolShifts.map((pool: any) => (
                            <Card key={pool.request_id} className="border-[hsl(var(--brand))]/20 bg-[hsl(var(--brand-light))]/10">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-[hsl(var(--brand))] uppercase tracking-wider mb-1">
                                                {pool.manager_note === 'swap' ? 'Swap Requested' : 'Open Transfer'}
                                            </p>
                                            <p className="font-semibold text-sm">{pool.Requester?.first_name} {pool.Requester?.last_name}</p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--brand-light))] flex items-center justify-center">
                                            <Users size={14} className="text-[hsl(var(--brand))]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                            <CalendarDays size={14} />
                                            {new Date(pool.Shift?.start_time).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                            <Clock size={14} />
                                            {new Date(pool.Shift?.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(pool.Shift?.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <Button 
                                        className="w-full h-8 text-xs bg-[hsl(var(--brand))]" 
                                        onClick={() => claimShiftMutation.mutate(pool.request_id)}
                                        loading={claimShiftMutation.isPending}
                                    >
                                        Claim Shift
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Shifts */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-[hsl(var(--foreground))]">Your Shifts</h2>
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                    </div>
                ) : upcoming.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-8 text-center">
                            <CalendarDays size={40} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-[hsl(var(--muted-foreground))]">No upcoming shifts</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcoming.map((shift: any) => (
                            <Card key={shift.shift_id} className="group hover:border-[hsl(var(--brand))]/30 transition-all duration-200">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                                                <CalendarDays size={22} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">
                                                    {new Date(shift.start_time).toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
                                                </p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1 mt-0.5">
                                                    <Clock size={12} />
                                                    {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {" – "}
                                                    {new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                                 <div className="flex flex-col items-end gap-1.5">
                                                     <StatusBadge status={getShiftStatus(shift)} />
                                                     {(getShiftStatus(shift) === 'upcoming' || ['pooled_swap', 'pooled_transfer', 'swap_pending', 'transfer_pending'].includes(getShiftStatus(shift))) && (
                                                         <Button
                                                             variant="outline"
                                                             size="sm"
                                                             className="h-7 text-[10px] gap-1 px-2 border-[hsl(var(--brand))]/20 text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))]"
                                                             onClick={() => { setSelectedShift(shift); setSwapDialogOpen(true); }}
                                                             disabled={!!(swapRequests || []).find((sr: any) => 
                                                                 String(sr.shift_id) === String(shift.shift_id) && 
                                                                 ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                             )}
                                                         >
                                                             <ArrowLeftRight size={12} /> Shift Actions
                                                         </Button>
                                                     )}
                                                     {/* Cancel/Undo Button for Active Requests (Owned by user) */}
                                                     {(swapRequests || []).find((sr: any) => 
                                                         String(sr.shift_id) === String(shift.shift_id) && 
                                                         String(sr.requester_id) === String(user?.employee_id) &&
                                                         ['pending_acceptance', 'pending_approval'].includes(sr.status)
                                                     ) && (
                                                         <Button
                                                             variant="ghost"
                                                             size="sm"
                                                             className="h-7 text-[10px] text-[hsl(var(--danger))] bg-[hsl(var(--danger-light))]/5 hover:bg-[hsl(var(--danger-light))]/15 border border-[hsl(var(--danger))]/10"
                                                             onClick={() => {
                                                                 const req = (swapRequests || []).find((sr: any) => String(sr.shift_id) === String(shift.shift_id) && ['pending_acceptance', 'pending_approval'].includes(sr.status));
                                                                 if (req) respondSwapMutation.mutate({ id: req.request_id, action: 'cancel' });
                                                             }}
                                                         >
                                                             <X size={12} className="mr-1" /> Undo Request
                                                         </Button>
                                                     )}
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
                <h2 className="text-lg font-semibold mb-4">History</h2>
                <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
                                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Date</th>
                                <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Time</th>
                                <th className="px-4 py-3 text-right font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {past.slice(0, 5).map((shift: any) => (
                                <tr key={shift.shift_id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/10 transition-colors">
                                    <td className="px-4 py-3 font-medium">{new Date(shift.start_time).toLocaleDateString("en-AU")}</td>
                                     <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                                         {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                     </td>
                                     <td className="px-4 py-3 text-right"><StatusBadge status={getShiftStatus(shift)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ShiftSwapDialog 
                open={swapDialogOpen} 
                onOpenChange={setSwapDialogOpen} 
                shift={selectedShift} 
                role="manager"
            />
        </DashboardLayout>
    );
}
