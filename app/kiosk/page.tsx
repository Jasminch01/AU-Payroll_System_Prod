"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, ArrowLeft, LogOut, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { EventType } from "@/types/database";

type KioskAction = {
    type: EventType;
    label: string;
    variant: 'default' | 'outline' | 'destructive';
};

export default function KioskPage() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [step, setStep] = useState<'id' | 'board' | 'success'>('id');
    const [employeeId, setEmployeeId] = useState("");
    const [employeeData, setEmployeeData] = useState<{ name: string; available_actions: KioskAction[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastAction, setLastAction] = useState<string>("");

    // Timers for auto-reset
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const resetToHome = () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        setStep('id');
        setEmployeeId("");
        setEmployeeData(null);
        setLastAction("");
        setIsLoading(false);
    };

    const handleIdentify = async (val?: string) => {
        const idToSubmit = val || employeeId;
        if (idToSubmit.length !== 4) return;

        setIsLoading(true);
        try {
            const res: any = await apiGet(`/attendance/kiosk/status?employee_id=${idToSubmit}`);
            setEmployeeData({
                name: res.employee_name,
                available_actions: res.available_actions
            });
            setStep('board');
            
            // Auto reset if inactive on board for 15 seconds
            startAutoReset(15000);
        } catch (err: any) {
            toast.error(err.message || "Invalid Employee ID");
            setEmployeeId("");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeypadPress = (digit: string) => {
        if (employeeId.length < 4) {
            const newId = employeeId + digit;
            setEmployeeId(newId);
            if (newId.length === 4) {
                handleIdentify(newId);
            }
        }
    };

    const handleBackspace = () => {
        setEmployeeId(employeeId.slice(0, -1));
    };

    const handleAction = async (action: KioskAction) => {
        setIsLoading(true);
        try {
            const res: any = await apiPost("/attendance/kiosk", {
                employee_id: employeeId.toUpperCase(),
                event_type: action.type
            });

            setLastAction(action.label);
            setStep('success');
            
            // Reset to home after 3 seconds
            startAutoReset(3000);
        } catch (err: any) {
            toast.error(err.message || "Action failed");
        } finally {
            setIsLoading(false);
        }
    };

    const startAutoReset = (ms: number) => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(resetToHome, ms);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4 overflow-hidden">
            
            {/* Minimalist Clock Header */}
            <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
                <Clock className="mb-4 text-[hsl(var(--brand))]" size={48} />
                <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-[hsl(var(--foreground))] tabular-nums">
                    {currentTime.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                </h1>
                <p className="mt-2 text-lg text-[hsl(var(--muted-foreground))]">
                    {currentTime.toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" })}
                </p>
            </div>

            {/* Kiosk Terminal Box */}
            <div className={`w-full max-w-lg rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 md:p-12 shadow-2xl transition-all duration-500`}>
                
                {step === 'id' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="mb-10 text-center">
                            <h2 className="text-3xl font-bold">Welcome</h2>
                            <p className="text-[hsl(var(--muted-foreground))]">Enter your 4-digit ID to begin</p>
                        </div>
                        
                        <div className="flex justify-center gap-3 mb-10">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`h-16 w-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all ${
                                        employeeId.length > i 
                                        ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand))]/5 text-[hsl(var(--brand))]" 
                                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                                    }`}
                                >
                                    {employeeId[i] || ""}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-3 max-w-[320px] mx-auto">
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
                                <Button
                                    key={key}
                                    variant="ghost"
                                    className={`h-16 text-2xl font-bold rounded-2xl transition-all ${
                                        !key ? "invisible" : "hover:bg-[hsl(var(--muted))] active:scale-90"
                                    } ${key === "⌫" ? "text-[hsl(var(--danger))]" : ""}`}
                                    onClick={() => key === "⌫" ? handleBackspace() : key && handleKeypadPress(key)}
                                    disabled={isLoading}
                                >
                                    {key}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'board' && employeeData && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="mb-10 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-medium uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Identified Employee</h2>
                                <h3 className="text-3xl font-black text-[hsl(var(--brand))]">{employeeData.name}</h3>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={resetToHome}
                                className="h-12 w-12 rounded-full hover:bg-[hsl(var(--danger))]/10 hover:text-[hsl(var(--danger))]"
                            >
                                <LogOut size={24} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {employeeData.available_actions.map((action) => (
                                <Button
                                    key={action.type}
                                    variant={action.variant === 'destructive' ? 'danger' : 'default'}
                                    className={`h-24 text-2xl font-bold rounded-2xl shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all
                                        ${action.variant === 'outline' ? 'bg-white text-black border-2 border-black hover:bg-black hover:text-white dark:invert' : ''}
                                    `}
                                    onClick={() => handleAction(action)}
                                    disabled={isLoading}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button variant="ghost" onClick={resetToHome} className="text-[hsl(var(--muted-foreground))]">
                                <ArrowLeft className="mr-2" size={18} />
                                Back to Start
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]">
                            <CheckCircle2 size={64} />
                        </div>
                        <h2 className="text-4xl font-black mb-2">Success!</h2>
                        <p className="text-xl text-[hsl(var(--muted-foreground))] text-center">
                            {employeeData?.name} - {lastAction} successful.
                        </p>
                        <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))] animate-pulse">
                            Resetting for next employee...
                        </p>
                    </div>
                )}
            </div>

            <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))] opacity-50">
                Shared Kiosk Mode • Authorized Device
            </p>
        </div>
    );
}
