"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
            <div className="text-center space-y-6 max-w-md">
                <div className="flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--danger-light))]">
                        <AlertTriangle size={40} className="text-[hsl(var(--danger))]" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold">Something went wrong</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    An unexpected error occurred. Please try again.
                </p>
                <Button size="lg" onClick={reset}>
                    <RefreshCw size={16} /> Try Again
                </Button>
            </div>
        </div>
    );
}
