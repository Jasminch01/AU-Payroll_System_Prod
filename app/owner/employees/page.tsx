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
import { UserPlus, Mail, Send, Eye, RefreshCw, Copy, Check } from "lucide-react";
import type { Employee } from "@/types/database";

export default function OwnerEmployeesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Invite form state
    const [invEmail, setInvEmail] = useState("");
    const [invFirstName, setInvFirstName] = useState("");
    const [invLastName, setInvLastName] = useState("");
    const [invRole, setInvRole] = useState("");
    const [invEmploymentType, setInvEmploymentType] = useState("full_time");
    const [invRate, setInvRate] = useState("");
    const [invAs, setInvAs] = useState<"employee" | "manager">("employee");

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<Employee[]>("/employees"),
    });

    const inviteMutation = useMutation({
        mutationFn: (data: any) => apiPost("/employees/invite", data),
        onSuccess: (response: any) => {
            toast.success("Employee created successfully!");
            if (response?.invite_link) {
                setGeneratedLink(response.invite_link);
            }
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setInviteOpen(false);
            resetForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const resendInviteMutation = useMutation({
        mutationFn: (employeeId: string) => apiPost("/employees/resend-invite", { employee_id: employeeId }),
        onSuccess: (response: any) => {
            toast.success("Invitation link regenerated!");
            if (response?.invite_link) {
                setGeneratedLink(response.invite_link);
            }
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const resetForm = () => {
        setInvEmail("");
        setInvFirstName("");
        setInvLastName("");
        setInvRole("");
        setInvEmploymentType("full_time");
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
            employment_type: invEmploymentType,
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
                <div className="flex gap-2 justify-end">
                    {row.status === "invited" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); resendInviteMutation.mutate(row.employee_id); }}
                            loading={resendInviteMutation.isPending}
                        >
                            <RefreshCw size={14} className="mr-1" /> Resend
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/owner/employees/${row.employee_id}`); }}
                    >
                        <Eye size={14} className="mr-1" /> View
                    </Button>
                </div>
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

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Role Title" placeholder="e.g. Barista" value={invRole} onChange={(e) => setInvRole(e.target.value)} />
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Employment Type</label>
                                <select
                                    value={invEmploymentType}
                                    onChange={(e) => setInvEmploymentType(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                >
                                    <option value="full_time">Full Time</option>
                                    <option value="part_time">Part Time</option>
                                    <option value="casual">Casual</option>
                                </select>
                            </div>
                        </div>

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

            {/* Manual Link Sharing Dialog */}
            <Dialog open={!!generatedLink} onOpenChange={(open) => { if (!open) setGeneratedLink(null); setCopied(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Share Invitation Link</DialogTitle>
                        <DialogDescription>
                            Because your email server is not fully configured, you must send this link manually to the employee so they can complete onboarding.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2 p-3 bg-[hsl(var(--muted))] rounded-lg">
                        <Input value={generatedLink || ""} readOnly className="font-mono text-xs w-full bg-transparent border-0 focus-visible:ring-0 px-1 truncate" />
                        <Button
                            variant="secondary"
                            size="icon"
                            className="shrink-0"
                            onClick={() => {
                                if (generatedLink) {
                                    navigator.clipboard.writeText(generatedLink);
                                    setCopied(true);
                                    toast.success("Link copied to clipboard!");
                                    setTimeout(() => setCopied(false), 2000);
                                }
                            }}
                        >
                            {copied ? <Check size={16} className="text-[hsl(var(--success))]" /> : <Copy size={16} />}
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setGeneratedLink(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout >
    );
}
