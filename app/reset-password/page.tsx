"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // In Supabase, the user is automatically logged in after clicking the recovery link.
    // We just need to call `updateUser` with the new password.

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || !confirmPassword) {
            toast.error("Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            setSuccess(true);
            toast.success("Password updated successfully");

            // Redirect after 2 seconds
            setTimeout(() => {
                router.push("/login"); // They'll need to re-login to establish role-based dash or just let standard hook handle it
            }, 2000);

        } catch (err) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md text-center p-8 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl space-y-4"
                >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))]/20 mb-6">
                        <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
                    </div>
                    <h2 className="text-2xl font-bold">Password Updated</h2>
                    <p className="text-[hsl(var(--muted-foreground))] mb-8">
                        Your password has been successfully reset.
                    </p>
                    <Button className="w-full" onClick={() => router.push("/login")}>
                        Go to Login
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[hsl(var(--sidebar))] text-white p-12"
            >
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-accent))] font-bold text-lg">
                            AP
                        </div>
                        <span className="text-xl font-bold">AU Payroll</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-4xl font-bold leading-tight">
                        Secure your account
                    </h2>
                    <p className="text-lg text-white/60 max-w-md">
                        Please choose a strong password that you haven't used before.
                    </p>
                </div>

                <p className="text-sm text-white/40">
                    © {new Date().getFullYear()} AU Payroll. All rights reserved.
                </p>
            </motion.div>

            {/* Right Panel — Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-1 items-center justify-center p-6 sm:p-12"
            >
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="flex lg:hidden items-center gap-3 mb-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white font-bold text-lg">
                            AP
                        </div>
                        <span className="text-xl font-bold">AU Payroll</span>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Set new password</h1>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            Your new password must be at least 6 characters.
                        </p>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-5">
                        <PasswordInput
                            label="New Password"
                            placeholder="Enter your new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <PasswordInput
                            label="Confirm New Password"
                            placeholder="Confirm your new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />

                        <Button type="submit" className="w-full mt-4" size="lg" loading={loading}>
                            Reset Password
                        </Button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
