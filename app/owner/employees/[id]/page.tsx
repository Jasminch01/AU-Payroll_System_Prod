"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut, apiPost, apiDelete, apiPatch } from "@/lib/api-client";
import { toast } from "sonner";
import {
    MoveLeft, Save, Trash2, User, Shield, FileText,
    Plus, Clock, Calendar, Briefcase, CalendarClock, Edit3
} from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { EmployeeShifts } from "./components/employee-shifts";
import { EmployeeTimesheets } from "./components/employee-timesheets";
import { EmployeeLeave } from "./components/employee-leave";

export default function OwnerEmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const employeeId = params.id as string;

    // Get initial tab from search params
    const initialTab = searchParams.get('tab') || 'overview';
    const [activeTab, setActiveTab] = useState(initialTab);

    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<any>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    // Rate update state
    const [rateOpen, setRateOpen] = useState(false);
    const [newRate, setNewRate] = useState("");
    const [effectiveFrom, setEffectiveFrom] = useState("");
    const [saturdayMultiplier, setSaturdayMultiplier] = useState("1.25");
    const [sundayMultiplier, setSundayMultiplier] = useState("1.50");
    const [publicHolidayMultiplier, setPublicHolidayMultiplier] = useState("2.50");
    const [eveningRate, setEveningRate] = useState("");
    const [eveningStartTime, setEveningStartTime] = useState("");
    const [eveningEndTime, setEveningEndTime] = useState("");
    const [editingRateId, setEditingRateId] = useState<string | null>(null);

    // Reset password state
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState("");

    // Reset password form when dialog closes
    useEffect(() => {
        if (!resetModalOpen) {
            setResetPassword("");
        }
    }, [resetModalOpen]);

    // Reset rate form when dialog closes
    useEffect(() => {
        if (!rateOpen) {
            setEditingRateId(null);
            setNewRate("");
            setEffectiveFrom("");
            setSaturdayMultiplier("1.25");
            setSundayMultiplier("1.50");
            setPublicHolidayMultiplier("2.50");
            setEveningRate("");
            setEveningStartTime("");
            setEveningEndTime("");
        }
    }, [rateOpen]);

    const { data: employee, isLoading: isLoadingEmployee } = useQuery({
        queryKey: ["employee", employeeId],
        queryFn: () => apiGet<any>(`/employees/${employeeId}`),
        enabled: !!employeeId,
    });



    const { data: rateHistory, isLoading: isLoadingRates } = useQuery({
        queryKey: ["employeeRates", employeeId],
        queryFn: () => apiGet<any[]>(`/employees/${employeeId}/rates`),
        enabled: !!employeeId,
    });

    // Initialize form data when employee loads
    useEffect(() => {
        if (employee && !formData) {
            // Normalize the employee data to handle both old and new field names
            const normalizedData = {
                ...employee,
                // Handle date_of_birth vs dob
                date_of_birth: employee.date_of_birth || employee.dob || "",
                // Handle bank details - use individual fields
                bank_account_name: employee.bank_account_name || "",
                bank_bsb: employee.bank_bsb || "",
                bank_account_number: employee.bank_account_number || "",
                abn: employee.abn || "",
                tfn: employee.tfn || "",
                can_order_liquor: employee.can_order_liquor ?? false,
            };

            setFormData(normalizedData);
        }
    }, [employee, formData]);

    // Handle initial tab update if search params change
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => {

            return apiPut(`/employees/${employeeId}`, data);
        },
        onSuccess: () => {
            toast.success("Employee updated");
            queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setEditing(false);
            setFormData(null); // Will reload from query
        },
        onError: (err: Error) => {

            toast.error(err.message);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiDelete(`/employees/${employeeId}?hard=true`),
        onSuccess: () => {
            toast.success("Employee permanently deleted from the system");
            router.push("/owner/employees");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateRateMutation = useMutation({
        mutationFn: (data: any) => {
            if (editingRateId) {
                return apiPatch(`/employees/${employeeId}/rates`, { ...data, rate_history_id: editingRateId });
            }
            return apiPost(`/employees/${employeeId}/rates`, data);
        },
        onSuccess: () => {
            toast.success(editingRateId ? "Pay rate updated" : "Pay rate added");
            queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
            queryClient.invalidateQueries({ queryKey: ["employeeRates", employeeId] });
            setRateOpen(false);
            setEditingRateId(null);
            setNewRate("");
            setEffectiveFrom("");
            setSaturdayMultiplier("1.25");
            setSundayMultiplier("1.50");
            setPublicHolidayMultiplier("2.50");
            setEveningRate("");
            setEveningStartTime("");
            setEveningEndTime("");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const resetPasswordMutation = useMutation({
        mutationFn: (password: string) => {
            return apiPost(`/employees/${employeeId}/reset-password`, { password });
        },
        onSuccess: () => {
            toast.success("Password successfully reset");
            setResetModalOpen(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to reset password");
        },
    });

    const handleResetPassword = () => {
        if (resetPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        resetPasswordMutation.mutate(resetPassword);
    };

    const handleSave = () => {
        if (!formData || !employee) return;

        // Validation: If adding email to an account without user_id, password is required
        if (formData.email && !employee.user_id && (!formData.password || formData.password.trim() === '')) {
            toast.error("A password is required to create a system login account for this employee.");
            return;
        }
        if (formData.email && !employee.user_id && formData.password && formData.password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        // Only send fields that have changed
        const dataToSend: any = {};
        const fieldsToCompare = [
            'first_name', 'last_name', 'email', 'phone', 'date_of_birth',
            'emergency_contact_name', 'emergency_contact_phone',
            'bank_account_name', 'bank_bsb', 'bank_account_number',
            'abn', 'tfn', 'role_title', 'role', 'employment_type',
            'pay_cycle', 'status', 'can_order_liquor', 'password'
        ];

        fieldsToCompare.forEach(field => {
            const newValue = formData[field];
            // Normalize original value for comparison (e.g., date_of_birth vs dob)
            let originalValue = employee[field];
            if (field === 'date_of_birth' && originalValue === undefined) {
                originalValue = employee.dob;
            }

            // Treat null, undefined, and empty string as equivalent for comparison
            const normalizedNew = (newValue === null || newValue === undefined || newValue === "") ? null : newValue;
            const normalizedOld = (originalValue === null || originalValue === undefined || originalValue === "") ? null : originalValue;

            if (normalizedNew !== normalizedOld) {
                dataToSend[field] = newValue;
            }
        });

        if (Object.keys(dataToSend).length === 0) {
            setEditing(false);
            return;
        }

        updateMutation.mutate(dataToSend);
    };

    const updateField = (field: string, value: any) => {

        setFormData((prev: any) => ({ ...prev, [field]: value }));
        // Enable editing mode when any field is touched
        if (!editing) {
            setEditing(true);
        }
    };

    if (isLoadingEmployee) {
        return (
            <DashboardLayout role="owner" pageTitle="Employee" pageDescription="Loading...">
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
            </DashboardLayout>
        );
    }

    if (!employee) {
        return (
            <DashboardLayout role="owner" pageTitle="Employee Not Found">
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-[hsl(var(--muted-foreground))]">Employee not found</p>
                        <Button className="mt-4" onClick={() => router.back()}>
                            <MoveLeft size={24} strokeWidth={2} className="mr-2" /> Back
                        </Button>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    const data = formData || employee;


    return (
        <DashboardLayout role="owner" pageTitle="" pageDescription="" actions={null}>
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/30 w-10 h-10 rounded-full transition-colors"
                >
                    <MoveLeft size={28} strokeWidth={2.5} />
                </Button>

                <div className="flex flex-col lg:flex-row bg-[hsl(var(--background))] rounded-xl border border-[hsl(var(--border))] lg:overflow-hidden lg:h-[calc(100vh-120px)] relative">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col lg:flex-row h-full">
                        {/* Minimal Sidebar Navigation */}
                        <div className="w-full lg:w-64 bg-[hsl(var(--muted))]/20 flex flex-col shrink-0 border-b lg:border-b-0 lg:border-r border-[hsl(var(--border))]">
                            {/* Profile Info Section */}
                            <div className="p-4 lg:p-6">
                                <div className="flex flex-row lg:flex-col items-center lg:text-center gap-4 lg:space-y-4 mb-2 lg:mb-8">
                                    <div className="relative">
                                        <div className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-2xl bg-[hsl(var(--brand))] text-white text-2xl lg:text-3xl font-bold shadow-sm">
                                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1">
                                            <StatusBadge status={employee.status} className="h-5 lg:h-6 border-2 border-[hsl(var(--background))] px-1.5 lg:px-2 text-[9px] lg:text-[10px]" />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-base lg:text-lg font-bold text-[hsl(var(--foreground))] leading-tight truncate">
                                            {employee.first_name} {employee.last_name}
                                        </h1>
                                        <p className="text-[10px] lg:text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                            {employee.role_title || 'Employee'}
                                            {employee.role && <span className="opacity-70 ml-1">({employee.role})</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-3 pb-3 lg:pb-0 flex-1 overflow-x-auto lg:overflow-x-visible no-scrollbar">
                                <TabsList className="flex flex-row lg:flex-col h-auto bg-transparent p-0 gap-1 items-center lg:items-stretch w-max lg:w-full">
                                    <TabsTrigger value="overview" className="justify-start px-4 py-2 lg:py-2.5 rounded-lg data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--brand))] data-[state=active]:border-[hsl(var(--border))] transition-all text-xs lg:text-sm font-medium gap-2 lg:gap-3 hover:bg-[hsl(var(--muted))]/30 border border-transparent whitespace-nowrap">
                                        <User size={16} className="shrink-0 lg:w-[18px] lg:h-[18px]" />
                                        <span>Personal</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="employment" className="justify-start px-4 py-2 lg:py-2.5 rounded-lg data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--brand))] data-[state=active]:border-[hsl(var(--border))] transition-all text-xs lg:text-sm font-medium gap-2 lg:gap-3 hover:bg-[hsl(var(--muted))]/30 border border-transparent whitespace-nowrap">
                                        <Briefcase size={16} className="shrink-0 lg:w-[18px] lg:h-[18px]" />
                                        <span>Employment</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="shifts" className="justify-start px-4 py-2 lg:py-2.5 rounded-lg data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--brand))] data-[state=active]:border-[hsl(var(--border))] transition-all text-xs lg:text-sm font-medium gap-2 lg:gap-3 hover:bg-[hsl(var(--muted))]/30 border border-transparent whitespace-nowrap">
                                        <CalendarClock size={16} className="shrink-0 lg:w-[18px] lg:h-[18px]" />
                                        <span>Roster</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="timesheets" className="justify-start px-4 py-2 lg:py-2.5 rounded-lg data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--brand))] data-[state=active]:border-[hsl(var(--border))] transition-all text-xs lg:text-sm font-medium gap-2 lg:gap-3 hover:bg-[hsl(var(--muted))]/30 border border-transparent whitespace-nowrap">
                                        <Clock size={16} className="shrink-0 lg:w-[18px] lg:h-[18px]" />
                                        <span>Timesheets</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="leave" className="justify-start px-4 py-2 lg:py-2.5 rounded-lg data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--brand))] data-[state=active]:border-[hsl(var(--border))] transition-all text-xs lg:text-sm font-medium gap-2 lg:gap-3 hover:bg-[hsl(var(--muted))]/30 border border-transparent whitespace-nowrap">
                                        <Calendar size={16} className="shrink-0 lg:w-[18px] lg:h-[18px]" />
                                        <span>Leave</span>
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </div>

                        {/* Simple Content Area */}
                        <div className="flex-1 flex flex-col min-h-0 bg-[hsl(var(--background))] relative">
                            {/* Simple Actions Bar */}
                            <div className="sticky lg:absolute top-0 lg:top-6 right-0 lg:right-8 z-30 flex items-center justify-end gap-3 p-4 lg:p-0 bg-[hsl(var(--background))]/80 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-b lg:border-b-0 border-[hsl(var(--border))]">
                                {(activeTab === 'overview' || activeTab === 'employment') && editing && (
                                    <div className="flex gap-2 w-full lg:w-auto">
                                        <Button
                                            variant="outline"
                                            className="flex-1 lg:flex-none rounded-lg px-4 h-9 text-xs"
                                            onClick={() => {
                                                setEditing(false);
                                                // Reset to original employee data
                                                const normalizedData = {
                                                    ...employee,
                                                    date_of_birth: employee.date_of_birth || employee.dob || "",
                                                    bank_account_name: employee.bank_account_name || "",
                                                    bank_bsb: employee.bank_bsb || "",
                                                    bank_account_number: employee.bank_account_number || "",
                                                    abn: employee.abn || "",
                                                    tfn: employee.tfn || "",
                                                };
                                                setFormData(normalizedData);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="flex-1 lg:flex-none rounded-lg px-4 h-9 font-bold bg-[hsl(var(--brand))] text-white text-xs"
                                            onClick={handleSave}
                                            loading={updateMutation.isPending}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Scrollable Tab Content */}
                            <div className="flex-1 overflow-y-auto pt-4 lg:pt-16 custom-scrollbar">
                                <div className="w-full mx-auto px-4 lg:px-8 pb-16">
                                    <TabsContent value="overview" className="mt-0 space-y-8 lg:space-y-12">
                                        <Tabs defaultValue="general" className="w-full">
                                            <div className="flex justify-center mb-6 lg:mb-8 overflow-x-auto no-scrollbar">
                                                <TabsList className="bg-[hsl(var(--muted))]/30 p-1 rounded-lg w-max flex">
                                                    <TabsTrigger value="general" className="rounded-md px-4 lg:px-6 py-1.5 text-[10px] lg:text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm whitespace-nowrap">General</TabsTrigger>
                                                    <TabsTrigger value="auth" className="rounded-md px-4 lg:px-6 py-1.5 text-[10px] lg:text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm whitespace-nowrap">Security</TabsTrigger>
                                                    <TabsTrigger value="compliance" className="rounded-md px-4 lg:px-6 py-1.5 text-[10px] lg:text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm whitespace-nowrap">Documents</TabsTrigger>
                                                </TabsList>
                                            </div>

                                            <TabsContent value="general" className="mt-0 space-y-10">
                                                <section className="space-y-6">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Identity & Contact</h3>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Core information used for identification.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        <Input label="Employee ID" value={data.employee_id || ""} disabled={true} />
                                                        <Input label="First Name" showAsterisk value={data.first_name || ""} onChange={(e) => updateField("first_name", e.target.value)} />
                                                        <Input label="Last Name" showAsterisk value={data.last_name || ""} onChange={(e) => updateField("last_name", e.target.value)} />
                                                        <Input label="Email Address" showAsterisk type="email" value={data.email || ""} onChange={(e) => updateField("email", e.target.value)} />
                                                        {!employee.user_id && data.email && (
                                                            <Input 
                                                                label="Set Account Password" 
                                                                showAsterisk 
                                                                type="password" 
                                                                placeholder="Min. 6 characters" 
                                                                value={data.password || ""} 
                                                                onChange={(e) => updateField("password", e.target.value)} 
                                                            />
                                                        )}
                                                        <Input label="Phone Number" value={data.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                                                        <Input
                                                            label="Date of Birth"
                                                            type={data.date_of_birth ? "date" : "text"}
                                                            placeholder="Not Set"
                                                            value={data.date_of_birth || ""}
                                                            onFocus={(e) => e.target.type = 'date'}
                                                            onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                                                            onChange={(e) => updateField("date_of_birth", e.target.value)}
                                                        />
                                                    </div>
                                                </section>

                                                <section className="space-y-6 pt-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Emergency Contacts</h3>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Contacts to reach in case of emergency.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <Input label="Primary Contact Name" value={data.emergency_contact_name || ""} onChange={(e) => updateField("emergency_contact_name", e.target.value)} />
                                                        <Input label="Primary Contact Phone" value={data.emergency_contact_phone || ""} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} />
                                                    </div>
                                                </section>
                                            </TabsContent>

                                            <TabsContent value="auth" className="mt-0">
                                                <div className="space-y-6">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Security & System Permissions</h3>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage access controls and special feature permissions.</p>
                                                    </div>

                                                    {data.role === 'manager' ? (
                                                        <Card className="border border-[hsl(var(--border))] bg-white">
                                                            <CardContent className="p-6 flex items-center justify-between gap-6">
                                                                <div className="space-y-1 max-w-lg">
                                                                    <p className="font-bold text-sm text-[hsl(var(--foreground))]">Liquor Ordering Authorization</p>
                                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                                                                        Allow this manager to finalize daily liquor/alcohol orders. If disabled, they can count liquor stock, but cannot submit the replenishment order to liquor suppliers.
                                                                    </p>
                                                                </div>
                                                                <Switch
                                                                    checked={!!data.can_order_liquor}
                                                                    onCheckedChange={(val) => {
                                                                        updateField("can_order_liquor", val);
                                                                    }}
                                                                />
                                                            </CardContent>
                                                        </Card>
                                                    ) : (
                                                        <div className="text-center p-8 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5">
                                                            <Shield size={32} className="text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-3" />
                                                            <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium">Standard Employee Permissions</p>
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
                                                                Standard employee accounts cannot manage catalogs, setup suppliers, or place liquor orders. Permissions can be set if their System Access Level is upgraded to Manager.
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Password Reset Section */}
                                                    <Card className="border border-[hsl(var(--border))] bg-white">
                                                        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                                            <div className="space-y-1 max-w-lg">
                                                                <p className="font-bold text-sm text-[hsl(var(--foreground))]">Reset Account Password</p>
                                                                {data.user_id ? (
                                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                                                                        Force update the password for this user's account. They will use the new password on their next sign in.
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-200/50 leading-relaxed">
                                                                        No login account exists for this employee. Users must have a system account (linked email) to reset their password.
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                disabled={!data.user_id}
                                                                onClick={() => setResetModalOpen(true)}
                                                                className="text-xs shrink-0 rounded-lg"
                                                            >
                                                                Reset Password
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="compliance" className="mt-0">
                                                <div className="space-y-6">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Compliance & Certifications</h3>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Active qualifications and documentation.</p>
                                                    </div>
                                                    {data.certificates && data.certificates.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {data.certificates.map((cert: any) => (
                                                                <div key={cert.certificate_id} className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-white shadow-sm">
                                                                    <div>
                                                                        <p className="font-bold text-sm">{cert.name}</p>
                                                                        {cert.expiry_date && (
                                                                            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">Expires: {new Date(cert.expiry_date).toLocaleDateString()}</p>
                                                                        )}
                                                                    </div>
                                                                    <StatusBadge status={cert.expiry_date && new Date(cert.expiry_date) < new Date() ? "expired" : "active"} className="px-2 py-0.5" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center p-12 rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/5">
                                                            <FileText size={32} className="text-[hsl(var(--muted-foreground))] opacity-30 mx-auto mb-3" />
                                                            <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium">No documentation records found</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </TabsContent>
                                        </Tabs>

                                        {/* Dangerous Zone */}
                                        <div className="pt-8 lg:pt-12 border-t border-[hsl(var(--border))]">
                                            <div className="bg-[hsl(var(--danger-light))]/10 rounded-xl p-6 lg:p-8 border border-[hsl(var(--danger))]/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="space-y-2">
                                                    <h3 className="text-sm lg:text-base font-bold text-[hsl(var(--danger))] flex items-center gap-2 uppercase tracking-wide">
                                                        <Trash2 size={16} className="lg:w-[18px] lg:h-[18px]" /> Danger Zone
                                                    </h3>
                                                    <div>
                                                        <p className="text-xs lg:text-sm font-bold text-[hsl(var(--foreground))]">Permanent Account Deletion</p>
                                                        <p className="text-[10px] lg:text-xs text-[hsl(var(--muted-foreground))] max-w-md leading-relaxed">
                                                            This will permanently remove the employee and all historical data. This action cannot be undone.
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="danger"
                                                    className="shrink-0 rounded-lg px-6 h-10 font-bold text-xs w-full lg:w-auto"
                                                    onClick={() => {
                                                        setDeleteConfirmText("");
                                                        setDeleteModalOpen(true);
                                                    }}
                                                    loading={deleteMutation.isPending}
                                                >
                                                    Delete Record
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="employment" className="mt-0 space-y-12">
                                        <section className="space-y-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Employment Structure</h3>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Role and contractual details.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Input label="Position / Role (Job Title)" value={data.role_title || ""} onChange={(e) => updateField("role_title", e.target.value)} />
                                                <div className="space-y-1.5 focus-within:text-[hsl(var(--brand))] transition-colors group">
                                                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] ml-0.5 group-focus-within:text-[hsl(var(--brand))]">
                                                        System Access Level <span className="text-[#FF4A4A]">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={data.role || "employee"}
                                                            onChange={(e) => updateField("role", e.target.value)}
                                                            className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 appearance-none capitalize cursor-pointer font-medium"
                                                        >
                                                            <option value="employee">Employee</option>
                                                            <option value="supervisor">Supervisor</option>
                                                            <option value="manager">Manager</option>
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[hsl(var(--muted-foreground))]">
                                                            <Shield size={14} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] ml-0.5">
                                                        Employment Basis <span className={cn(
                                                            "ml-0.5 transition-colors duration-200",
                                                            data.employment_type ? "text-[hsl(var(--foreground))]" : "text-[#FF4A4A]"
                                                        )}>*</span>
                                                    </label>
                                                    <select
                                                        value={data.employment_type || "full_time"}
                                                        onChange={(e) => updateField("employment_type", e.target.value)}
                                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 appearance-none"
                                                    >
                                                        <option value="full_time">Full Time</option>
                                                        <option value="part_time">Part Time</option>
                                                        <option value="casual">Casual</option>
                                                        <option value="contract">Contract</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] ml-0.5">
                                                        Pay Cycle <span className={cn(
                                                            "ml-0.5 transition-colors duration-200",
                                                            data.pay_cycle ? "text-[hsl(var(--foreground))]" : "text-[#FF4A4A]"
                                                        )}>*</span>
                                                    </label>
                                                    <select
                                                        value={data.pay_cycle || ""}
                                                        onChange={(e) => updateField("pay_cycle", e.target.value)}
                                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 appearance-none"
                                                    >
                                                        <option value="" disabled>Not Set</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="fortnightly">Fortnightly</option>
                                                        <option value="monthly">Monthly</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] ml-0.5">Lifecycle Status</label>
                                                    <select
                                                        value={data.status || "active"}
                                                        onChange={(e) => updateField("status", e.target.value)}
                                                        disabled={data.status === 'invited'}
                                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 appearance-none"
                                                    >
                                                        <option value="active">Active Service</option>
                                                        <option value="inactive">Inactive</option>
                                                        <option value="invited" disabled>Awaiting Onboarding</option>
                                                    </select>
                                                    {data.status === 'invited' && <p className="text-[10px] text-[hsl(var(--muted-foreground))] pt-1 ml-0.5">Locked until onboarding complete.</p>}
                                                </div>
                                                <Input
                                                    label="TFN"
                                                    showAsterisk
                                                    value={data.tfn || ""}
                                                    onChange={(e) => updateField("tfn", e.target.value)}
                                                    placeholder="Format: 000 000 000"
                                                />
                                            </div>
                                        </section>

                                        <section className="space-y-6 pt-6 border-t border-[hsl(var(--border))]">
                                            <div>
                                                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Bank & Identity</h3>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Financial details for payroll processing.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <Input label="Account Name" value={data.bank_account_name || ""} onChange={(e) => updateField("bank_account_name", e.target.value)} />
                                                <Input label="BSB Number" value={data.bank_bsb || ""} onChange={(e) => updateField("bank_bsb", e.target.value)} />
                                                <Input label="Account Number" value={data.bank_account_number || ""} onChange={(e) => updateField("bank_account_number", e.target.value)} />
                                                {data.employment_type === 'contract' && (
                                                    <Input
                                                        label="ABN"
                                                        showAsterisk
                                                        value={data.abn || ""}
                                                        onChange={(e) => updateField("abn", e.target.value)}
                                                        placeholder="Format: 00 000 000 000"
                                                    />
                                                )}
                                            </div>
                                        </section>

                                        <section className="space-y-6 pt-6 border-t border-[hsl(var(--border))]">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Pay Scale History</h3>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Historical record of hourly rates.</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="rounded-lg px-4"
                                                    onClick={() => {
                                                        setEditingRateId(null);
                                                        setNewRate("");
                                                        setEffectiveFrom("");
                                                        setSaturdayMultiplier("1.25");
                                                        setSundayMultiplier("1.50");
                                                        setPublicHolidayMultiplier("2.50");
                                                        setEveningRate("");
                                                        setEveningStartTime("");
                                                        setEveningEndTime("");
                                                        setRateOpen(true);
                                                    }}
                                                >
                                                    <Plus size={14} className="mr-2" /> Add Rate
                                                </Button>
                                            </div>

                                            <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm bg-white">
                                                {/* Desktop Table */}
                                                <div className="hidden lg:block overflow-x-auto no-scrollbar">
                                                    <table className="w-full text-sm text-left">
                                                        <thead>
                                                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 text-xs font-bold uppercase text-[hsl(var(--muted-foreground))]">
                                                                <th className="px-6 py-4">Effective</th>
                                                                <th className="px-6 py-4">Status</th>
                                                                <th className="px-6 py-4">Base Rate</th>
                                                                <th className="px-6 py-4">Sat Multi</th>
                                                                <th className="px-6 py-4">Sun Multi</th>
                                                                <th className="px-6 py-4">Holi Multi</th>
                                                                <th className="px-6 py-4">Eve Rate</th>
                                                                <th className="px-6 py-4">Eve Window</th>
                                                                <th className="px-6 py-4 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[hsl(var(--border))]">
                                                            {isLoadingRates ? (
                                                                <tr><td colSpan={9} className="px-6 py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</td></tr>
                                                            ) : rateHistory && rateHistory.length > 0 ? (
                                                                rateHistory.map((rate: any) => (
                                                                    <tr key={rate.rate_history_id} className="hover:bg-[hsl(var(--muted))]/5 transition-colors">
                                                                        <td className="px-6 py-4 font-medium">{new Date(rate.effective_from).toLocaleDateString()}</td>
                                                                        <td className="px-6 py-4">
                                                                            {rate.effective_to ? (
                                                                                <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/20 px-2 py-0.5 rounded">Past</span>
                                                                            ) : (
                                                                                <span className="text-[10px] font-bold text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 px-2 py-0.5 rounded">Current</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 font-bold text-[hsl(var(--brand))]">${rate.weekday_rate?.toFixed(2)}/hr</td>
                                                                        <td className="px-6 py-4 text-xs">{rate.saturday_multiplier}x</td>
                                                                        <td className="px-6 py-4 text-xs">{rate.sunday_multiplier}x</td>
                                                                        <td className="px-6 py-4 text-xs">{rate.public_holiday_multiplier}x</td>
                                                                        <td className="px-6 py-4 text-xs">{rate.evening_rate ? `$${rate.evening_rate.toFixed(2)}` : "—"}</td>
                                                                        <td className="px-6 py-4 text-xs">
                                                                            {rate.evening_start_time !== null && rate.evening_end_time !== null
                                                                                ? `${rate.evening_start_time}:00 - ${rate.evening_end_time}:00`
                                                                                : "—"}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                onClick={() => {
                                                                                    setEditingRateId(rate.rate_history_id);
                                                                                    setNewRate(rate.weekday_rate.toString());
                                                                                    setEffectiveFrom(rate.effective_from);
                                                                                    setSaturdayMultiplier(rate.saturday_multiplier.toString());
                                                                                    setSundayMultiplier(rate.sunday_multiplier.toString());
                                                                                    setPublicHolidayMultiplier(rate.public_holiday_multiplier?.toString() || "2.50");
                                                                                    setEveningRate(rate.evening_rate?.toString() || "");
                                                                                    setEveningStartTime(rate.evening_start_time?.toString() || "");
                                                                                    setEveningEndTime(rate.evening_end_time?.toString() || "");
                                                                                    setRateOpen(true);
                                                                                }}
                                                                            >
                                                                                <Edit3 size={14} className="text-[hsl(var(--muted-foreground))]" />
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr><td colSpan={9} className="px-6 py-12 text-center text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-widest">No history found</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile Card List */}
                                                <div className="lg:hidden divide-y divide-[hsl(var(--border))]">
                                                    {isLoadingRates ? (
                                                        <div className="p-8 text-center text-xs text-[hsl(var(--muted-foreground))]">Loading...</div>
                                                    ) : rateHistory && rateHistory.length > 0 ? (
                                                        rateHistory.map((rate: any) => (
                                                            <div key={rate.rate_history_id} className="p-4 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Effective Date</p>
                                                                        <p className="font-bold text-sm">{new Date(rate.effective_from).toLocaleDateString()}</p>
                                                                    </div>
                                                                    {rate.effective_to ? (
                                                                        <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/20 px-2 py-0.5 rounded">Past</span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 px-2 py-0.5 rounded">Current</span>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 pt-2">
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Base Rate</p>
                                                                        <p className="font-bold text-[hsl(var(--brand))]">${rate.weekday_rate?.toFixed(2)}/hr</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Weekend Multipliers</p>
                                                                        <p className="text-xs">Sat: {rate.saturday_multiplier}x · Sun: {rate.sunday_multiplier}x</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between pt-2">
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Evening Rate</p>
                                                                        <p className="text-xs">{rate.evening_rate ? `$${rate.evening_rate.toFixed(2)} (${rate.evening_start_time}:00-${rate.evening_end_time}:00)` : "No evening rate"}</p>
                                                                    </div>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 rounded-lg text-[10px]"
                                                                        onClick={() => {
                                                                            setEditingRateId(rate.rate_history_id);
                                                                            setNewRate(rate.weekday_rate.toString());
                                                                            setEffectiveFrom(rate.effective_from);
                                                                            setSaturdayMultiplier(rate.saturday_multiplier.toString());
                                                                            setSundayMultiplier(rate.sunday_multiplier.toString());
                                                                            setPublicHolidayMultiplier(rate.public_holiday_multiplier?.toString() || "2.50");
                                                                            setEveningRate(rate.evening_rate?.toString() || "");
                                                                            setEveningStartTime(rate.evening_start_time?.toString() || "");
                                                                            setEveningEndTime(rate.evening_end_time?.toString() || "");
                                                                            setRateOpen(true);
                                                                        }}
                                                                    >
                                                                        Edit Rate
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-widest">No history found</div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </TabsContent>

                                    <TabsContent value="shifts" className="mt-0 animate-in slide-in-from-right-4 duration-300">
                                        <EmployeeShifts employeeId={employeeId} />
                                    </TabsContent>

                                    <TabsContent value="timesheets" className="mt-0 animate-in slide-in-from-right-4 duration-300">
                                        <EmployeeTimesheets employeeId={employeeId} />
                                    </TabsContent>

                                    <TabsContent value="leave" className="mt-0 animate-in slide-in-from-right-4 duration-300">
                                        <EmployeeLeave employeeId={employeeId} />
                                    </TabsContent>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* Pay Rate Dialog - Unchanged Logic */}
            <Dialog open={rateOpen} onOpenChange={setRateOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingRateId ? "Edit Pay Rate" : "Add New Pay Rate"}</DialogTitle>
                        <DialogDescription>
                            {editingRateId
                                ? "Update the details of this existing rate record."
                                : "Set a new base hourly rate and advanced multipliers."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input label="New Base Rate ($/hr)" type="number" placeholder="e.g. 30.50" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
                            <Input label="Effective From" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                        </div>
                        <div className="pt-2 border-t border-[hsl(var(--border))]">
                            <h4 className="text-sm font-semibold mb-3">Multipliers (Optional)</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <Input label="Saturday (x)" type="number" step="0.01" value={saturdayMultiplier} onChange={(e) => setSaturdayMultiplier(e.target.value)} placeholder="1.25" />
                                <Input label="Sunday (x)" type="number" step="0.01" value={sundayMultiplier} onChange={(e) => setSundayMultiplier(e.target.value)} placeholder="1.50" />
                                <Input label="Holiday (x)" type="number" step="0.01" value={publicHolidayMultiplier} onChange={(e) => setPublicHolidayMultiplier(e.target.value)} placeholder="2.50" />
                            </div>
                        </div>
                        <div className="pt-2 border-t border-[hsl(var(--border))]">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold">Evening Rates (Flat Rate)</h4>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))] italic max-w-[200px] text-right underline underline-offset-4 decoration-[hsl(var(--brand))]/30">
                                    Flat rate replaces base rate during this window
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Input label="Eve Rate ($/hr)" type="number" step="0.01" value={eveningRate} onChange={(e) => setEveningRate(e.target.value)} placeholder="e.g. 35.00" />
                                </div>
                                <div className="space-y-1.5">
                                    <Input label="Eve Start" type="number" value={eveningStartTime} onChange={(e) => setEveningStartTime(e.target.value)} placeholder="18" />
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] text-center">24h format (e.g. 18 = 6 PM)</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Input label="Eve End" type="number" value={eveningEndTime} onChange={(e) => setEveningEndTime(e.target.value)} placeholder="23" />
                                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] text-center">24h format (e.g. 23 = 11 PM)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (!newRate || !effectiveFrom) {
                                    toast.error("Please fill base rate and effective date");
                                    return;
                                }
                                updateRateMutation.mutate({
                                    weekday_rate: parseFloat(newRate),
                                    effective_from: effectiveFrom,
                                    saturday_multiplier: saturdayMultiplier ? parseFloat(saturdayMultiplier) : undefined,
                                    sunday_multiplier: sundayMultiplier ? parseFloat(sundayMultiplier) : undefined,
                                    public_holiday_multiplier: publicHolidayMultiplier ? parseFloat(publicHolidayMultiplier) : undefined,
                                    evening_rate: eveningRate ? parseFloat(eveningRate) : undefined,
                                    evening_start_time: eveningStartTime ? parseInt(eveningStartTime) : undefined,
                                    evening_end_time: eveningEndTime ? parseInt(eveningEndTime) : undefined,
                                });
                            }}
                            loading={updateRateMutation.isPending}
                        >
                            <Save size={16} className="mr-2" /> Save Rate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Confirm Deletion</DialogTitle>
                        <DialogDescription className="text-sm text-[hsl(var(--muted-foreground))] pt-1">
                            Are you sure you want to delete <span className="font-semibold text-[hsl(var(--foreground))]">{employee.first_name} {employee.last_name}</span>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1 font-bold"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate()}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Reset Modal */}
            <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Reset Password</DialogTitle>
                        <DialogDescription className="text-sm text-[hsl(var(--muted-foreground))] pt-1">
                            Set a new password for <span className="font-semibold text-[hsl(var(--foreground))]">{employee.first_name} {employee.last_name}</span>. It must be at least 6 characters.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-[hsl(var(--foreground))]">New Password</label>
                            <Input
                                type="password"
                                placeholder="Enter at least 6 characters"
                                value={resetPassword}
                                onChange={(e) => setResetPassword(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setResetModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 font-bold bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand-hover))]"
                            loading={resetPasswordMutation.isPending}
                            disabled={resetPassword.length < 6}
                            onClick={handleResetPassword}
                        >
                            Reset Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}