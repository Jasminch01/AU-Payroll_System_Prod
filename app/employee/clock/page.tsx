"use client";

import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";
import { getNextAttendanceEvent } from "@/lib/attendance-logic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Clock, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useBusinessTimezone } from "@/lib/timezone-context";

export default function EmployeeClockPage() {
    const [lastAction, setLastAction] = useState<{ type: string; time: string } | null>(null);
    const { businessTimezone } = useBusinessTimezone();
    
    const { data: profile } = useQuery({
        queryKey: ["profile"],
        queryFn: () => apiGet<any>("/profile"),
    });

    // Get today's attendance logs to determine current status
    const { data: attendanceData, refetch: refetchAttendance } = useQuery({
        queryKey: ["my-attendance"],
        queryFn: () => apiGet<any>("/attendance/me"),
    });

    const clockMutation = useMutation({
        mutationFn: () =>
            apiPost("/attendance/me", {}),
        onSuccess: (data: any) => {
            console.log('[CLOCK PAGE] Clock action successful:', {
                event_type: data.event_type,
                timestamp: data.timestamp
            });

            const time = new Intl.DateTimeFormat("en-AU", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: businessTimezone
            }).format(new Date());
            
            const actionLabel = data.event_type.replace(/_/g, ' ').toLowerCase();
            setLastAction({ 
                type: actionLabel.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
                time 
            });
            
            toast.success(`Success! You've ${actionLabel}.`);
            
            // Invalidate and refetch attendance logs to get fresh data
            setTimeout(() => {
                console.log('[CLOCK PAGE] Refetching attendance data...');
                refetchAttendance();
            }, 500);
            
            // Clear notification after 2 seconds
            setTimeout(() => setLastAction(null), 2000);
        },
        onError: (err: Error) => {
            console.error('[CLOCK PAGE] Clock error:', err);
            toast.error(err.message);
        },
    });

    const handleAction = () => {
        if (!profile?.employee_id) {
            toast.error("Profile not loaded.");
            return;
        }
        clockMutation.mutate();
    };

    // Determine current status from last log
    const currentStatus: string | null = attendanceData?.current_status || null;
    const nextEvent = getNextAttendanceEvent(
        attendanceData?.logs?.[0] ? {
            event_type: attendanceData.logs[0].event_type,
            timestamp: attendanceData.logs[0].timestamp
        } : null
    );

    const isClockingIn = nextEvent === 'CLOCK_IN';
    const statusLabel = currentStatus ? 
        currentStatus.replace(/_/g, ' ').toLowerCase() : 
        'No logs today';

    // Debug logging
    useEffect(() => {
        console.log('[CLOCK PAGE] Status calculated:', {
            currentStatus,
            nextEvent,
            isClockingIn,
            statusLabel,
            logs_count: attendanceData?.logs?.length || 0,
            first_log: attendanceData?.logs?.[0] ? {
                event_type: attendanceData.logs[0].event_type,
                timestamp: attendanceData.logs[0].timestamp
            } : null
        });
    }, [currentStatus, nextEvent, attendanceData, statusLabel  , isClockingIn]);

    return (
        <DashboardLayout
            role="employee"
            pageTitle="Clock In / Out"
            pageDescription="Enter your PIN to clock in or out"
        >
            <div className="flex justify-center">
                <Card className="w-full max-w-sm">
                    <CardContent className="p-8">
                        {/* Success animation */}
                        <AnimatePresence>
                            {lastAction && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center mb-6"
                                >
                                    <div className="flex justify-center mb-2">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--success-light))]">
                                            <CheckCircle size={28} className="text-[hsl(var(--success))]" />
                                        </div>
                                    </div>
                                    <p className="font-semibold text-[hsl(var(--success))]">{lastAction.type}</p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">at {lastAction.time}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Header Section */}
                        <div className="text-center mb-8">
                            <Clock size={40} className="mx-auto mb-4 text-[hsl(var(--brand))]" />
                            <h2 className="text-xl font-bold">Quick Clock</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Tap below to log your status</p>
                        </div>

                        {/* Current Status */}
                        <div className="mb-6 p-4 bg-[hsl(var(--muted))]/30 rounded-lg text-center">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Current Status</p>
                            <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
                                {statusLabel.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-3">
                            {isClockingIn ? (
                                <Button
                                    size="lg"
                                    className="h-14 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90"
                                    onClick={() => handleAction()}
                                    loading={clockMutation.isPending}
                                    disabled={!profile}
                                >
                                    <LogIn size={20} />
                                    Clock In
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    // variant="destructive"
                                    className="h-14"
                                    onClick={() => handleAction()}
                                    loading={clockMutation.isPending}
                                    disabled={!profile}
                                >
                                    <LogOut size={20} />
                                    Clock Out
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

