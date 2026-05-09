"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui";
import { toast } from "sonner";
import { Loader2, Store, Fan } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { apiGet, apiPost } from "@/lib/api-client";

export default function OnboardingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    // Context Data
    const [employeeName, setEmployeeName] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [joinMode, setJoinMode] = useState(false);
    const [businessCode, setBusinessCode] = useState<string | null>(null);

    // Minimal Form fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [bankAccountName, setBankAccountName] = useState("");
    const [bankBsb, setBankBsb] = useState("");
    const [bankAccountNumber, setBankAccountNumber] = useState("");
    const [abn, setAbn] = useState("");
    const [tfn, setTfn] = useState("");
    const [employmentType, setEmploymentType] = useState("full_time");
    const [dob, setDob] = useState("");

    const initialized = React.useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const supabase = createClient();
        let hasChecked = false;

        async function checkStatus() {
            if (hasChecked) return;
            hasChecked = true;

            try {
                const data: any = await apiGet("/onboarding/status");

                if (data.is_owner) {
                    router.push("/owner/dashboard");
                    return;
                } 
                
                if (!data.needs_onboarding) {
                    router.push("/employee/dashboard");
                    return;
                }

                setEmployeeName(`${data.employee.first_name || ""} ${data.employee.last_name || ""}`.trim());
                setBusinessName(data.business_name);

                if (data.employee.employment_type) {
                    setEmploymentType(data.employee.employment_type);
                }

                if (data.is_existing_user) {
                    setIsExistingUser(true);
                }
                setCheckingStatus(false);
            } catch (err: any) {
                console.error("checkStatus error:", err);
                // Handle 401 or invitation errors here
                if (err.message.toLowerCase().includes("unauthorized") || err.message.toLowerCase().includes("not found")) {
                    setAccessDenied(true);
                } else {
                    toast.error(err.message || "Failed to load onboarding status");
                }
                setCheckingStatus(false);
            }
        }

        async function initialize() {
            try {
                const params = new URLSearchParams(window.location.search);
                const token_hash = params.get('token_hash');
                const type = params.get('type') as any;
                const bCode = params.get('business');
                const hasHash = window.location.hash.includes('access_token') || window.location.hash.includes('error=');

                // Access Control Check: If no entry point is found, redirect immediately
                if (!token_hash && !hasHash && !bCode) {
                    // One last check for an existing session before denying
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                        setAccessDenied(true);
                        setCheckingStatus(false);
                        return;
                    }
                }

                // 0. Check for error in hash (e.g. otp_expired)
                if (window.location.hash.includes('error=')) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                        await checkStatus();
                        return;
                    }

                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const errorDesc = hashParams.get('error_description') || hashParams.get('error') || 'Invitation error';
                    toast.error(errorDesc.replace(/\+/g, ' '));
                    setCheckingStatus(false);
                    setTimeout(() => router.push('/login'), 3000);
                    return;
                }

                // 1. Check for PKCE token_hash
                if (token_hash && type) {
                    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
                    if (error) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            window.history.replaceState({}, document.title, window.location.pathname);
                            await checkStatus();
                            return;
                        }
                        toast.error(error.message || 'Invalid or expired invitation link.');
                        router.push('/login');
                        return;
                    }
                    window.history.replaceState({}, document.title, window.location.pathname);
                    await checkStatus();
                    return;
                }

                // 2. Check for implicit flow hash
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
                        window.history.replaceState({}, document.title, window.location.pathname);
                        await checkStatus();
                        return;
                    }
                }

                // 3. Check for existing session or business join code
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    await checkStatus();
                } else if (bCode) {
                    setBusinessCode(bCode);
                    setJoinMode(true);
                    setCheckingStatus(false);

                    try {
                        const bData: any = await apiGet("/business/preview", { code: bCode });
                        setBusinessName(bData.business_name);
                    } catch (e) {
                        console.error("Failed to fetch business preview", e);
                    }
                } else {
                    setAccessDenied(true);
                    setCheckingStatus(false);
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

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) return toast.error("Passwords do not match");
        if (password.length < 6) return toast.error("Password must be at least 6 characters");

        setLoading(true);
        try {
            await apiPost("/employees/join", {
                email,
                password,
                first_name: firstName,
                last_name: lastName,
                join_code: businessCode,
                bank_account_name: null,
                bank_bsb: null,
                bank_account_number: null,
                abn: null,
                tfn: null,
                dob: null,
            });

            // Now log in
            const supabase = createClient();
            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            if (loginError) {
                toast.success("Joined successfully! Please log in now.");
                router.push("/login");
            } else {
                toast.success("Welcome aboard! 🎉");
                router.push("/employee/dashboard");
            }
        } catch (err: any) {
            toast.error(err.message || "Join failed");
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isExistingUser) {
            if (password !== confirmPassword) return toast.error("Passwords do not match");
            if (password.length < 6) return toast.error("Password must be at least 6 characters");
        }

        setLoading(true);
        try {
            await apiPost("/onboarding/complete", {
                password,
                bank_account_name: null,
                bank_bsb: null,
                bank_account_number: null,
                abn: null,
                tfn: null,
                dob: null,
            });

            toast.success("Welcome aboard! 🎉");
            router.push("/employee/dashboard");
        } catch (err: any) {
            toast.error(err.message || "Onboarding failed");
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

    if (accessDenied) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
                <Fan className="h-12 w-12 text-[#FF4A4A] mb-4" />
                <h1 className="text-xl font-bold text-[#261C7F] mb-2">No Invitation Found</h1>
                <p className="text-sm text-slate-600 max-w-sm mb-6">
                    This onboarding link appears to be invalid or has expired. Please check your email or contact your manager for a new invitation.
                </p>
                <Button onClick={() => router.push('/login')} className="bg-[#3724B3] hover:bg-[#261C7F]">
                    Go to Login
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full lg:flex-row flex-col">
            {/* Left Panel */}
            <div className="lg:w-1/2 w-full bg-[#261C7F] text-white flex flex-col justify-center items-center p-8 lg:p-12 min-h-[40vh]">
                <div className="w-full flex flex-col items-center max-w-sm mx-auto text-center space-y-7">
                    <div className="h-40 w-fit flex flex-col items-center justify-end relative pb-4">
                        <div className="flex gap-4 opacity-80 translate-y-2 translate-x-3">
                            <div className="w-10 h-3 bg-white rounded-full"></div>
                            <div className="w-6 h-3 bg-white rounded-full"></div>
                        </div>
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

            {/* Right Panel - Form */}
            <div className="lg:w-1/2 w-full bg-white flex flex-col justify-center lg:h-screen lg:overflow-y-auto custom-scrollbar">
                <div className="max-w-[400px] w-full mx-auto px-6 py-12 text-center text-slate-800">
                    {/* Header */}
                    <div className="mb-8 space-y-2">
                        <div className="flex justify-center mb-6">
                            <Fan className="text-[#FF4A4A] h-[42px] w-[42px] stroke-[2.5]" />
                        </div>
                        <h1 className="text-[20px] font-semibold tracking-tight text-[#261C7F]">
                            {joinMode ? "Join Your Team" : `Join ${businessName} on`} <br />AU Payroll System
                        </h1>
                        <p className="text-[#4B5563] text-[13.5px] leading-[1.6] pt-3 px-2">
                            {joinMode
                                ? "Enter your details below to create an account and join your business."
                                : `Your manager has invited you to start using AU Payroll System to simplify scheduling.`}
                        </p>
                    </div>

                    {joinMode ? (
                        <form onSubmit={handleJoin} className="space-y-[18px] text-left">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-[6px]">
                                    <Input label="First name" showAsterisk placeholder="Jane" value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-10 text-sm" />
                                </div>
                                <div className="space-y-[6px]">
                                    <Input label="Last name" showAsterisk placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} required className="h-10 text-sm" />
                                </div>
                            </div>
                            <div className="space-y-[6px]">
                                <Input label="Email address" showAsterisk type="email" placeholder="jane@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-10 text-sm" />
                            </div>
                            <div className="space-y-[6px]">
                                <PasswordInput 
                                    label="Set Password" showAsterisk 
                                    placeholder="6+ characters" 
                                    value={password} onChange={e => setPassword(e.target.value)} 
                                    required className="h-10 text-sm"
                                />
                            </div>
                            <div className="space-y-[6px]">
                                <PasswordInput 
                                    label="Confirm Password" showAsterisk 
                                    placeholder="Repeat password" 
                                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} 
                                    required className="h-10 text-sm"
                                />
                            </div>

                            {/* <hr className="my-4 border-slate-100" />
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payroll Details</p>

                            <div className="space-y-[14px]">
                                <div className="space-y-[6px]">
                                    <Input label="Bank Account Name" showAsterisk placeholder="John Doe" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} required className="h-10 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-[6px]">
                                        <Input label="Bank BSB" showAsterisk placeholder="000-000" value={bankBsb} onChange={(e) => setBankBsb(e.target.value)} required className="h-10 text-sm" />
                                    </div>
                                    <div className="space-y-[6px]">
                                        <Input label="Account Number" showAsterisk placeholder="00000000" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} required className="h-10 text-sm" />
                                    </div>
                                </div>
                                <div className="space-y-[6px]">
                                    {employmentType === 'contract' ? (
                                        <Input label="ABN" showAsterisk placeholder="Format: 00 000 000 000" value={abn} onChange={(e) => setAbn(e.target.value)} required className="h-10 text-sm" />
                                    ) : (
                                        <Input label="TFN" showAsterisk placeholder="Format: 000 000 000" value={tfn} onChange={(e) => setTfn(e.target.value)} required className="h-10 text-sm" />
                                    )}
                                </div>
                                <div className="space-y-[6px]">
                                    <Input 
                                        label="Date of Birth" 
                                        type={dob ? "date" : "text"} 
                                        placeholder="Not Set"
                                        value={dob} 
                                        onFocus={(e) => e.target.type = 'date'}
                                        onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                                        onChange={(e) => setDob(e.target.value)} 
                                        className="h-10 text-sm" 
                                    />
                                </div>
                            </div> */}
                            {/* ABN/TFN hidden for Rostering module phase
                            <div className="space-y-[14px]">
                                 <div className="space-y-[6px]">
                                    {employmentType === 'contract' ? (
                                        <Input label="ABN" showAsterisk placeholder="Format: 00 000 000 000" value={abn} onChange={(e) => setAbn(e.target.value)} required className="h-10 text-sm" />
                                    ) : (
                                        <Input label="TFN" showAsterisk placeholder="Format: 000 000 000" value={tfn} onChange={(e) => setTfn(e.target.value)} required className="h-10 text-sm" />
                                    )}
                                </div>
                            </div>
                            */}

                            <Button type="submit" className="w-full h-11 text-[14px] font-medium bg-[#3724B3] hover:bg-[#261C7F] rounded-[8px] mt-4" loading={loading}>
                                Join & Complete Onboarding
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleComplete} className="space-y-[18px] text-left">
                            <div className="space-y-[14px]">
                                {/* <div className="space-y-[6px]">
                                    <Input label="Bank Account Name" showAsterisk placeholder="John Doe" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} required className="h-10 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-[6px]">
                                        <Input label="Bank BSB" showAsterisk placeholder="000-000" value={bankBsb} onChange={(e) => setBankBsb(e.target.value)} required className="h-10 text-sm" />
                                    </div>
                                    <div className="space-y-[6px]">
                                        <Input label="Account Number" showAsterisk placeholder="00000000" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} required className="h-10 text-sm" />
                                    </div>
                                </div> */}
                                <div className="space-y-[6px]">
                                    {employmentType === 'contract' ? (
                                        <Input label="ABN" showAsterisk placeholder="Format: 00 000 000 000" value={abn} onChange={(e) => setAbn(e.target.value)} required className="h-10 text-sm" />
                                    ) : (
                                        <Input label="TFN" showAsterisk placeholder="Format: 000 000 000" value={tfn} onChange={(e) => setTfn(e.target.value)} required className="h-10 text-sm" />
                                    )}
                                </div>
                                {/* <div className="space-y-[6px]">
                                    <Input 
                                        label="Date of Birth" 
                                        type={dob ? "date" : "text"} 
                                        placeholder="Not Set"
                                        value={dob} 
                                        onFocus={(e) => e.target.type = 'date'}
                                        onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                                        onChange={(e) => setDob(e.target.value)} 
                                        className="h-10 text-sm" 
                                    />
                                </div> */}
                            </div>

                            {!isExistingUser && (
                                <>
                                    <div className="space-y-[6px]">
                                        <PasswordInput 
                                            label="Set New Password" showAsterisk 
                                            placeholder="Minimum 6 characters" 
                                            value={password} onChange={(e) => setPassword(e.target.value)} 
                                            required className="h-10 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-[6px]">
                                        <PasswordInput 
                                            label="Confirm Password" showAsterisk 
                                            placeholder="Repeat password" 
                                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} 
                                            required className="h-10 text-sm"
                                        />
                                    </div>
                                </>
                            )}

                            <div className="pt-2 flex flex-col items-center">
                                <Button type="submit" className="w-full h-11 text-[14px] font-medium bg-[#3724B3] hover:bg-[#261C7F] rounded-[8px]" loading={loading}>
                                    Join {businessName}
                                </Button>
                                <p className="mt-5 text-[11px] text-[#6B7280] text-center">
                                    By signing up you are accepting the User Terms and Privacy Policy
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
