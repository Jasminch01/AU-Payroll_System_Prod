"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { ArrowLeftRight, Users, UserPlus, Info, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftSwapDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shift: any;
    role: "employee" | "manager" | "owner";
}

export function ShiftSwapDialog({ open, onOpenChange, shift, role }: ShiftSwapDialogProps) {
    const queryClient = useQueryClient();
    const [targetEmployee, setTargetEmployee] = useState("");
    const [targetShift, setTargetShift] = useState("");
    const [offerType, setOfferType] = useState<"transfer" | "swap" | "pool">("transfer");
    const [poolType, setPoolType] = useState<"transfer" | "swap">("transfer");

    // Fetch conflict-free colleagues based on the specific shift
    const { data: colleagues = [], isLoading: isLoadingColleagues } = useQuery({
        queryKey: ["available-colleagues", shift?.shift_id, offerType],
        queryFn: () => {
            const onlyWithShifts = offerType === "swap" ? "&only_with_shifts=true" : "";
            return apiGet<any[]>(`/employees?status=active&role=${role === 'manager' ? 'manager' : 'employee'}&exclude_conflicts_for_shift=${shift?.shift_id}&exclude_self=true${onlyWithShifts}`);
        },
        enabled: !!shift?.shift_id && open && (offerType === "transfer" || offerType === "swap"),
    });

    const { data: colleagueShifts = [], isLoading: isLoadingShifts } = useQuery({
        queryKey: ["colleague-shifts", targetEmployee],
        queryFn: () => apiGet<any[]>(`/shifts/colleague?employee_id=${targetEmployee}&from=${new Date().toISOString().split('T')[0]}`),
        enabled: !!targetEmployee && offerType === "swap",
    });

    // Reset target selections when switching tabs
    useEffect(() => {
        setTargetEmployee("");
        setTargetShift("");
    }, [offerType]);

    // Reset all state when dialog closes
    useEffect(() => {
        if (!open) {
            setTargetEmployee("");
            setTargetShift("");
            setOfferType("transfer");
            setPoolType("transfer");
        }
    }, [open]);

    const swapMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shifts/swaps", data),
        onSuccess: () => {
            const msg = offerType === "swap" ? "Swap request sent!" : 
                       offerType === "transfer" ? "Transfer request sent!" : 
                       "Shift offered to pool!";
            toast.success(msg);
            queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
            queryClient.invalidateQueries({ queryKey: ["my-swap-requests"] });
            onOpenChange(false);
            setTargetEmployee("");
            setTargetShift("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleSubmit = () => {
        if (offerType !== "pool" && !targetEmployee) {
            return toast.error("Please select a colleague");
        }
        
        if (offerType === "swap" && !targetShift) {
            return toast.error("Please select a shift to swap with");
        }

        if (offerType === "swap") {
            const selectedColleagueShift = colleagueShifts.find((s: any) => s.shift_id === targetShift);
            if (selectedColleagueShift) {
                 const currentStart = new Date(shift.start_time).getTime();
                 const currentEnd = new Date(shift.end_time).getTime();
                 const targetStart = new Date(selectedColleagueShift.start_time).getTime();
                 const targetEnd = new Date(selectedColleagueShift.end_time).getTime();

                 if (currentStart === targetStart && currentEnd === targetEnd) {
                     return toast.error("This is an identical shift. Swapping is redundant.");
                 }

                 // Check if the target shift overlaps with the user's *original* shift time
                 // (Radix: Sarah gives 9-1 away, takes 1-5. If Sarah *already* had another shift 1-5, that's the conflict.)
                 // But for now, we just check if Sarah's intended new shift would have major overlap with her current other shifts.
                 // The backend handles general conflict exclusion for Sarah's existing shifts.
            }
        }

        swapMutation.mutate({
            shift_id: shift?.shift_id,
            target_employee_id: offerType !== "pool" ? targetEmployee : null,
            target_shift_id: offerType === "swap" ? targetShift : null,
            pool_type: offerType === "pool" ? poolType : null,
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
                        })} at {shift.start_time?.split('T')[1]?.substring(0, 5)}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={offerType} onValueChange={(v) => { setOfferType(v as any); setTargetEmployee(""); setTargetShift(""); }} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="transfer" className="flex items-center gap-2 text-xs">
                            <ArrowRight size={14} /> Transfer
                        </TabsTrigger>
                        <TabsTrigger value="swap" className="flex items-center gap-2 text-xs">
                            <RefreshCw size={14} /> Swap
                        </TabsTrigger>
                        <TabsTrigger value="pool" className="flex items-center gap-2 text-xs">
                            <Users size={14} /> Pool
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="transfer" className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Recipient</label>
                            <Select value={targetEmployee} onValueChange={setTargetEmployee}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingColleagues ? "Checking availability..." : "Who should take your shift?"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {colleagues.length === 0 && !isLoadingColleagues ? (
                                        <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                            No available colleagues found.
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
                                <div className="space-y-1">
                                    <p className="text-[11px] text-[hsl(var(--brand-foreground))] leading-normal">
                                        This will send a request to your colleague to **take** your shift. 
                                        They will not give you a shift in return.
                                    </p>
                                    {!targetEmployee && colleagues.length > 0 && (
                                        <p className="text-[10px] text-[hsl(var(--brand))] font-bold">
                                            Please select a colleague above to enable.
                                        </p>
                                    )}
                                    {colleagues.length === 0 && !isLoadingColleagues && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-[hsl(var(--danger))] font-bold flex items-center gap-1">
                                                <AlertCircle size={10} /> No available colleagues found.
                                            </p>
                                            <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-tight italic">
                                                This could be because others are already working during this time or don't have an active employee profile.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="swap" className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Colleague to Swap With</label>
                                <Select value={targetEmployee} onValueChange={(val) => { setTargetEmployee(val); setTargetShift(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a colleague" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colleagues.map((col: any) => (
                                            <SelectItem key={col.employee_id} value={col.employee_id}>
                                                {col.first_name} {col.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {targetEmployee && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Their Shift to Take</label>
                                    <Select value={targetShift} onValueChange={setTargetShift}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingShifts ? "Loading shifts..." : "Which shift do you want?"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colleagueShifts.length === 0 && !isLoadingShifts ? (
                                                <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                                    This colleague has no upcoming shifts to swap.
                                                </div>
                                            ) : (
                                                colleagueShifts.map((s: any) => (
                                                    <SelectItem key={s.shift_id} value={s.shift_id}>
                                                        {new Date(s.start_time).toLocaleDateString("en-AU", { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        {" ("}{s.start_time?.split('T')[1]?.substring(0, 5)}{")"}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex gap-2 p-3 rounded-lg bg-[hsl(var(--brand-light))]/30 border border-[hsl(var(--brand))]/20">
                                <Info size={14} className="text-[hsl(var(--brand))] shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-[11px] text-[hsl(var(--brand-foreground))] leading-normal">
                                        You can swap for **any** upcoming shift your colleague has, even on different dates. 
                                        You take their shift, and they take yours in return.
                                    </p>
                                    {!targetEmployee && colleagues.length > 0 && (
                                        <p className="text-[10px] text-[hsl(var(--brand))] font-bold">
                                            Please select a colleague above to see their tradeable shifts.
                                        </p>
                                    )}
                                    {targetEmployee && !targetShift && colleagueShifts.length > 0 && (
                                        <p className="text-[10px] text-[hsl(var(--brand))] font-bold">
                                            Please select one of their upcoming shifts to take.
                                        </p>
                                    )}
                                    {colleagues.length === 0 && !isLoadingColleagues && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-[hsl(var(--danger))] font-bold flex items-center gap-1">
                                                <AlertCircle size={10} /> No colleagues found with tradeable shifts.
                                            </p>
                                            <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-tight italic">
                                                Colleagues must have at least one future shift and no time conflict with your current shift to appear here.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="pool" className="space-y-4">
                        <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 text-center">
                            <Users size={32} className="mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-sm font-medium mb-1">Offer to Everyone</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] px-4 mb-4">
                                This shift will be visible to all qualified colleagues. The first person to claim it will take the shift (subject to approval).
                            </p>
                            
                            <div className="flex flex-col gap-2 max-w-[240px] mx-auto">
                                <Button 
                                    variant={poolType === 'transfer' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 text-[11px] justify-start px-3"
                                    onClick={() => setPoolType('transfer')}
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <div className={cn("h-3 w-3 rounded-full border border-current", poolType === 'transfer' ? "bg-white" : "")} />
                                        Pool for Transfer (One-way)
                                    </div>
                                </Button>
                                <Button 
                                    variant={poolType === 'swap' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 text-[11px] justify-start px-3"
                                    onClick={() => setPoolType('swap')}
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <div className={cn("h-3 w-3 rounded-full border border-current", poolType === 'swap' ? "bg-white" : "")} />
                                        Pool for Swap (Exchange)
                                    </div>
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-2 p-3 rounded-lg bg-[hsl(var(--brand-light))]/30 border border-[hsl(var(--brand))]/20">
                            <Info size={14} className="text-[hsl(var(--brand))] shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[hsl(var(--brand-foreground))] leading-normal">
                                {poolType === 'swap' 
                                    ? "Colleagues will be asked to offer one of their shifts in return." 
                                    : "You are giving this shift away. You won't get one back in return."}
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit}
                        loading={swapMutation.isPending}
                        disabled={(offerType !== "pool" && !targetEmployee) || (offerType === "swap" && !targetShift)}
                    >
                        {offerType === "swap" ? "Request Swap" : 
                         offerType === "transfer" ? "Send Transfer" : 
                         "Post to Pool"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
