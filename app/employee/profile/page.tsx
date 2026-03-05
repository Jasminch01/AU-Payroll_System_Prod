"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPut, apiUpload } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Save, User, Phone, Shield, Camera } from "lucide-react";

export default function EmployeeProfilePage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<any>(null);

    // Fetch full employee details (auth/me returns limited fields)
    const { data: employee, isLoading } = useQuery({
        queryKey: ["employee-detail", user?.employee_id],
        queryFn: () => apiGet<any>(`/auth/me`),
        enabled: !!user?.employee_id,
    });

    React.useEffect(() => {
        if (employee && !formData) {
            setFormData({ ...employee });
        }
    }, [employee, formData]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => apiPut(`/employees/${user?.employee_id}`, data),
        onSuccess: () => {
            toast.success("Profile updated!");
            queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
            queryClient.invalidateQueries({ queryKey: ["auth-me"] });
            setEditing(false);
            setFormData(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const uploadData = new FormData();
            uploadData.append("file", file);
            await apiUpload("/upload/avatar", uploadData);
            toast.success("Avatar updated!");
            queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
            queryClient.invalidateQueries({ queryKey: ["auth-me"] });
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const emp = formData || employee || {};

    return (
        <DashboardLayout
            role="employee"
            pageTitle="My Profile"
            pageDescription="View and update your details"
            actions={
                editing ? (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => { setEditing(false); setFormData(employee ? { ...employee } : null); }}>Cancel</Button>
                        <Button onClick={() => updateMutation.mutate({ phone: emp.phone, emergency_contact_name: emp.emergency_contact_name, emergency_contact_phone: emp.emergency_contact_phone })} loading={updateMutation.isPending}>
                            <Save size={16} /> Save
                        </Button>
                    </div>
                ) : (
                    <Button onClick={() => setEditing(true)}>Edit Profile</Button>
                )
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Avatar & Summary */}
                <Card>
                    <CardContent className="p-6 text-center">
                        <div className="relative inline-block mb-4">
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-3xl font-bold mx-auto">
                                {emp.first_name?.[0]}{emp.last_name?.[0]}
                            </div>
                            <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[hsl(var(--brand))] text-white shadow-lg hover:opacity-90 transition-opacity">
                                <Camera size={14} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                            </label>
                        </div>
                        <h3 className="text-xl font-bold">{emp.first_name} {emp.last_name}</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{emp.role_title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{emp.email}</p>
                    </CardContent>
                </Card>

                {/* Details */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><User size={18} /> Personal Details</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="First Name" value={emp.first_name || ""} disabled />
                                <Input label="Last Name" value={emp.last_name || ""} disabled />
                                <Input label="Email" value={emp.email || ""} disabled />
                                <Input label="Phone" value={emp.phone || ""} onChange={(e) => updateField("phone", e.target.value)} disabled={!editing} />
                                <Input label="Date of Birth" type="date" value={emp.dob || ""} disabled />
                                <Input label="Start Date" value={emp.start_date?.split("T")[0] || ""} disabled />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Phone size={18} /> Emergency Contact</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Contact Name" value={emp.emergency_contact_name || ""} onChange={(e) => updateField("emergency_contact_name", e.target.value)} disabled={!editing} />
                                <Input label="Contact Phone" value={emp.emergency_contact_phone || ""} onChange={(e) => updateField("emergency_contact_phone", e.target.value)} disabled={!editing} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} /> Employment</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Role" value={emp.role_title || ""} disabled />
                                <Input label="Employment Type" value={emp.employment_type?.replace("_", " ") || ""} disabled />
                                <Input label="Base Rate" value={emp.weekday_rate ? `$${emp.weekday_rate}/hr` : ""} disabled />
                                <Input label="Status" value={emp.status || ""} disabled />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
