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
import { ArrowLeft, Save, Trash2, User, Phone, Mail, DollarSign, Shield, FileText, Plus } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

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
            pageTitle={`${employee.first_name} ${employee.last_name}`}
            pageDescription={employee.role_title || "Employee"}
            actions={
                <Button variant="ghost" onClick={() => router.push("/owner/employees")}>
                    <ArrowLeft size={16} /> Back
                </Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Summary */}
                <Card>
                    <CardContent className="p-6 text-center">
                        <div className="flex justify-center mb-4">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-2xl font-bold">
                                {employee.first_name?.[0]}{employee.last_name?.[0]}
                            </div>
                        </div>
                        <h3 className="text-xl font-bold">{employee.first_name} {employee.last_name}</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">{employee.role_title}</p>
                        <StatusBadge status={employee.status} />
                        <div className="mt-4 space-y-2 text-sm text-left">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                                <Mail size={14} /> {employee.email}
                            </div>
                            {employee.phone && (
                                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                                    <Phone size={14} /> {employee.phone}
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                                <DollarSign size={14} /> ${employee.current_rate?.weekday_rate ?? '—'}/hr
                            </div>
                        </div>

                        <div className="mt-6 border-t border-[hsl(var(--border))] pt-6">
                            {!editing ? (
                                <Button className="w-full" onClick={() => setEditing(true)}>Edit Profile</Button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <Button className="w-full" onClick={handleSave} loading={updateMutation.isPending}><Save size={16} className="mr-2" /> Save Changes</Button>
                                    <Button className="w-full" variant="outline" onClick={() => { setEditing(false); setFormData({ ...employee }); }}>Cancel</Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Form */}
                <div className="lg:col-span-2 space-y-6">
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

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} /> Employment</CardTitle></CardHeader>
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
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rateHistory.map((rate: any) => (
                                                <tr key={rate.rate_id} className="border-b border-[hsl(var(--border))] last:border-0 bg-[hsl(var(--background))]">
                                                    <td className="p-3">{new Date(rate.effective_from).toLocaleDateString()}</td>
                                                    <td className="p-3">{rate.effective_to ? new Date(rate.effective_to).toLocaleDateString() : <span className="text-[hsl(var(--success))] text-xs font-medium bg-[hsl(var(--success))]/10 px-2 py-0.5 rounded-full">Current</span>}</td>
                                                    <td className="p-3 font-medium">${rate.weekday_rate?.toFixed(2)}/hr</td>
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
                </div>
            </div>

            {/* Update Rate Dialog */}
            <Dialog open={rateOpen} onOpenChange={setRateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Pay Rate</DialogTitle>
                        <DialogDescription>
                            Set a new base hourly rate and the date it becomes effective.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (!newRate || !effectiveFrom) {
                                    toast.error("Please fill all fields");
                                    return;
                                }
                                updateRateMutation.mutate({
                                    weekday_rate: parseFloat(newRate),
                                    effective_from: effectiveFrom
                                });
                            }}
                            loading={updateRateMutation.isPending}
                        >
                            <Save size={16} /> Save Rate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
