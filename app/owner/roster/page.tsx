"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Clock, User, Trash2 } from "lucide-react";


const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(offset: number): Date[] {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

function formatDate(d: Date) {
    return d.toISOString().split("T")[0];
}

export default function OwnerRosterPage() {
    const queryClient = useQueryClient();
    const [weekOffset, setWeekOffset] = useState(0);
    const [addShiftOpen, setAddShiftOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState("");

    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);


    // Shift form
    const [shiftEmployee, setShiftEmployee] = useState("");
    const [shiftStart, setShiftStart] = useState("09:00");
    const [shiftEnd, setShiftEnd] = useState("17:00");
    const [shiftType, setShiftType] = useState("morning");

    const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[6]);

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    const { data: shifts = [], isLoading } = useQuery({
        queryKey: ["shifts", weekStart, weekEnd],
        queryFn: () => apiGet<any[]>("/shift", { from: weekStart, to: weekEnd }),
    });

    const { data: rosters = [] } = useQuery({
        queryKey: ["rosters"],
        queryFn: () => apiGet<any[]>("/rosters"),
    });

    const createShiftMutation = useMutation({
        mutationFn: (data: any) => apiPost("/shift", data),
        onSuccess: () => {
            toast.success("Shift created");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateShiftMutation = useMutation({
        mutationFn: (data: any) => apiPut(`/shift/${editingShiftId}`, data),
        onSuccess: () => {
            toast.success("Shift updated");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteShiftMutation = useMutation({
        mutationFn: (shiftId: string) => apiDelete(`/shift/${shiftId}`),
        onSuccess: () => {
            toast.success("Shift deleted");
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            setDeleteConfirmOpen(false);
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });



    const publishRosterMutation = useMutation({
        mutationFn: (rosterId: string) => apiPut(`/rosters/${rosterId}`, { status: "published" }),
        onSuccess: () => {
            toast.success("Roster published successfully!");
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleAddShift = () => {
        if (!shiftEmployee || !selectedDate) {
            toast.error("Please select an employee and date");
            return;
        }

        const payload = {
            employee_id: shiftEmployee,
            shift_date: selectedDate,
            start_time: `${selectedDate}T${shiftStart}:00`,
            end_time: `${selectedDate}T${shiftEnd}:00`,
            shift_type: shiftType,
        };

        if (editingShiftId) {
            updateShiftMutation.mutate(payload);
        } else {
            createShiftMutation.mutate(payload);
        }
    };

    const openAddShift = (date: string, empId = "", shift: any = null) => {
        setSelectedDate(date);
        setShiftEmployee(empId);
        
        if (shift) {
            setEditingShiftId(shift.shift_id);
            // Extract HH:mm from ISO
            setShiftStart(new Date(shift.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
            setShiftEnd(new Date(shift.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
            setShiftType(shift.shift_type);
        } else {
            setEditingShiftId(null);
            setShiftStart("09:00");
            setShiftEnd("17:00");
            setShiftType("morning");
        }
        setAddShiftOpen(true);
    };


    // Map shifts to a grid: employee_id -> date -> shifts[]
    const shiftGrid = useMemo(() => {
        const grid: Record<string, Record<string, any[]>> = {};
        for (const s of shifts) {
            const empId = s.employee_id || "unassigned";
            const date = s.shift_date?.split("T")[0] || s.shift_date;
            if (!grid[empId]) grid[empId] = {};
            if (!grid[empId][date]) grid[empId][date] = [];
            grid[empId][date].push(s);
        }
        return grid;
    }, [shifts]);

    const activeEmployees = employees.filter((e: any) => e.status === "active");

    // Find the current week's roster
    const currentRoster = useMemo(() => {
        return rosters.find((r: any) =>
            new Date(r.start_date) <= new Date(weekEnd) &&
            new Date(r.end_date) >= new Date(weekStart)
        );
    }, [rosters, weekStart, weekEnd]);

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Roster"
            pageDescription={`Week of ${weekDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`}
            actions={
                <Button onClick={() => openAddShift(formatDate(new Date()))}>
                    <Plus size={16} className="mr-2" /> Add Shift
                </Button>

            }
        >
            {/* Week Navigation & Roster Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
                        <ChevronLeft size={18} />
                    </Button>
                    <Button variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
                        <ChevronRight size={18} />
                    </Button>
                </div>

                {currentRoster && (
                    <div className="flex items-center gap-3">
                        <StatusBadge status={currentRoster.status} />
                        {currentRoster.status === 'draft' && shifts.length > 0 && (
                            <Button
                                variant="default"
                                className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90"
                                onClick={() => publishRosterMutation.mutate(currentRoster.roster_id)}
                                loading={publishRosterMutation.isPending}
                            >
                                Publish Roster
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Roster Grid */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                <th className="sticky left-0 z-10 bg-[hsl(var(--muted))] px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))] w-48 min-w-48">
                                    Employee
                                </th>
                                {weekDates.map((d, i) => {
                                    const isToday = formatDate(d) === formatDate(new Date());
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dMidnight = new Date(d);
                                    dMidnight.setHours(0, 0, 0, 0);
                                    const isPast = dMidnight < today;

                                    return (
                                        <th
                                            key={i}
                                            className={`px-3 py-4 text-center font-semibold min-w-32 border-l border-[hsl(var(--border))] first:border-l-0 ${isToday ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/30" : (isPast ? "text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30" : "text-[hsl(var(--muted-foreground)))]")}
                                                 `}

                                        >
                                            <div className="text-xs">{DAYS[i]}</div>
                                            <div className="text-sm font-semibold">{d.getDate()}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {activeEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))]">
                                        No active employees. Invite your team to get started.
                                    </td>
                                </tr>
                            ) : (
                                activeEmployees.map((emp: any) => (
                                    <tr key={emp.employee_id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors">
                                        <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold">
                                                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                </div>
                                                <span className="font-medium text-sm truncate">{emp.first_name} {emp.last_name}</span>
                                            </div>
                                        </td>
                                        {weekDates.map((d, i) => {
                                            const dateStr = formatDate(d);
                                            const dayShifts = shiftGrid[emp.employee_id]?.[dateStr] || [];

                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            const dMidnight = new Date(d);
                                            dMidnight.setHours(0, 0, 0, 0);
                                            const isPast = dMidnight < today;

                                            return (
                                                <td
                                                    key={i}
                                                    className={`px-3 py-3 text-center transition-colors border-l border-[hsl(var(--border))] first:border-l-0 ${isPast ? "bg-[hsl(var(--muted))]/20 cursor-not-allowed" : "cursor-pointer hover:bg-[hsl(var(--brand-light))]/40"}`}
                                                    onClick={() => {
                                                        if (!isPast) {
                                                            openAddShift(dateStr, emp.employee_id);
                                                        } else {
                                                            toast.error("Cannot add shifts to past dates.");
                                                        }
                                                    }}


                                                >
                                                    {dayShifts.map((s: any, si: number) => (
                                                        <div
                                                            key={si}
                                                            className={`rounded-xl bg-white border border-[hsl(var(--border))] shadow-sm px-3 py-2 text-xs text-[hsl(var(--foreground))] font-semibold mb-2 hover:border-[hsl(var(--brand))] hover:shadow-md transition-all cursor-pointer ${isPast ? "opacity-60 grayscale-[0.5]" : ""}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAddShift(dateStr, emp.employee_id, s);
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-1.5 text-[hsl(var(--brand))] mb-1">
                                                                <Clock size={12} strokeWidth={2.5} />
                                                                <span className="uppercase tracking-wider text-[10px]">{s.shift_type}</span>
                                                            </div>
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                <span>{new Date(s.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                                                <span className="text-[hsl(var(--muted-foreground))] font-normal">to {new Date(s.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                                            </div>
                                                        </div>


                                                    ))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Shift Dialog */}
            <Dialog open={addShiftOpen} onOpenChange={setAddShiftOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingShiftId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
                        <DialogDescription>
                            {editingShiftId ? (
                                new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time)) 
                                ? "This shift has already started and cannot be modified." 
                                : "Modify shift details or remove it"
                            ) : `Assign a shift for ${selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" }) : ""}`}
                        </DialogDescription>


                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Employee</label>
                            <select
                                value={shiftEmployee}
                                onChange={(e) => setShiftEmployee(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                <option value="">Select employee</option>
                                {activeEmployees.map((emp: any) => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.first_name} {emp.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Start Time" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                            <Input label="End Time" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Shift Type</label>
                            <select
                                value={shiftType}
                                onChange={(e) => setShiftType(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            >
                                <option value="morning">Morning</option>
                                <option value="afternoon">Afternoon</option>
                                <option value="evening">Evening</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <div className="flex items-center gap-2">
                            {editingShiftId && (
                                <Button
                                    variant="outline"
                                    disabled={new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time))}
                                    className="text-[hsl(var(--danger))] border-[hsl(var(--danger))]/20 hover:bg-[hsl(var(--danger))]/10 disabled:opacity-30"
                                    onClick={() => setDeleteConfirmOpen(true)}
                                    loading={deleteShiftMutation.isPending}

                                >
                                    <Trash2 size={16} className="mr-2" /> Delete
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setAddShiftOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={handleAddShift} 
                                loading={createShiftMutation.isPending || updateShiftMutation.isPending}
                                disabled={editingShiftId ? (new Date() >= (new Date((shifts.find((s: any) => s.shift_id === editingShiftId) || {}).start_time))) : false}
                            >
                                {editingShiftId ? 'Update Shift' : (
                                    <>
                                        <Plus size={16} className="mr-2" /> Create Shift
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>


                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this shift? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button 
                            variant="default" 
                            className="bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger))]/90"
                            onClick={() => editingShiftId && deleteShiftMutation.mutate(editingShiftId)}
                            loading={deleteShiftMutation.isPending}
                        >
                            Delete Shift
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>

    );
}
