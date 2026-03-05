"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    ArrowRight,
    ArrowLeft,
    Lock,
    Phone,
    Building,
    Shield,
    CheckCircle,
    Loader2,
} from "lucide-react";

const onboardingSteps = [
    { label: "Set Password", icon: <Lock size={20} /> },
    { label: "Personal Info", icon: <Phone size={20} /> },
    { label: "Bank & PIN", icon: <Building size={20} /> },
    { label: "Complete", icon: <CheckCircle size={20} /> },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Onboarding status
    const [employeeName, setEmployeeName] = useState("");
    const [businessName, setBusinessName] = useState("");

    // Form fields
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");
    const [emergencyName, setEmergencyName] = useState("");
    const [emergencyPhone, setEmergencyPhone] = useState("");
    const [bankDetails, setBankDetails] = useState("");
    const [kioskPin, setKioskPin] = useState("");

    // Check if user needs onboarding
    useEffect(() => {
        async function checkStatus() {
            try {
                const res = await fetch("/api/onboarding/status");
                const data = await res.json();

                if (!data.success || !data.data?.needs_onboarding) {
                    router.push("/employee/dashboard");
                    return;
                }

                setEmployeeName(`${data.data.employee.first_name} ${data.data.employee.last_name}`);
                setBusinessName(data.data.business_name);
            } catch {
                toast.error("Failed to load onboarding status");
            } finally {
                setCheckingStatus(false);
            }
        }
        checkStatus();
    }, [router]);

    const handleComplete = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/onboarding/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password,
                    phone,
                    dob,
                    bank_details: bankDetails,
                    emergency_contact_name: emergencyName,
                    emergency_contact_phone: emergencyPhone,
                    kiosk_pin: kioskPin,
                }),
            });

            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || "Onboarding failed");
                return;
            }

            setStep(3); // Show completion
            toast.success("Welcome aboard! 🎉");
        } catch {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand))]" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg space-y-8"
            >
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white">
                            <Shield size={24} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Welcome, {employeeName}!
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        Complete your profile to join <strong>{businessName}</strong>
                    </p>
                </div>

                {/* Step Progress */}
                <div className="flex items-center justify-center gap-1">
                    {onboardingSteps.map((s, i) => (
                        <React.Fragment key={s.label}>
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${i <= step
                                        ? "bg-[hsl(var(--brand))] text-white"
                                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                    }`}
                                title={s.label}
                            >
                                {i < step ? <CheckCircle size={18} /> : s.icon}
                            </div>
                            {i < onboardingSteps.length - 1 && (
                                <div className={`h-px w-6 sm:w-10 ${i < step ? "bg-[hsl(var(--brand))]" : "bg-[hsl(var(--border))]"}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
                    <AnimatePresence mode="wait">
                        {/* Step 0: Password */}
                        {step === 0 && (
                            <motion.div
                                key="password"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h2 className="text-lg font-semibold">Set your password</h2>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Create a secure password for your account.
                                </p>
                                <Input
                                    label="Password"
                                    type="password"
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <Input
                                    label="Confirm Password"
                                    type="password"
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined}
                                />
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={() => {
                                        if (password.length < 6) return toast.error("Password must be at least 6 characters");
                                        if (password !== confirmPassword) return toast.error("Passwords don't match");
                                        setStep(1);
                                    }}
                                >
                                    Continue <ArrowRight size={18} />
                                </Button>
                            </motion.div>
                        )}

                        {/* Step 1: Personal Info */}
                        {step === 1 && (
                            <motion.div
                                key="personal"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h2 className="text-lg font-semibold">Personal Information</h2>
                                <Input
                                    label="Phone Number"
                                    type="tel"
                                    placeholder="0412 345 678"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                                <Input
                                    label="Date of Birth"
                                    type="date"
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                />
                                <Input
                                    label="Emergency Contact Name"
                                    placeholder="e.g. Sarah Johnson"
                                    value={emergencyName}
                                    onChange={(e) => setEmergencyName(e.target.value)}
                                />
                                <Input
                                    label="Emergency Contact Phone"
                                    type="tel"
                                    placeholder="0498 765 432"
                                    value={emergencyPhone}
                                    onChange={(e) => setEmergencyPhone(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" size="lg" onClick={() => setStep(0)}>
                                        <ArrowLeft size={18} /> Back
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        size="lg"
                                        onClick={() => {
                                            if (!phone || !dob || !emergencyName || !emergencyPhone) {
                                                return toast.error("Please fill in all fields");
                                            }
                                            setStep(2);
                                        }}
                                    >
                                        Continue <ArrowRight size={18} />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Bank & PIN */}
                        {step === 2 && (
                            <motion.div
                                key="bank"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h2 className="text-lg font-semibold">Bank Details & Kiosk PIN</h2>
                                <Input
                                    label="Bank Details (BSB & Account Number)"
                                    placeholder="BSB: 062-000, Acc: 1234 5678"
                                    value={bankDetails}
                                    onChange={(e) => setBankDetails(e.target.value)}
                                    hint="This is used for payroll payments"
                                />
                                <Input
                                    label="Kiosk PIN (4 digits)"
                                    type="password"
                                    placeholder="e.g. 1234"
                                    maxLength={4}
                                    value={kioskPin}
                                    onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ""))}
                                    hint="Used to clock in/out on the shared device"
                                    error={kioskPin && !/^\d{4}$/.test(kioskPin) ? "PIN must be exactly 4 digits" : undefined}
                                />
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" size="lg" onClick={() => setStep(1)}>
                                        <ArrowLeft size={18} /> Back
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        size="lg"
                                        loading={loading}
                                        onClick={() => {
                                            if (!bankDetails) return toast.error("Bank details are required");
                                            if (!/^\d{4}$/.test(kioskPin)) return toast.error("PIN must be 4 digits");
                                            handleComplete();
                                        }}
                                    >
                                        Complete Setup <CheckCircle size={18} />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Done */}
                        {step === 3 && (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center space-y-5 py-4"
                            >
                                <div className="flex justify-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success-light))]">
                                        <CheckCircle size={32} className="text-[hsl(var(--success))]" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold">Welcome aboard! 🎉</h2>
                                <p className="text-[hsl(var(--muted-foreground))]">
                                    Your profile is complete. You can now access your dashboard,
                                    view shifts, and clock in.
                                </p>
                                <Button className="w-full" size="lg" onClick={() => router.push("/employee/dashboard")}>
                                    Go to Dashboard <ArrowRight size={18} />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
