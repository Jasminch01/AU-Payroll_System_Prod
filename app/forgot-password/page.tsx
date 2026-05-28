"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email address");
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) {
                toast.error(error.message);
                return;
            }

            setSent(true);
        } catch (err) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding (Same as Login) */}
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
                        <span className="text-xl font-bold text-[hsl(var(--sidebar-accent))]">AU Payroll</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-4xl font-bold leading-tight text-[hsl(var(--sidebar-accent))]">
                        Secure access to your
                        <br />
                        <span className="">account.</span>
                    </h2>
                    <p className="text-lg max-w-md text-[hsl(var(--sidebar-accent))]">
                        Reset your password to regain access to your dashboard, rosters, and timesheets.
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
                    <div className="flex lg:hidden items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white font-bold text-lg">
                            AP
                        </div>
                        <span className="text-xl font-bold">AU Payroll</span>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Forgot password?</h1>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            No worries, we'll send you reset instructions.
                        </p>
                    </div>

                    {sent ? (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--success))]/10 p-6 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/20 mb-4">
                                    <Mail className="h-6 w-6 text-[hsl(var(--success))]" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Check your email</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    We sent a password reset link to <br /><span className="font-medium text-[hsl(var(--foreground))]">{email}</span>
                                </p>
                            </div>
                            <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
                                <ArrowLeft size={16} className="mr-2" /> Back to log in
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-5">
                            <Input
                                label="Email address"
                                type="email"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                            />

                            <Button type="submit" className="w-full" size="lg" loading={loading}>
                                Reset password
                            </Button>

                            <div className="text-center pt-4">
                                <Link
                                    href="/login"
                                    className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors inline-flex items-center gap-2"
                                >
                                    <ArrowLeft size={14} /> Back to log in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
