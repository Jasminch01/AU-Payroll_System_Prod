"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, Loader2, Info, ArrowLeft } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import Link from "next/link";

export default function PublicHolidaysPage() {
    const queryClient = useQueryClient();
    const [addOpen, setAddOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDate, setNewDate] = useState("");
    const [newState, setNewState] = useState("");

    const { data: holidays = [], isLoading } = useQuery({
        queryKey: ["public-holidays"],
        queryFn: () => apiGet<any[]>("/holidays"),
    });

    const addMutation = useMutation({
        mutationFn: (data: any) => apiPost("/holidays", data),
        onSuccess: () => {
            toast.success("Public holiday added");
            queryClient.invalidateQueries({ queryKey: ["public-holidays"] });
            setAddOpen(false);
            setNewName("");
            setNewDate("");
            setNewState("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/holidays/${id}`),
        onSuccess: () => {
            toast.success("Public holiday removed");
            queryClient.invalidateQueries({ queryKey: ["public-holidays"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleAdd = () => {
        if (!newName || !newDate || !newState) {
            toast.error("Please fill all fields");
            return;
        }
        addMutation.mutate({
            name: newName,
            date: newDate,
            state: newState.toUpperCase(),
            is_national: newState.toUpperCase() === "NATIONAL",
        });
    };

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Public Holidays"
            pageDescription="Manage holidays for payroll calculations"
        >
            <div className="space-y-6">
                <Link href="/owner/settings" className="inline-flex items-center text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] gap-1">
                    <ArrowLeft size={14} /> Back to Settings
                </Link>

                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Holiday Calendar</h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Automatically pulled and manually managed holidays</p>
                    </div>
                    <Button onClick={() => setAddOpen(true)} className="gap-2">
                        <Plus size={16} /> Add Custom Holiday
                    </Button>
                </div>

                <div className="bg-[hsl(var(--info-light))] border border-[hsl(var(--info))]/20 rounded-xl p-4 flex gap-3 text-sm text-[hsl(var(--info-foreground))]">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">How it works</p>
                        <p>Most holidays are pulled automatically. You only need to add local regional holidays (like a Show Day) or delete ones that don't apply to your business. The Timesheet Engine uses this list to calculate penalty rates.</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="animate-spin text-[hsl(var(--muted-foreground))]" />
                            </div>
                        ) : holidays.length === 0 ? (
                            <div className="p-12 text-center text-[hsl(var(--muted-foreground))]">
                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No holidays found for this year.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[hsl(var(--border))]">
                                {holidays.map((holiday: any) => (
                                    <div key={holiday.holiday_id} className="flex items-center justify-between p-4 hover:bg-[hsl(var(--muted))]/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-[hsl(var(--brand-light))] flex items-center justify-center text-[hsl(var(--brand))]">
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <p className="font-semibold">{holiday.name}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase font-bold tracking-wider">
                                                    {holiday.date} • {holiday.state === "ALL" || holiday.is_national ? "National" : holiday.state}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {holiday.source === "nager.at" ? (
                                                <span className="text-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full uppercase font-bold">Auto-Synced</span>
                                            ) : (
                                                <span className="text-[10px] bg-[hsl(var(--warning-light))] text-[hsl(var(--warning-foreground))] px-2 py-0.5 rounded-full uppercase font-bold">Manual</span>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger-light))]"
                                                onClick={() => {
                                                    if (confirm(`Remove "${holiday.name}" from your calendar?`)) {
                                                        deleteMutation.mutate(holiday.holiday_id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add Holiday Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Custom Holiday</DialogTitle>
                        <DialogDescription>
                            Add a local or industry-specific holiday to your calendar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            label="Holiday Name"
                            placeholder="e.g. Brisbane Ekka Day"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <Input
                            label="Date"
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                        />
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">State / Region</label>
                            <select
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                value={newState}
                                onChange={(e) => setNewState(e.target.value)}
                            >
                                <option value="">Select Region</option>
                                <option value="NSW">NSW</option>
                                <option value="VIC">VIC</option>
                                <option value="QLD">QLD</option>
                                <option value="WA">WA</option>
                                <option value="SA">SA</option>
                                <option value="TAS">TAS</option>
                                <option value="ACT">ACT</option>
                                <option value="NT">NT</option>
                                <option value="NATIONAL">National (All)</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd} loading={addMutation.isPending}>Add Holiday</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
