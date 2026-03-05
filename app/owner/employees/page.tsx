"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { UserPlus, Mail, Send, Eye } from "lucide-react";
import type { Employee } from "@/types/database";

export default function OwnerEmployeesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [inviteOpen, setInviteOpen] = useState(false);

    // Invite form state
    const [invEmail, setInvEmail] = useState("");
    const [invFirstName, setInvFirstName] = useState("");
    const [invLastName, setInvLastName] = useState("");
    const [invRole, setInvRole] = useState("");
    const [invRate, setInvRate] = useState("");
    const [invAs, setInvAs] = useState<"employee" | "manager">("employee");

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<Employee[]>("/employees"),
    });

    const inviteMutation = useMutation({
        mutationFn: (data: any) => apiPost("/employees/invite", data),
        onSuccess: () => {
            toast.success("Invitation sent!");
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setInviteOpen(false);
            resetForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const resetForm = () => {
        setInvEmail("");
        setInvFirstName("");
        setInvLastName("");
        setInvRole("");
        setInvRate("");
        setInvAs("employee");
    };

    const handleInvite = () => {
        if (!invEmail || !invFirstName || !invLastName || !invRole || !invRate) {
            toast.error("Please fill in all fields");
            return;
        }
        inviteMutation.mutate({
            email: invEmail,
            first_name: invFirstName,
            last_name: invLastName,
            role_title: invRole,
            weekday_rate: parseFloat(invRate),
            invite_as: invAs,
        });
    };

    const columns: Column<Employee>[] = [
        {
            key: "name",
            label: "Name",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold">
                        {(row.first_name?.[0] ?? "")}{(row.last_name?.[0] ?? "")}
                    </div>
                    <div>
                        <p className="font-medium">{row.first_name} {row.last_name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.email}</p>
                    </div>
                </div>
            ),
        },
        { key: "role_title", label: "Role", sortable: true },
        {
            key: "employment_type",
            label: "Type",
            render: (row) => (
                <span className="capitalize text-sm">{row.employment_type?.replace("_", " ") ?? "—"}</span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (row) => <StatusBadge status={row.status} />,
        },
        {
            key: "start_date",
            label: "Start Date",
            sortable: true,
            render: (row) => <span className="text-sm">{new Date(row.start_date).toLocaleDateString("en-AU")}</span>,
        },
        {
            key: "actions",
            label: "",
            render: (row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); router.push(`/owner/employees/${row.employee_id}`); }}
                >
                    <Eye size={14} /> View
                </Button>
            ),
        },
    ];

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Employees"
            pageDescription="Manage your team"
            actions={
                <Button onClick={() => setInviteOpen(true)}>
                    <UserPlus size={16} />
                    Invite Employee
                </Button>
            }
        >
            <DataTable
                columns={columns}
                data={employees}
                searchable
                searchKeys={["first_name", "last_name", "email", "role_title"]}
                searchPlaceholder="Search employees..."
                emptyMessage="No employees yet. Invite your first team member!"
                emptyIcon={<UserPlus size={40} />}
                loading={isLoading}
            />

            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation email. They&apos;ll set up their own password, bank details, and kiosk PIN.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Role type toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setInvAs("employee")}
                                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${invAs === "employee"
                                    ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]"
                                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                                    }`}
                            >
                                Employee
                            </button>
                            <button
                                onClick={() => setInvAs("manager")}
                                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${invAs === "manager"
                                    ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]"
                                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                                    }`}
                            >
                                Manager
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="First Name" placeholder="Jane" value={invFirstName} onChange={(e) => setInvFirstName(e.target.value)} />
                            <Input label="Last Name" placeholder="Doe" value={invLastName} onChange={(e) => setInvLastName(e.target.value)} />
                        </div>
                        <Input label="Email" type="email" placeholder="jane@company.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
                        <Input label="Role Title" placeholder="e.g. Barista, Kitchen Hand" value={invRole} onChange={(e) => setInvRole(e.target.value)} />
                        <Input label="Base Hourly Rate ($)" type="number" placeholder="28.50" value={invRate} onChange={(e) => setInvRate(e.target.value)} />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={handleInvite} loading={inviteMutation.isPending}>
                            <Send size={16} />
                            Send Invitation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
