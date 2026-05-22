"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Zap, CheckCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (searchParams.get("confirmed") === "true") {
            toast.success("Email verified successfully! You can now sign in.", {
                icon: <CheckCircle className="text-[hsl(var(--success))]" size={18} />,
                duration: 5000,
            });
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.error || "Login failed");
                return;
            }

            toast.success("Welcome back!");

            // Session cookie is now set — trigger push subscription sync so any
            // previously-granted permission gets saved to push_subscriptions DB.
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                window.dispatchEvent(new CustomEvent('trigger-push-subscribe'));
            }

            // Redirect based on role
            const role = data.data?.role || data.data?.user?.role;
            if (role === "owner") router.push("/owner/dashboard");
            else if (role === "manager") router.push("/manager/dashboard");
            else router.push("/employee/dashboard");
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Left Panel — Branding */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[hsl(var(--brand))] text-white p-12 relative overflow-hidden"
            >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

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
                        Workforce management,
                        <br />
                        <span className="text-[hsl(var(--sidebar-accent))]">simplified.</span>
                    </h2>
                    <p className="text-lg text-white/60 max-w-md">
                        Rosters, timesheets, leave, payroll — all in one platform.
                        Built for Australian businesses.
                    </p>

                    <div className="flex gap-6 pt-4">
                        {[
                            { label: "Businesses", value: "500+" },
                            { label: "Employees", value: "10k+" },
                            { label: "Payrolls Run", value: "50k+" },
                        ].map((stat) => (
                            <div key={stat.label}>
                                <p className="text-2xl font-bold">{stat.value}</p>
                                <p className="text-sm text-white/50">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-white/40">
                    © {new Date().getFullYear()} AU Payroll. All rights reserved.
                </p>
            </motion.div>

            {/* Right Panel — Login Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-1 items-center justify-center p-6 sm:p-12"
            >
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white font-bold text-lg">
                            AP
                        </div>
                        <span className="text-xl font-bold">AU Payroll</span>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight bg-linear-to-br from-[hsl(var(--foreground))] to-[hsl(var(--brand))] bg-clip-text text-transparent">
                            Welcome back
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            Sign in to your account to continue
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input
                            label="Email address"
                            type="email"
                            name="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />

                        <PasswordInput
                            label="Password"
                            name="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" className="rounded border-[hsl(var(--input))]" />
                                <span className="text-[hsl(var(--muted-foreground))]">Remember me</span>
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-[hsl(var(--brand))] hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <Button type="submit" className="w-full" size="lg" loading={loading}>
                            Sign in
                            <ArrowRight size={18} />
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[hsl(var(--border))]" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[hsl(var(--background))] px-2 text-[hsl(var(--muted-foreground))]">
                                New to AU Payroll?
                            </span>
                        </div>
                    </div>

                    <Link href="/register">
                        <Button variant="outline" className="w-full" size="lg">
                            <Zap size={18} />
                            Create your business account
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}