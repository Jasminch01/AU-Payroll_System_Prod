"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, Fingerprint, Clock, CheckCircle } from "lucide-react";

export default function EmployeeClockPage() {
    const [lastAction, setLastAction] = useState<{ type: string; time: string } | null>(null);
    const { data: profile } = useQuery({
        queryKey: ["profile"],
        queryFn: () => apiGet<any>("/profile"),
    });

    const clockMutation = useMutation({
        mutationFn: (data: { employee_id: string; action: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END" }) =>
            apiPost("/attendance/kiosk", data),
        onSuccess: (_, variables) => {
            const time = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
            const actionLabel = variables.action.replace('_', ' ').toLowerCase();
            setLastAction({ type: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1), time });
            toast.success(`Success! You're ${actionLabel}.`);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const handleAction = (action: "CLOCK_IN" | "CLOCK_OUT") => {
        if (!profile?.employee_id) {
            toast.error("Profile not loaded.");
            return;
        }
        clockMutation.mutate({ employee_id: profile.employee_id, action });
    };

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

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                size="lg"
                                className="h-14"
                                onClick={() => handleAction("CLOCK_IN")}
                                loading={clockMutation.isPending}
                                disabled={!profile}
                            >
                                <LogIn size={20} />
                                Clock In
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14"
                                onClick={() => handleAction("CLOCK_OUT")}
                                loading={clockMutation.isPending}
                                disabled={!profile}
                            >
                                <LogOut size={20} />
                                Clock Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
