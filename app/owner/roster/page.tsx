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
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

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
    const [selectedDate, setSelectedDate] = useState("");

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
            setAddShiftOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleAddShift = () => {
        if (!shiftEmployee || !selectedDate) {
            toast.error("Please select an employee and date");
            return;
        }
        createShiftMutation.mutate({
            employee_id: shiftEmployee,
            shift_date: selectedDate,
            start_time: `${selectedDate}T${shiftStart}:00`,
            end_time: `${selectedDate}T${shiftEnd}:00`,
            shift_type: shiftType,
        });
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

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Roster"
            pageDescription={`Week of ${weekDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`}
            actions={
                <Button onClick={() => { setSelectedDate(formatDate(new Date())); setAddShiftOpen(true); }}>
                    <Plus size={16} /> Add Shift
                </Button>
            }
        >
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
                        <ChevronLeft size={18} />
                    </Button>
                    <Button variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>
                    <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
                        <ChevronRight size={18} />
                    </Button>
                </div>
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
                                    return (
                                        <th
                                            key={i}
                                            className={`px-3 py-3 text-center font-medium min-w-28 ${isToday ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]" : "text-[hsl(var(--muted-foreground))]"
                                                }`}
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
                                            return (
                                                <td
                                                    key={i}
                                                    className="px-2 py-2 text-center cursor-pointer hover:bg-[hsl(var(--brand-light))]/50 transition-colors"
                                                    onClick={() => { setSelectedDate(dateStr); setShiftEmployee(emp.employee_id); setAddShiftOpen(true); }}
                                                >
                                                    {dayShifts.map((s: any, si: number) => (
                                                        <div
                                                            key={si}
                                                            className="rounded-lg bg-[hsl(var(--brand-light))] border border-[hsl(var(--brand))]/20 px-2 py-1 text-xs text-[hsl(var(--brand))] font-medium mb-1"
                                                        >
                                                            <Clock size={10} className="inline mr-1" />
                                                            {new Date(s.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                                            {" – "}
                                                            {new Date(s.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
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
                        <DialogTitle>Add Shift</DialogTitle>
                        <DialogDescription>
                            Assign a shift for {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" }) : ""}
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
                                <option value="night">Night</option>
                                <option value="split">Split</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddShiftOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddShift} loading={createShiftMutation.isPending}>
                            <Plus size={16} /> Create Shift
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
