"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut, apiPost } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Save, User, Phone, Shield, Lock, KeyRound, Building2, Bell, RefreshCw, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfilePage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const role = user?.role;
    const [formData, setFormData] = useState<any>(null);
    const supabase = createClient();

    // Password State
    const [pwdOpen, setPwdOpen] = useState(false);
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [updatingPwd, setUpdatingPwd] = useState(false);

    // Fetch full profile details
    const { data: profile, isLoading } = useQuery({
        queryKey: ["user-profile", user?.user_id],
        queryFn: () => apiGet<any>(`/profile`),
        enabled: !!user?.user_id,
    });

    React.useEffect(() => {
        if (profile && !formData) {
            setFormData({ ...profile });
        }
    }, [profile, formData]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => {
            return apiPut(`/profile`, data);
        },
        onSuccess: () => {
            toast.success("Employee updated");

            queryClient.invalidateQueries({ queryKey: ["employee", user?.user_id] });
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            queryClient.invalidateQueries({ queryKey: ["auth-me"] });

            setFormData(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });
    const handlePasswordUpdate = async () => {
        if (newPwd !== confirmPwd) {
            toast.error("Passwords do not match");
            return;
        }
        if (newPwd.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setUpdatingPwd(true);
        const { error } = await supabase.auth.updateUser({
            password: newPwd
        });
        setUpdatingPwd(false);

        if (error) {
            toast.error(`Failed to update password: ${error.message}`);
        } else {
            toast.success("Password updated successfully");
            setPwdOpen(false);
            setNewPwd("");
            setConfirmPwd("");
        }
    };

    // Push Notification Testing
    const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'loading'>('loading');
    const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);

    React.useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setPushStatus(Notification.permission);
            
            const checkSub = async () => {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                setHasSubscription(!!sub);
            };
            checkSub();
        }
    }, []);

    const testPushMutation = useMutation({
        mutationFn: () => apiPost(`/notifications/test-push`),
        onSuccess: () => {
            toast.success("Test signal sent!", {
                description: "Wait 2-3 seconds. If you don't see a notification, check your device settings."
            });
        },
        onError: (err: Error) => {
            toast.error(`Test failed: ${err.message}`);
        }
    });

    const triggerReRegister = () => {
        window.dispatchEvent(new CustomEvent('trigger-push-subscribe'));
        // Refresh status after a delay
        setTimeout(async () => {
            setPushStatus(Notification.permission);
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            setHasSubscription(!!sub);
        }, 5000);
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const updateBusinessField = (field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            Business: {
                ...prev.Business,
                [field]: value
            }
        }));
    };

    const data = formData || profile || {};

    if (isLoading) {
        return (
            <DashboardLayout role={role as any || "employee"} pageTitle="My Profile" pageDescription="Loading...">
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            role={role as any || "employee"}
            pageTitle=""
            pageDescription=""
            actions={null}
        >
            <div className="space-y-6 max-w-5xl mx-auto">
                <Card className="overflow-hidden border-none shadow-md bg-linear-to-br from-[hsl(var(--brand))]/10 via-transparent to-transparent">
                    <CardContent className="p-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="relative">
                            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-4xl font-bold border-8 border-[hsl(var(--background))] shadow-2xl transition-transform hover:scale-105 duration-300">
                                {data.first_name?.[0]}{data.last_name?.[0]}
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[hsl(var(--success))] border-4 border-[hsl(var(--background))] shadow-sm" />
                        </div>
                        <div className="text-center md:text-left flex-1 space-y-2">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{data.first_name} {data.last_name}</h1>
                                <p className="text-[hsl(var(--muted-foreground))] font-medium mt-1 flex items-center justify-center md:justify-start gap-2">
                                    <Shield size={16} /> {data.role_title} ({data.role || role})
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                                <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 bg-[hsl(var(--muted))] px-3 py-1.5 rounded-full"><User size={14} /> {user?.email}</span>
                                {data.Business?.business_name && (
                                    <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 bg-[hsl(var(--muted))] px-3 py-1.5 rounded-full"><Building2 size={14} /> {data.Business.business_name}</span>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0 pt-4 md:pt-0">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const payload: any = {
                                        first_name: data.first_name,
                                        last_name: data.last_name,
                                        phone: data.phone,
                                        dob: data.dob,
                                        emergency_contact_name: data.emergency_contact_name,
                                        emergency_contact_phone: data.emergency_contact_phone,
                                        bank_account_name: data.bank_account_name,
                                        bank_bsb: data.bank_bsb,
                                        bank_account_number: data.bank_account_number,
                                        abn: data.abn,
                                        tfn: data.tfn,
                                    };
                                    if (role === 'owner' && data.Business) {
                                        payload.business = {
                                            business_name: data.Business.business_name,
                                            abn: data.Business.abn,
                                            state: data.Business.state,
                                            labour_threshold_min: data.Business.labour_threshold_min ? parseFloat(data.Business.labour_threshold_min) : null,
                                            labour_theshold_max: data.Business.labour_theshold_max ? parseFloat(data.Business.labour_theshold_max) : null,
                                        };
                                    }
                                    updateMutation.mutate(payload);
                                }}
                                loading={updateMutation.isPending}
                            >
                                <Save size={16} className="mr-2" /> Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="personal" className="w-full">
                    <div className="flex justify-center mb-8">
                        <TabsList className="h-auto p-1.5 bg-[hsl(var(--muted))]/60 rounded-xl shadow-inner border border-[hsl(var(--border))]/50">
                            <TabsTrigger value="personal" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200">Personal</TabsTrigger>
                            <TabsTrigger value="security" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200">Security</TabsTrigger>
                            {role !== 'owner' && <TabsTrigger value="employment" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200">Employment</TabsTrigger>}
                            {role === 'owner' && <TabsTrigger value="business" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200">Business</TabsTrigger>}
                        </TabsList>
                    </div>

                    <TabsContent value="personal" className="space-y-6 outline-none">
                        <Card>
                            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User size={18} /> Personal Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="First Name" value={data.first_name || ""} onChange={(e) => updateField("first_name", e.target.value)} disabled />
                                    <Input label="Last Name" value={data.last_name || ""} onChange={(e) => updateField("last_name", e.target.value)} disabled />
                                </div>
                                <Input label="Email Address" value={user?.email || ""} disabled />
                                {role !== 'owner' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input label="Phone Number" showAsterisk value={data.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                                            <Input label="Date of Birth" showAsterisk type="date" value={data.dob || ""} onChange={(e) => updateField("dob", e.target.value)} />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {role !== 'owner' && (
                            <Card>
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone size={18} /> Emergency Contact</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <Input label="Contact Name" value={data.emergency_contact_name || ""} onChange={(e) => updateField("emergency_contact_name", e.target.value)} />
                                    <Input label="Contact Phone" value={data.emergency_contact_phone || ""} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} />
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6 outline-none">

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><KeyRound size={18} /> Account Password</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!pwdOpen ? (
                                    <Button variant="outline" className="w-full" onClick={() => setPwdOpen(true)}>
                                         Change Password
                                    </Button>
                                ) : (
                                    <div className="space-y-3 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--muted))]/30">
                                        <Input
                                            label="New Password"
                                            type="password"
                                            value={newPwd}
                                            onChange={(e) => setNewPwd(e.target.value)}
                                        />
                                        <Input
                                            label="Confirm Password"
                                            type="password"
                                            value={confirmPwd}
                                            onChange={(e) => setConfirmPwd(e.target.value)}
                                        />
                                        <div className="flex gap-2 pt-2">
                                            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPwdOpen(false); setNewPwd(""); setConfirmPwd(""); }}>Cancel</Button>
                                            <Button size="sm" className="flex-1" onClick={handlePasswordUpdate} loading={updatingPwd}>Update</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Bell size={18} /> Push Notifications
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-[hsl(var(--muted))]/10">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Device Registration</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2 w-2 rounded-full ${hasSubscription ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--destructive))]'}`} />
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">
                                                {hasSubscription ? 'Registered' : 'Not Linked'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={triggerReRegister}>
                                        <RefreshCw size={14} className="mr-2" /> 
                                        {hasSubscription ? 'Re-sync' : 'Fix Registration'}
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-[hsl(var(--muted))]/10">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">System Permissions</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">
                                            {pushStatus === 'granted' ? 'Allowed' : pushStatus === 'denied' ? 'Blocked' : 'Unknown'}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded ${pushStatus === 'granted' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {pushStatus === 'granted' ? 'All good' : 'Check settings'}
                                    </span>
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-3 bg-[hsl(var(--muted))]/30 p-2 rounded leading-relaxed">
                                        If notifications are not arriving, click <strong>Re-sync</strong>, then click <strong>Send Test signal</strong> and lock your phone immediately.
                                    </p>
                                    <Button 
                                        className="w-full" 
                                        variant="secondary"
                                        disabled={!hasSubscription}
                                        onClick={() => testPushMutation.mutate()}
                                        loading={testPushMutation.isPending}
                                    >
                                        <Send size={14} className="mr-2" /> Send Test Signal to Device
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {role !== 'owner' && (
                        <TabsContent value="employment" className="outline-none">
                            <Card>
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield size={18} /> Employment Details</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input label="Employee ID" value={data.employee_id || ""} disabled />
                                        <Input label="Job Title" value={data.role_title || ""} disabled />
                                        <Input label="Access Level" value={data.role || role || ""} className="capitalize" disabled />
                                        <Input label="Employment Type" value={data.employment_type?.replace("_", " ") || ""} className="capitalize" disabled />
                                        <Input label="Current Base Rate" value={data.current_rate?.weekday_rate ? `$${data.current_rate.weekday_rate.toFixed(2)}/hr` : "Not set"} disabled />
                                        <Input label="Status" value={data.status || ""} className="capitalize" disabled />
                                        {data.start_date && <Input label="Start Date" value={new Date(data.start_date).toLocaleDateString()} disabled />}
                                    </div>
                                    
                                    <div className="pt-6 mt-6 border-t border-[hsl(var(--border))]">
                                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                            <Building2 size={16} className="text-[hsl(var(--brand))]" />
                                            Bank & Identity Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Input label="Account Name" showAsterisk value={data.bank_account_name || ""} onChange={(e) => updateField("bank_account_name", e.target.value)} />
                                            <Input label="BSB Number" showAsterisk value={data.bank_bsb || ""} onChange={(e) => updateField("bank_bsb", e.target.value)} />
                                            <Input label="Account Number" showAsterisk value={data.bank_account_number || ""} onChange={(e) => updateField("bank_account_number", e.target.value)} />
                                        </div>
                                        <div className="mt-4">
                                            {data.employment_type === 'contract' ? (
                                                <Input 
                                                    label="ABN" 
                                                    showAsterisk 
                                                    value={data.abn || ""} 
                                                    onChange={(e) => updateField("abn", e.target.value)} 
                                                    placeholder="Format: 00 000 000 000"
                                                />
                                            ) : (
                                                <Input 
                                                    label="TFN" 
                                                    showAsterisk 
                                                    value={data.tfn || ""} 
                                                    onChange={(e) => updateField("tfn", e.target.value)} 
                                                    placeholder="Format: 000 000 000"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    
                                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-6 bg-[hsl(var(--muted))]/30 p-3 rounded-lg border border-[hsl(var(--border))]/50">
                                        Note: Job and roster details are managed by your employer. Bank and identity details can be updated directly.
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {role === 'owner' && (
                        <TabsContent value="business" className="outline-none">
                            <Card>
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 size={18} /> Business Information</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input label="Business Name" value={data.Business?.business_name || ""} onChange={(e) => updateBusinessField("business_name", e.target.value)} />
                                        <Input label="ABN (Australian Business Number)" value={data.Business?.abn || ""} onChange={(e) => updateBusinessField("abn", e.target.value)} />
                                        <Input label="Registered State" value={data.Business?.state || ""} onChange={(e) => updateBusinessField("state", e.target.value)} />
                                        <div className="sm:col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-[hsl(var(--border))] mt-2">
                                            <div className="pt-2">
                                                <h4 className="text-sm font-semibold mb-3">Labour Thresholds</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input label="Min %" type="number" step="0.1" value={data.Business?.labour_threshold_min || ""} onChange={(e) => updateBusinessField("labour_threshold_min", e.target.value)} />
                                                    <Input label="Max %" type="number" step="0.1" value={data.Business?.labour_theshold_max || ""} onChange={(e) => updateBusinessField("labour_theshold_max", e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4">Click Save Changes to update business information.</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </DashboardLayout>
    );
}