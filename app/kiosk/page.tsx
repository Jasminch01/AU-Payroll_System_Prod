"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { toast } from "sonner";

export default function KioskPage() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [employeeId, setEmployeeId] = useState("");
    const [pin, setPin] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Status message state
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Live clock clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const resetForm = () => {
        setEmployeeId("");
        setPin("");
        setStatusMessage(null);
    };

    const handleEnter = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!employeeId || !pin) {
            setStatusMessage({ text: "Please enter both Employee ID and PIN", type: "error" });
            setTimeout(resetForm, 3000);
            return;
        }

        setIsLoading(true);
        setStatusMessage(null);

        try {
            const res: any = await apiPost("/attendance/kiosk", {
                employee_id: employeeId,
                pin: pin,
                // Optional: let the backend auto-detect event_type based on history
            });

            // Assuming standard API helper response { data: { log: {}, employee_name: "" }, message: "" }
            const eventTypeRaw = res.data?.log?.event_type || res.log?.event_type;
            const eventTypePretty = eventTypeRaw === 'CLOCK_IN' ? 'Clocked IN' : (eventTypeRaw === 'CLOCK_OUT' ? 'Clocked OUT' : 'Processed');
            const empName = res.data?.employee_name || res.employee_name || employeeId;

            setStatusMessage({
                text: `${empName} - Successfully ${eventTypePretty}`,
                type: "success"
            });

            // Auto close/reset after 3 seconds
            setTimeout(resetForm, 3000);

        } catch (err: any) {
            console.error("Kiosk Error:", err);
            setStatusMessage({
                text: err.message || "Invalid Employee ID or PIN",
                type: "error"
            });

            // Auto close/reset after 3 seconds
            setTimeout(() => {
                setPin(""); // Only clear PIN on error so they don't re-type ID if it was just a typo
                setStatusMessage(null);
            }, 3000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">

            {/* Minimalist Clock Header */}
            <div className="mb-12 flex flex-col items-center">
                <Clock className="mb-4 text-[hsl(var(--brand))]" size={48} />
                <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-[hsl(var(--foreground))] tabular-nums">
                    {currentTime.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                </h1>
                <p className="mt-2 text-lg text-[hsl(var(--muted-foreground))]">
                    {currentTime.toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" })}
                </p>
            </div>

            {/* Kiosk Terminal Box */}
            <div className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-2xl">

                {statusMessage ? (
                    <div className={`flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300`}>
                        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${statusMessage.type === 'success' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]/20 text-[hsl(var(--danger))]'}`}>
                            {statusMessage.type === 'success' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            )}
                        </div>
                        <h2 className={`text-xl font-bold ${statusMessage.type === 'success' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}`}>
                            {statusMessage.text}
                        </h2>
                    </div>
                ) : (
                    <form onSubmit={handleEnter} className="space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                Employee ID
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. EMP001"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                                className="h-14 text-center text-xl font-bold uppercase tracking-widest bg-[hsl(var(--muted))]/50"
                                required
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                                PIN
                            </label>
                            <Input
                                type="password"
                                placeholder="••••"
                                maxLength={4}
                                pattern="[0-9]*"
                                inputMode="numeric"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // strictly numbers
                                className="h-14 text-center text-3xl font-bold tracking-[1em] bg-[hsl(var(--muted))]/50"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 text-lg font-bold mt-4"
                            loading={isLoading}
                        >
                            Enter
                        </Button>
                    </form>
                )}
            </div>

            <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">
                Enter your Employee ID and PIN to clock in or out.
            </p>
        </div>
    );
}
