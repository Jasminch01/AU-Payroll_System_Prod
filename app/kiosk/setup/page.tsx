"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { CheckCircle, ShieldAlert } from "lucide-react";

export default function KioskSetupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleAuthorize = async () => {
        setIsLoading(true);
        try {
            await apiPost("/kiosk/authorize");
            setIsSuccess(true);
            toast.success("Kiosk Authorized!");
            // Redirect to kiosk immediately
            setTimeout(() => {
                router.push("/kiosk");
            }, 1000);
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to authorize Kiosk device. Are you logged in as a Manager/Owner?");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">
            <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-2xl space-y-6 text-center">

                {isSuccess ? (
                    <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <CheckCircle size={64} className="text-[hsl(var(--success))]" />
                        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">Device Authorized</h2>
                        <p className="text-[hsl(var(--muted-foreground))]">Launching Kiosk Mode instantly...</p>
                    </div>
                ) : (
                    <>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--brand))]/10 text-[hsl(var(--brand))]">
                            <ShieldAlert size={32} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
                                Setup Kiosk Mode
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                By pressing the button below, you will securely authorize this device to track employee attendance.
                                Keep this browser open on an iPad or PC at your venue.
                            </p>
                        </div>

                        <Button
                            onClick={handleAuthorize}
                            disabled={isLoading}
                            loading={isLoading}
                            className="w-full h-12 mt-4 text-md font-bold"
                        >
                            Authorize & Launch Kiosk
                        </Button>
                    </>
                )}
            </div>
            <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))] text-balance text-center max-w-md">
                Make sure you are logged in using a Manager or Owner account before setting up this device.
            </p>
        </div>
    );
}
