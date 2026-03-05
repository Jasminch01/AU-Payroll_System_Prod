"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, Fingerprint, Clock, CheckCircle } from "lucide-react";

export default function EmployeeClockPage() {
    const [pin, setPin] = useState("");
    const [lastAction, setLastAction] = useState<{ type: string; time: string } | null>(null);

    const clockMutation = useMutation({
        mutationFn: (data: { kiosk_pin: string; action: "clock_in" | "clock_out" }) =>
            apiPost("/attendance/kiosk", data),
        onSuccess: (_, variables) => {
            const time = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
            setLastAction({ type: variables.action === "clock_in" ? "Clocked In" : "Clocked Out", time });
            toast.success(variables.action === "clock_in" ? "Welcome! You're clocked in." : "Goodbye! You're clocked out.");
            setPin("");
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setPin("");
        },
    });

    const handlePinInput = (digit: string) => {
        if (pin.length < 4) setPin(pin + digit);
    };

    const handleBackspace = () => {
        setPin(pin.slice(0, -1));
    };

    const handleAction = (action: "clock_in" | "clock_out") => {
        if (pin.length !== 4) {
            toast.error("Please enter your 4-digit PIN");
            return;
        }
        clockMutation.mutate({ kiosk_pin: pin, action });
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

                        {/* PIN Display */}
                        <div className="flex justify-center gap-3 mb-8">
                            {[0, 1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ scale: pin.length > i ? 1.1 : 1 }}
                                    className={`h-14 w-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${pin.length > i
                                            ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]"
                                            : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                                        }`}
                                >
                                    {pin.length > i ? "●" : ""}
                                </motion.div>
                            ))}
                        </div>

                        {/* Number Pad */}
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        if (key === "⌫") handleBackspace();
                                        else if (key) handlePinInput(key);
                                    }}
                                    disabled={!key}
                                    className={`h-14 rounded-xl text-xl font-medium transition-all ${key
                                            ? "hover:bg-[hsl(var(--muted))] active:scale-95 text-[hsl(var(--foreground))]"
                                            : ""
                                        } ${key === "⌫" ? "text-[hsl(var(--danger))] text-lg" : ""}`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                size="lg"
                                className="h-14"
                                onClick={() => handleAction("clock_in")}
                                loading={clockMutation.isPending}
                                disabled={pin.length !== 4}
                            >
                                <LogIn size={20} />
                                Clock In
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="h-14"
                                onClick={() => handleAction("clock_out")}
                                loading={clockMutation.isPending}
                                disabled={pin.length !== 4}
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
