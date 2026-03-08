"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut, apiPost, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, User, Phone, Mail, DollarSign, Shield, FileText, Plus, Lock, Clock, Calendar, Briefcase, CalendarClock } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeShifts } from "./components/employee-shifts";
import { EmployeeTimesheets } from "./components/employee-timesheets";
import { EmployeeLeave } from "./components/employee-leave";

export default function OwnerEmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const employeeId = params.id as string;

    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<any>(null);

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
    React.useEffect(() => {
        if (employee && !formData) {
            setFormData({ ...employee });
        }
    }, [employee, formData]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => apiPut(`/employees/${employeeId}`, data),
        onSuccess: () => {
            toast.success("Employee updated");
            queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setEditing(false);
            setFormData(null); // Will reload from query
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiDelete(`/employees/${employeeId}`),
        onSuccess: () => {
            toast.success("Employee removed");
            router.push("/owner/employees");
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updateRateMutation = useMutation({
        mutationFn: (data: any) => apiPost(`/employees/${employeeId}/rates`, data),
        onSuccess: () => {
            toast.success("Pay rate updated");
            queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
            queryClient.invalidateQueries({ queryKey: ["employeeRates", employeeId] });
            setRateOpen(false);
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

    const handleSave = () => {
        if (!formData) return;
        updateMutation.mutate({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            dob: formData.dob,
            bank_details: formData.bank_details,
            emergency_contact_name: formData.emergency_contact_name,
            emergency_contact_phone: formData.emergency_contact_phone,
            role_title: formData.role_title,
            employment_type: formData.employment_type,
            pay_cycle: formData.pay_cycle,
            status: formData.status,
            kiosk_pin: formData.kiosk_pin,
        });
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
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
                        <Button className="mt-4" onClick={() => router.push("/owner/employees")}>
                            <ArrowLeft size={16} /> Back to Employees
                        </Button>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    const data = formData || employee;

    return (
        <DashboardLayout
            role="owner"
            pageTitle=""
            pageDescription=""
            actions={null}
        >
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.push("/owner/employees")} className="flex items-center gap-2 -ml-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                    <ArrowLeft size={16} /> Back to Employees
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Summary */}
                    <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-[hsl(var(--brand))]/10 via-transparent to-transparent">
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                            <div className="relative">
                                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-4xl font-bold border-8 border-[hsl(var(--background))] shadow-2xl transition-transform hover:scale-105 duration-300">
                                    {employee.first_name?.[0]}{employee.last_name?.[0]}
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[hsl(var(--success))] border-4 border-[hsl(var(--background))] shadow-sm" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{employee.first_name} {employee.last_name}</h1>
                                <p className="text-[hsl(var(--muted-foreground))] font-medium mt-1 inline-flex items-center gap-2">
                                    <Shield size={16} /> {employee.role_title}
                                </p>
                                <div className="mt-2 flex justify-center">
                                    <StatusBadge status={employee.status} />
                                </div>
                            </div>

                            <div className="w-full pt-4 space-y-3 text-sm text-left border-t border-[hsl(var(--border))/20]">
                                <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30 p-2 rounded-lg">
                                    <Mail size={16} className="text-[hsl(var(--brand))]" /> {employee.email}
                                </div>
                                {employee.phone && (
                                    <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30 p-2 rounded-lg">
                                        <Phone size={16} className="text-[hsl(var(--brand))]" /> {employee.phone}
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/30 p-2 rounded-lg">
                                    <DollarSign size={16} className="text-[hsl(var(--brand))]" /> ${employee.current_rate?.weekday_rate ?? '—'}/hr
                                </div>
                            </div>

                            <div className="w-full pt-4">
                                {!editing ? (
                                    <Button className="w-full rounded-full shadow-md hover:scale-[1.02] transition-transform" size="lg" onClick={() => setEditing(true)}>Edit Profile</Button>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Button className="w-full rounded-full shadow-md" size="lg" onClick={handleSave} loading={updateMutation.isPending}><Save size={16} className="mr-2" /> Save Changes</Button>
                                        <Button className="w-full rounded-full" size="lg" variant="outline" onClick={() => { setEditing(false); setFormData({ ...employee }); }}>Cancel</Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs for content routing */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs defaultValue="overview" className="w-full">
                            <div className="flex justify-center mb-8">
                                <TabsList className="h-auto p-1.5 bg-[hsl(var(--muted))]/60 rounded-xl shadow-inner border border-[hsl(var(--border))]/50">
                                    <TabsTrigger value="overview" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"><User size={14} className="hidden sm:block" /> Overview</TabsTrigger>
                                    <TabsTrigger value="employment" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"><Briefcase size={14} className="hidden sm:block" /> Employment</TabsTrigger>
                                    <TabsTrigger value="shifts" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"><CalendarClock size={14} className="hidden sm:block" /> Shifts</TabsTrigger>
                                    <TabsTrigger value="timesheets" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"><Clock size={14} className="hidden sm:block" /> Timesheets</TabsTrigger>
                                    <TabsTrigger value="leave" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"><Calendar size={14} className="hidden sm:block" /> Leave</TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Overview Tab */}
                            <TabsContent value="overview" className="space-y-6 outline-none">
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><User size={18} /> Personal Details</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input label="First Name" value={data.first_name || ""} onChange={(e) => updateField("first_name", e.target.value)} disabled={!editing} />
                                            <Input label="Last Name" value={data.last_name || ""} onChange={(e) => updateField("last_name", e.target.value)} disabled={!editing} />
                                            <Input label="Email" type="email" value={data.email || ""} onChange={(e) => updateField("email", e.target.value)} disabled={!editing} />
                                            <Input label="Phone" value={data.phone || ""} onChange={(e) => updateField("phone", e.target.value)} disabled={!editing} />
                                            <Input label="Date of Birth" type="date" value={data.dob || ""} onChange={(e) => updateField("dob", e.target.value)} disabled={!editing} />
                                            <Input label="Start Date" type="date" value={data.start_date?.split("T")[0] || ""} disabled />
                                            <div className="sm:col-span-2">
                                                <Input label="Bank Details (BSB & Account)" value={data.bank_details || ""} onChange={(e) => updateField("bank_details", e.target.value)} disabled={!editing} placeholder="e.g. BSB: 062000, Acc: 12345678" />
                                            </div>
                                            <Input label="Emergency Contact Name" value={data.emergency_contact_name || ""} onChange={(e) => updateField("emergency_contact_name", e.target.value)} disabled={!editing} />
                                            <Input label="Emergency Contact Phone" value={data.emergency_contact_phone || ""} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} disabled={!editing} />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Authentication Settings */}
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><Lock size={18} /> Authentication Settings</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-1">Time & Attendance Kiosk</h4>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">The employee's 4-digit PIN for clocking in.</p>
                                                </div>
                                                <Input
                                                    label="Kiosk PIN"
                                                    type={editing ? "text" : "password"}
                                                    maxLength={4}
                                                    value={data.kiosk_pin || ""}
                                                    onChange={(e) => updateField("kiosk_pin", e.target.value.replace(/[^0-9]/g, ''))}
                                                    disabled={!editing}
                                                    placeholder="----"
                                                />
                                                {editing && <p className="text-xs text-[hsl(var(--muted-foreground))]">Note: To protect privacy, existing PINs are hidden. Entering a new value will overwrite the current PIN.</p>}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Certificates */}
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between py-4">
                                        <CardTitle className="flex items-center gap-2"><FileText size={18} /> Certificates & Qualifications</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {data.certificates && data.certificates.length > 0 ? (
                                            <div className="space-y-3">
                                                {data.certificates.map((cert: any) => (
                                                    <div key={cert.certificate_id} className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))]">
                                                        <div>
                                                            <p className="font-medium text-sm">{cert.name}</p>
                                                            {cert.expiry_date && (
                                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Expires: {new Date(cert.expiry_date).toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                        <StatusBadge status={cert.expiry_date && new Date(cert.expiry_date) < new Date() ? "expired" : "active"} />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center p-6 border border-dashed border-[hsl(var(--border))] rounded-lg">
                                                <FileText size={24} className="mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">No certificates uploaded</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Danger Zone */}
                                {editing && (
                                    <Card className="border-[hsl(var(--danger))]/30">
                                        <CardContent className="p-6">
                                            <h3 className="text-sm font-semibold text-[hsl(var(--danger))] mb-2">Danger Zone</h3>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">This action cannot be undone.</p>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => {
                                                    if (confirm("Are you sure you want to remove this employee?")) {
                                                        deleteMutation.mutate();
                                                    }
                                                }}
                                                loading={deleteMutation.isPending}
                                            >
                                                <Trash2 size={14} /> Remove Employee
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            {/* Employment Tab */}
                            <TabsContent value="employment" className="space-y-6 outline-none">
                                <Card>
                                    <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} /> Employment Details</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input label="Role Title" value={data.role_title || ""} onChange={(e) => updateField("role_title", e.target.value)} disabled={!editing} />
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Employment Type</label>
                                                <select
                                                    value={data.employment_type || "full_time"}
                                                    onChange={(e) => updateField("employment_type", e.target.value)}
                                                    disabled={!editing}
                                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                                >
                                                    <option value="full_time">Full Time</option>
                                                    <option value="part_time">Part Time</option>
                                                    <option value="casual">Casual</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5 sm:col-span-2">
                                                <label className="text-sm font-medium">Base Rate ($/hr)</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <Input label="" type="number" value={data.current_rate?.weekday_rate || ""} disabled />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">To change pay rate, use the Rate History section below.</p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Pay Cycle</label>
                                                <select
                                                    value={data.pay_cycle || "weekly"}
                                                    onChange={(e) => updateField("pay_cycle", e.target.value)}
                                                    disabled={!editing}
                                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                                >
                                                    <option value="weekly">Weekly</option>
                                                    <option value="fortnightly">Fortnightly</option>
                                                    <option value="monthly">Monthly</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Status</label>
                                                <select
                                                    value={data.status || "active"}
                                                    onChange={(e) => updateField("status", e.target.value)}
                                                    disabled={!editing}
                                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                    <option value="invited">Invited</option>
                                                </select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Rate History */}
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between py-4">
                                        <CardTitle className="flex items-center gap-2"><DollarSign size={18} /> Rate History</CardTitle>
                                        <Button size="sm" variant="outline" onClick={() => setRateOpen(true)} disabled={editing}><Plus size={14} className="mr-1" /> Add Rate</Button>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingRates ? (
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading rates...</p>
                                        ) : rateHistory && rateHistory.length > 0 ? (
                                            <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-left text-[hsl(var(--muted-foreground))]">
                                                            <th className="p-3 font-medium">Effective From</th>
                                                            <th className="p-3 font-medium">Effective To</th>
                                                            <th className="p-3 font-medium">Base Rate</th>
                                                            <th className="p-3 font-medium text-center hidden md:table-cell">Sat / Sun / Hol / Eve</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rateHistory.map((rate: any) => (
                                                            <tr key={rate.rate_id} className="border-b border-[hsl(var(--border))] last:border-0 bg-[hsl(var(--background))]">
                                                                <td className="p-3">{new Date(rate.effective_from).toLocaleDateString()}</td>
                                                                <td className="p-3">{rate.effective_to ? new Date(rate.effective_to).toLocaleDateString() : <span className="text-[hsl(var(--success))] text-xs font-medium bg-[hsl(var(--success))]/10 px-2 py-0.5 rounded-full">Current</span>}</td>
                                                                <td className="p-3 font-medium">${rate.weekday_rate?.toFixed(2)}/hr</td>
                                                                <td className="p-3 text-center hidden md:table-cell text-xs text-[hsl(var(--muted-foreground))]">
                                                                    {rate.saturday_multiplier}x / {rate.sunday_multiplier}x / {rate.public_holiday_multiplier}x
                                                                    {rate.evening_rate ? ` / $${Number(rate.evening_rate).toFixed(2)}` : ''}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No rate history found.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Shifts Tab */}
                            <TabsContent value="shifts" className="outline-none">
                                <EmployeeShifts employeeId={employeeId} />
                            </TabsContent>

                            {/* Timesheets Tab */}
                            <TabsContent value="timesheets" className="outline-none">
                                <EmployeeTimesheets employeeId={employeeId} />
                            </TabsContent>

                            {/* Leave Tab */}
                            <TabsContent value="leave" className="outline-none">
                                <EmployeeLeave employeeId={employeeId} />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Update Rate Dialog */}
            <Dialog open={rateOpen} onOpenChange={setRateOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Update Pay Rate</DialogTitle>
                        <DialogDescription>
                            Set a new base hourly rate and advanced multipliers.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="New Base Rate ($/hr)"
                                type="number"
                                placeholder="e.g. 30.50"
                                value={newRate}
                                onChange={(e) => setNewRate(e.target.value)}
                            />
                            <Input
                                label="Effective From"
                                type="date"
                                value={effectiveFrom}
                                onChange={(e) => setEffectiveFrom(e.target.value)}
                            />
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
                            <h4 className="text-sm font-semibold mb-3">Evening Rate (Optional)</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <Input label="Flat Rate ($)" type="number" value={eveningRate} onChange={(e) => setEveningRate(e.target.value)} placeholder="e.g. 35.00" />
                                <Input label="Start (Hr 0-23)" type="number" min="0" max="23" value={eveningStartTime} onChange={(e) => setEveningStartTime(e.target.value)} placeholder="18" />
                                <Input label="End (Hr 0-23)" type="number" min="0" max="23" value={eveningEndTime} onChange={(e) => setEveningEndTime(e.target.value)} placeholder="23" />
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
                                const payload: any = {
                                    weekday_rate: parseFloat(newRate),
                                    effective_from: effectiveFrom,
                                };
                                if (saturdayMultiplier) payload.saturday_multiplier = parseFloat(saturdayMultiplier);
                                if (sundayMultiplier) payload.sunday_multiplier = parseFloat(sundayMultiplier);
                                if (publicHolidayMultiplier) payload.public_holiday_multiplier = parseFloat(publicHolidayMultiplier);
                                if (eveningRate) payload.evening_rate = parseFloat(eveningRate);
                                if (eveningStartTime) payload.evening_start_time = parseInt(eveningStartTime, 10);
                                if (eveningEndTime) payload.evening_end_time = parseInt(eveningEndTime, 10);

                                updateRateMutation.mutate(payload);
                            }}
                            loading={updateRateMutation.isPending}
                        >
                            <Save size={16} className="mr-2" /> Save Rate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
