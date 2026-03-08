"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Store, Fan } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isExistingUser, setIsExistingUser] = useState(false);

    // Context Data
    const [employeeName, setEmployeeName] = useState("");
    const [businessName, setBusinessName] = useState("");

    // Minimal Form fields (as required by the new screenshot)
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");
    const [bankDetails, setBankDetails] = useState("");
    const [emergencyName, setEmergencyName] = useState("");
    const [emergencyPhone, setEmergencyPhone] = useState("");
    const [kioskPin, setKioskPin] = useState("");

    useEffect(() => {
        const supabase = createClient();
        let hasChecked = false;

        async function checkStatus() {
            if (hasChecked) return;
            hasChecked = true;

            try {
                const res = await fetch("/api/onboarding/status");
                const data = await res.json();

                if (!data.success || !data.data?.needs_onboarding) {
                    router.push("/employee/dashboard");
                    return;
                }

                setEmployeeName(`${data.data.employee.first_name || ""} ${data.data.employee.last_name || ""}`.trim());
                setBusinessName(data.data.business_name);

                if (data.data?.is_existing_user) {
                    setIsExistingUser(true);
                }
            } catch {
                toast.error("Failed to load onboarding status");
            } finally {
                setCheckingStatus(false);
            }
        }

        async function initialize() {
            try {
                // First check for PKCE token_hash (invite or magiclink)
                const params = new URLSearchParams(window.location.search);
                const token_hash = params.get('token_hash');
                const type = params.get('type') as any;

                if (token_hash && type) {
                    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
                    if (error) {
                        toast.error('Invalid or expired invitation link.');
                        router.push('/login');
                        return;
                    }
                    // Strip the ugly token from URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }

                // Second check for implicit flow hash (admin.generateLink defaults to this)
                if (window.location.hash.includes('access_token')) {
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const access_token = hashParams.get('access_token');
                    const refresh_token = hashParams.get('refresh_token');

                    if (access_token && refresh_token) {
                        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) {
                            toast.error('Invalid or expired invitation link.');
                            router.push('/login');
                            return;
                        }
                        // Clean up URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                        await checkStatus();
                        return;
                    }
                }

                // Wait a moment for session to naturally populate
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    await checkStatus();
                } else {
                    // Not signed in and no hash fragment handled
                    router.push('/login');
                }
            } catch (err) {
                console.error("Initialization error:", err);
                setCheckingStatus(false);
            }
        }

        initialize();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && !hasChecked) {
                checkStatus();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isExistingUser && password.length < 6) return toast.error("Password must be at least 6 characters");

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

            toast.success("Welcome aboard! 🎉");
            router.push("/employee/dashboard");
        } catch {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader2 className="h-10 w-10 animate-spin text-[#3B28A2]" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full lg:flex-row flex-col">
            {/* Left Panel - Visual Branding matching screenshot exactly */}
            <div className="lg:w-1/2 w-full bg-[#261C7F] text-white flex flex-col justify-center items-center p-8 lg:p-12 min-h-[40vh]">
                <div className="w-full flex flex-col items-center max-w-sm mx-auto text-center space-y-7">

                    {/* Simplified Illustration Area matching cloud/store theme */}
                    <div className="h-40 w-fit flex flex-col items-center justify-end relative pb-4">
                        {/* Clouds */}
                        <div className="flex gap-4 opacity-80 translate-y-2 translate-x-3">
                            <div className="w-10 h-3 bg-white rounded-full"></div>
                            <div className="w-6 h-3 bg-white rounded-full"></div>
                        </div>
                        {/* Store front icon representation */}
                        <Store size={100} className="text-[#FBA8BA] z-10" strokeWidth={1.5} />
                    </div>

                    <h2 className="text-[17px] font-medium tracking-wide">
                        Use AU Payroll System to:
                    </h2>

                    <ul className="text-left text-[14px] leading-relaxed mx-auto space-y-2 opacity-90 pl-3">
                        <li className="flex gap-3">
                            <span className="mt-[7px] block h-1 w-1 shrink-0 rounded-full bg-white"></span>
                            <span>Get your rosters and view your shifts</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="mt-[7px] block h-1 w-1 shrink-0 rounded-full bg-white"></span>
                            <span>Easily swap shifts with team mates</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="mt-[7px] block h-1 w-1 shrink-0 rounded-full bg-white"></span>
                            <span>Share leave and unavailability with your manager</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Right Panel - Form (Extremely Minimalist) */}
            <div className="lg:w-1/2 w-full bg-white flex flex-col justify-center lg:h-screen lg:overflow-y-auto custom-scrollbar">
                <div className="max-w-[400px] w-full mx-auto px-6 py-12 text-center text-slate-800">
                    {/* Header */}
                    <div className="mb-8 space-y-2">
                        <div className="flex justify-center mb-6">
                            {/* Deputy-style red windmill logo approximation */}
                            <Fan className="text-[#FF4A4A] h-[42px] w-[42px] stroke-[2.5]" />
                        </div>
                        <h1 className="text-[20px] font-semibold tracking-tight text-[#261C7F]">
                            Join {businessName} on<br />AU Payroll System
                        </h1>
                        <p className="text-[#4B5563] text-[13.5px] leading-[1.6] pt-3 px-2">
                            Your manager from <span className="font-semibold text-[#1F2937]">{businessName}</span> has invited you to start using AU Payroll System to simplify scheduling.
                        </p>
                    </div>

                    <form onSubmit={handleComplete} className="space-y-[18px] text-left">
                        {/* Name Field */}
                        <div className="space-y-[6px]">
                            <label className="text-[12px] font-bold text-slate-800 ml-1">Full name</label>
                            <Input
                                value={employeeName || ""}
                                disabled
                                className="bg-[#F9FAFB] text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-300 h-10 shadow-none text-sm"
                            />
                            <p className="text-[11px] text-[#6B7280] text-center px-1 leading-tight pt-1">
                                Your name should match your payroll details to ensure pay is always on time
                            </p>
                        </div>

                        {/* Mobile Field */}
                        <div className="space-y-[6px]">
                            <label className="text-[12px] font-bold text-slate-800 ml-1">Mobile number</label>
                            <Input
                                type="tel"
                                placeholder="0412 345 678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                            />
                        </div>

                        {/* DOB Field */}
                        <div className="space-y-[6px]">
                            <label className="text-[12px] font-bold text-slate-800 ml-1">Date of Birth</label>
                            <Input
                                type="date"
                                value={dob}
                                onChange={(e) => setDob(e.target.value)}
                                required
                                className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm"
                            />
                        </div>

                        {/* Bank Details Field */}
                        <div className="space-y-[6px]">
                            <label className="text-[12px] font-bold text-slate-800 ml-1">Bank Details (BSB & Acc)</label>
                            <Input
                                placeholder="BSB: 000-000, Acc: 00000000"
                                value={bankDetails}
                                onChange={(e) => setBankDetails(e.target.value)}
                                required
                                className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                            />
                        </div>

                        {/* Emergency Contact */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-[6px]">
                                <label className="text-[12px] font-bold text-slate-800 ml-1">Emergency Name</label>
                                <Input
                                    placeholder="Name"
                                    value={emergencyName}
                                    onChange={(e) => setEmergencyName(e.target.value)}
                                    required
                                    className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                                />
                            </div>
                            <div className="space-y-[6px]">
                                <label className="text-[12px] font-bold text-slate-800 ml-1">Emergency Phone</label>
                                <Input
                                    type="tel"
                                    placeholder="Phone"
                                    value={emergencyPhone}
                                    onChange={(e) => setEmergencyPhone(e.target.value)}
                                    required
                                    className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                                />
                            </div>
                        </div>

                        {/* Kiosk PIN */}
                        <div className="space-y-[6px]">
                            <label className="text-[12px] font-bold text-slate-800 ml-1">Kiosk PIN (4 digits)</label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                placeholder="e.g. 1234"
                                value={kioskPin}
                                onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ''))}
                                required
                                className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                            />
                            <p className="text-[11px] text-[#6B7280] ml-1">
                                Use this PIN to clock in/out at the kiosk
                            </p>
                        </div>

                        {/* Password Field */}
                        {!isExistingUser && (
                            <div className="space-y-[6px]">
                                <label className="text-[12px] font-bold text-slate-800 ml-1">Set Password</label>
                                <Input
                                    type="password"
                                    placeholder="Minimum 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="focus-visible:ring-0 focus-visible:ring-offset-0 border-[#D1D5DB] h-10 shadow-none text-sm placeholder:text-[#9CA3AF]"
                                />
                                {password && (
                                    <div className="flex gap-1 pt-0.5 opacity-80">
                                        <div className={`h-[5px] flex-1 rounded-sm ${password.length > 0 ? 'bg-slate-300' : 'bg-slate-100'} ${password.length > 2 ? 'bg-[#FF4A4A]' : ''}`}></div>
                                        <div className={`h-[5px] flex-1 rounded-sm ${password.length >= 6 ? 'bg-orange-400' : 'bg-slate-100'}`}></div>
                                        <div className={`h-[5px] flex-1 rounded-sm ${password.length >= 8 ? 'bg-[#10B981]' : 'bg-slate-100'}`}></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Submit Actions */}
                        <div className="pt-2 flex flex-col items-center">
                            <Button
                                type="submit"
                                className="w-full h-11 text-[14px] font-medium bg-[#3724B3] hover:bg-[#261C7F] rounded-[8px] transition-colors shadow-none"
                                loading={loading}
                            >
                                Join {businessName}
                            </Button>

                            <div className="mt-5 space-y-4 text-center px-2">
                                <p className="text-[11px] text-[#6B7280]">
                                    By signing up you are accepting the <span className="text-[#3724B3] hover:underline cursor-pointer font-medium">User Terms of Service</span> and <span className="text-[#3724B3] hover:underline cursor-pointer font-medium">Privacy Policy</span>
                                </p>

                                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                                    By signing up you agree to receive shift notifications and updates. Message frequency may vary. Message and data rates may apply. Reply HELP for help & STOP to cancel.
                                </p>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
