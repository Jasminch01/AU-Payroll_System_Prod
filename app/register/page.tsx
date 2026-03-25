"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Building2, User, CheckCircle } from "lucide-react";

const steps = ["Business Details", "Owner Account", "Confirmation"];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Business fields
    const [businessName, setBusinessName] = useState("");
    const [abn, setAbn] = useState("");
    const [state, setState] = useState("NSW");

    // Owner fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    business_name: businessName,
                    abn,
                    state,
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    password,
                }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.error || "Registration failed");
                return;
            }

            setStep(2); // Show confirmation
            toast.success("Business registered successfully!");
        } catch (err) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const australianStates = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

    return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg space-y-8"
            >
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white font-bold text-sm">
                            AP
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Create your business</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        Set up your workforce management in minutes
                    </p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2">
                    {steps.map((label, i) => (
                        <React.Fragment key={label}>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${i <= step
                                        ? "bg-[hsl(var(--brand))] text-white"
                                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                        }`}
                                >
                                    {i < step ? <CheckCircle size={16} /> : i + 1}
                                </div>
                                <span className={`hidden sm:inline text-sm ${i <= step ? "font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
                                    {label}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`h-px w-8 ${i < step ? "bg-[hsl(var(--brand))]" : "bg-[hsl(var(--border))]"}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step Content */}
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
                    {step === 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-5"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <Building2 size={24} className="text-[hsl(var(--brand))]" />
                                <h2 className="text-lg font-semibold">Business Details</h2>
                            </div>

                            <Input
                                label="Business Name"
                                placeholder="e.g. Café Luna Pty Ltd"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                            />
                            <Input
                                label="ABN (Australian Business Number)"
                                placeholder="e.g. 51 824 753 556"
                                value={abn}
                                onChange={(e) => setAbn(e.target.value)}
                            />
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">State</label>
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                                >
                                    {australianStates.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <Button
                                className="w-full"
                                size="lg"
                                onClick={() => {
                                    if (!businessName || !abn) {
                                        toast.error("Please fill in business name and ABN");
                                        return;
                                    }
                                    setStep(1);
                                }}
                            >
                                Continue
                                <ArrowRight size={18} />
                            </Button>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-5"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <User size={24} className="text-[hsl(var(--brand))]" />
                                <h2 className="text-lg font-semibold">Owner Account</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="First Name"
                                    placeholder="John"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                                <Input
                                    label="Last Name"
                                    placeholder="Smith"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                            <Input
                                label="Email"
                                type="email"
                                placeholder="john@cafeluna.com.au"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Input
                                label="Password"
                                type="password"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                hint="Must be at least 6 characters"
                            />

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" size="lg" onClick={() => setStep(0)}>
                                    <ArrowLeft size={18} />
                                    Back
                                </Button>
                                <Button
                                    className="flex-1"
                                    size="lg"
                                    loading={loading}
                                    onClick={() => {
                                        if (!firstName || !lastName || !email || !password) {
                                            toast.error("Please fill in all fields");
                                            return;
                                        }
                                        if (password.length < 6) {
                                            toast.error("Password must be at least 6 characters");
                                            return;
                                        }
                                        handleRegister();
                                    }}
                                >
                                    Create Account
                                    <ArrowRight size={18} />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-5 py-4"
                        >
                            <div className="flex justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success-light))]">
                                    <CheckCircle size={32} className="text-[hsl(var(--success))]" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
                            <p className="text-[hsl(var(--muted-foreground))]">
                                <strong>{businessName}</strong> has been registered. You can now sign in
                                and start managing your workforce.
                            </p>
                            <Button className="w-full" size="lg" onClick={() => router.push("/login")}>
                                Go to Sign In
                                <ArrowRight size={18} />
                            </Button>
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Already have an account?{" "}
                    <Link href="/login" className="text-[hsl(var(--brand))] hover:underline font-medium">
                        Sign in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
