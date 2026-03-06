"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

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

function formatDate(d: Date) { return d.toISOString().split("T")[0]; }

export default function ManagerRosterPage() {
    const [weekOffset, setWeekOffset] = useState(0);
    const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[6]);

    const { data: employees = [] } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<any[]>("/employees"),
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ["shifts", weekStart, weekEnd],
        queryFn: () => apiGet<any[]>("/shift", { from: weekStart, to: weekEnd }),
    });

    const shiftGrid = useMemo(() => {
        const grid: Record<string, Record<string, any[]>> = {};
        for (const s of shifts) {
            const empId = s.employee_id;
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
            role="manager"
            pageTitle="Team Roster"
            pageDescription={`Week of ${weekDates[0].toLocaleDateString("en-AU", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}`}
        >
            <div className="flex items-center gap-2 mb-6">
                <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
                    <ChevronLeft size={18} />
                </Button>
                <Button variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
                    <ChevronRight size={18} />
                </Button>
            </div>

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
                                        <th key={i} className={`px-3 py-3 text-center font-medium min-w-28 ${isToday ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                                            <div className="text-xs">{DAYS[i]}</div>
                                            <div className="text-sm font-semibold">{d.getDate()}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {activeEmployees.map((emp: any) => (
                                <tr key={emp.employee_id} className="border-b border-[hsl(var(--border))]">
                                    <td className="sticky left-0 z-10 bg-[hsl(var(--card))] px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-xs font-bold">
                                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                                            </div>
                                            <span className="font-medium text-sm truncate">{emp.first_name} {emp.last_name}</span>
                                        </div>
                                    </td>
                                    {weekDates.map((d, i) => {
                                        const dayShifts = shiftGrid[emp.employee_id]?.[formatDate(d)] || [];
                                        return (
                                            <td key={i} className="px-2 py-2 text-center">
                                                {dayShifts.map((s: any, si: number) => (
                                                    <div key={si} className="rounded-lg bg-[hsl(var(--brand-light))] border border-[hsl(var(--brand))]/20 px-2 py-1 text-xs text-[hsl(var(--brand))] font-medium mb-1">
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
