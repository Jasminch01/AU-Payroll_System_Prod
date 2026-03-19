"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeftRight, Users, UserPlus, Info } from "lucide-react";

interface ShiftSwapDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shift: any;
    role: "employee" | "manager" | "owner";
}

export function ShiftSwapDialog({ open, onOpenChange, shift, role }: ShiftSwapDialogProps) {
    const queryClient = useQueryClient();
    const [targetEmployee, setTargetEmployee] = useState("");
    const [offerType, setOfferType] = useState<"direct" | "pool">("direct");

    // Fetch conflict-free colleagues based on the specific shift
    const { data: colleagues = [], isLoading: isLoadingColleagues } = useQuery({
        queryKey: ["available-colleagues", shift?.shift_id],
        queryFn: () => apiGet<any[]>(`/employees?status=active&role=${role === 'manager' ? 'manager' : 'employee'}&exclude_conflicts_for_shift=${shift?.shift_id}&exclude_self=true`),
        enabled: !!shift?.shift_id && open && offerType === "direct",
    });

    const swapMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shifts/swaps", data),
        onSuccess: () => {
            toast.success(offerType === "direct" ? "Swap request sent!" : "Shift offered to pool!");
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            onOpenChange(false);
            setTargetEmployee("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleSubmit = () => {
        if (offerType === "direct" && !targetEmployee) {
            return toast.error("Please select a colleague");
        }

        swapMutation.mutate({
            shift_id: shift?.shift_id,
            target_employee_id: offerType === "direct" ? targetEmployee : null,
        });
    };

    if (!shift) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Move Your Shift</DialogTitle>
                    <DialogDescription>
                        {new Date(shift.start_time).toLocaleDateString("en-AU", { 
                            weekday: "long", month: "short", day: "numeric" 
                        })} at {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={offerType} onValueChange={(v) => setOfferType(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="direct" className="flex items-center gap-2">
                            <UserPlus size={14} /> Invite
                        </TabsTrigger>
                        <TabsTrigger value="pool" className="flex items-center gap-2">
                            <Users size={14} /> Open Pool
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="direct" className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Colleague</label>
                            <Select value={targetEmployee} onValueChange={setTargetEmployee}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingColleagues ? "Checking availability..." : "Who would you like to invite?"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {colleagues.length === 0 && !isLoadingColleagues ? (
                                        <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                            No conflict-free colleagues found for this time.
                                        </div>
                                    ) : (
                                        colleagues.map((col: any) => (
                                            <SelectItem key={col.employee_id} value={col.employee_id}>
                                                {col.first_name} {col.last_name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 p-3 rounded-lg bg-[hsl(var(--brand-light))]/30 border border-[hsl(var(--brand))]/20">
                                <Info size={14} className="text-[hsl(var(--brand))] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-[hsl(var(--brand-foreground))] leading-normal">
                                    The list only shows colleagues who have the same role and **no overlapping shifts** during this time.
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="pool" className="space-y-4">
                        <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))/30 text-center">
                            <Users size={32} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-sm font-medium mb-1">Offer to Everyone</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] px-4">
                                This shift will be visible to all qualified colleagues. The first person to claim it will take the shift (subject to approval).
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit}
                        loading={swapMutation.isPending}
                        disabled={offerType === "direct" && !targetEmployee}
                    >
                        {offerType === "direct" ? "Send Invitation" : "Offer to Pool"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
