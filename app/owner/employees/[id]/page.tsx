"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { apiGet, apiPut, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, User, Phone, Mail, DollarSign, Shield } from "lucide-react";

export default function OwnerEmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const employeeId = params.id as string;

    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<any>(null);

    const { data: employee, isLoading } = useQuery({
        queryKey: ["employee", employeeId],
        queryFn: () => apiGet<any>(`/employees/${employeeId}`),
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

    const handleSave = () => {
        if (!formData) return;
        updateMutation.mutate({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            role_title: formData.role_title,
            employment_type: formData.employment_type,
            weekday_rate: formData.weekday_rate ? parseFloat(formData.weekday_rate) : undefined,
            status: formData.status,
        });
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    if (isLoading) {
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
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => router.push("/owner/employees")}>
                        <ArrowLeft size={16} /> Back
                    </Button>
                    {editing ? (
                        <>
                            <Button variant="outline" onClick={() => { setEditing(false); setFormData({ ...employee }); }}>Cancel</Button>
                            <Button onClick={handleSave} loading={updateMutation.isPending}><Save size={16} /> Save</Button>
                        </>
                    ) : (
                        <Button onClick={() => setEditing(true)}>Edit</Button>
                    )}
                </div>
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
                                <DollarSign size={14} /> ${employee.weekday_rate}/hr
                            </div>
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
                                <Input label="Base Rate ($/hr)" type="number" value={data.weekday_rate || ""} onChange={(e) => updateField("weekday_rate", e.target.value)} disabled={!editing} />
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
        </DashboardLayout>
    );
}
