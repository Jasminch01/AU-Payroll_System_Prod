"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import { Clock, AlertCircle, Edit3, Timer } from "lucide-react";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { StatusBadge } from "@/components/ui/badge";
import { AttendanceRequestModal } from "@/components/attendance/attendance-request-modal";

function formatDuration(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) return "0h 0m";
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function EmployeeAttendancePage() {
    const { businessTimezone } = useBusinessTimezone();
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<any>(null);

    // Fetch employee's own attendance sessions (Last 7 days by default)
    const { data: attendanceData, isLoading } = useQuery({
        queryKey: ["my-attendance-sessions"],
        queryFn: async () => {
            const today = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);

            const from = sevenDaysAgo.toISOString().split('T')[0];
            const to = today.toISOString().split('T')[0];

            const res = await apiGet<any>(`/attendance/me?from=${from}&to=${to}`);
            return res;
        }
    });

    // Fetch employee's own edit requests
    const { data: editRequests } = useQuery({
        queryKey: ["attendance-requests-me"],
        queryFn: () => apiGet<any[]>("/api/notifications?type=attendance_request") // Placeholder if we use notifications or a specific route
    });

    const sessions = attendanceData?.sessions || [];

    const handleRequestEdit = (session?: any) => {
        setSelectedSession(session || null);
        setIsRequestModalOpen(true);
    };

    return (
        <DashboardLayout
            role="employee"
            pageTitle="My Attendance"
            pageDescription="View your work logs and request corrections"
        >
            <div className="space-y-6">
                {/* Pending Requests Section */}
                {/* TODO: Implement display for pending edit requests */}

                {/* Attendance History */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-[hsl(var(--muted))]/30">
                                        <th className="px-6 py-4 text-left font-semibold">Date</th>
                                        <th className="px-6 py-4 text-left font-semibold">Clock In</th>
                                        <th className="px-6 py-4 text-left font-semibold">Clock Out</th>
                                        <th className="px-6 py-4 text-left font-semibold">Total Hours</th>
                                        <th className="px-6 py-4 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        [1, 2, 3].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="px-6 py-4 h-16 bg-[hsl(var(--muted))]/10"></td>
                                            </tr>
                                        ))
                                    ) : sessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-[hsl(var(--muted-foreground))]">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Clock size={40} className="opacity-20" />
                                                    <p>No attendance logs found for today.</p>
                                                    <Button variant="outline" size="sm" onClick={() => handleRequestEdit()}>
                                                        Request Manual Entry
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sessions.map((session: any) => {
                                            const startTime = session.clock_in?.timestamp;
                                            const endTime = session.clock_out?.timestamp;

                                            return (
                                                <tr key={session.session_id || startTime} className="hover:bg-[hsl(var(--muted))]/20 transition-colors">
                                                    <td className="px-6 py-4 font-medium">
                                                        {startTime ? new Date(startTime).toLocaleDateString("en-AU", {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            timeZone: businessTimezone
                                                        }) : "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {startTime ? new Date(startTime).toLocaleTimeString("en-AU", {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: false,
                                                            timeZone: businessTimezone
                                                        }) : "--:--"}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {endTime ? (
                                                            new Date(endTime).toLocaleTimeString("en-AU", {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: false,
                                                                timeZone: businessTimezone
                                                            })
                                                        ) : (
                                                            <span className="text-orange-600 font-bold flex items-center gap-1">
                                                                <AlertCircle size={14} /> Missing
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Timer size={14} className="text-[hsl(var(--brand))] shrink-0" />
                                                            <span className="text-sm font-semibold tabular-nums">
                                                                {formatDuration(session.duration_minutes || 0)}
                                                            </span>
                                                            {(!startTime || !endTime) && (
                                                                <span
                                                                    className="text-[10px] font-medium text-[hsl(var(--warning))] bg-[hsl(var(--warning-light))] px-1.5 py-0.5 rounded-full"
                                                                    title="Incomplete session — missing clock in or out"
                                                                >
                                                                    partial
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 flex justify-end">
                                                        {(() => {
                                                            const pendingReq = editRequests?.find((r: any) => r.attendance_log_id === session.clock_in?.log_id && r.status === 'pending');
                                                            const rejectedReq = editRequests?.find((r: any) => r.attendance_log_id === session.clock_in?.log_id && r.status === 'rejected');

                                                            if (pendingReq) {
                                                                return <StatusBadge status="pending" label="Requested for Edit" className="bg-yellow-100 text-yellow-800 border-yellow-200" />;
                                                            }
                                                            return (
                                                                <div className="flex items-center gap-2">
                                                                    {rejectedReq && <StatusBadge status="rejected" label="Request Rejected" ghost />}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleRequestEdit(session)}
                                                                        className="text-[hsl(var(--brand))] hover:text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-light))]"
                                                                    >
                                                                        Request Edit
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isRequestModalOpen && (
                <AttendanceRequestModal
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                    log={selectedSession}
                />
            )}
        </DashboardLayout>
    );
}
