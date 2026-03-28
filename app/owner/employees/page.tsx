"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import { UserPlus, Users, Send, RefreshCw, Copy, Check, MoreHorizontal, Eye, ExternalLink, Trash2, AlertTriangle, Filter, X, Briefcase, User, ShieldCheck, UserPlus2, ChevronRight } from "lucide-react";
import type { Employee } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";
import { generateBusinessPrefix, formatEmpSuffix, getNumericSuffix } from "@/lib/utils/employee-id";

type StatusFilter = "all" | "active" | "invited" | "inactive";

export default function OwnerEmployeesPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");



    // Invite form state
    const [invEmail, setInvEmail] = useState("");
    const [invFirstName, setInvFirstName] = useState("");
    const [invLastName, setInvLastName] = useState("");
    const [invPhone, setInvPhone] = useState("");
    const [invRole, setInvRole] = useState("");
    const [invEmploymentType, setInvEmploymentType] = useState("");
    const [invRate, setInvRate] = useState("");
    const [invAs, setInvAs] = useState<"employee" | "manager">("employee");

    // Bulk Invite state
    const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
    const [bulkData, setBulkData] = useState<any[]>([{ first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', invite_as: 'employee' }]);

    // Join Code state
    const [joinCode, setJoinCode] = useState<string | null>(null);
    const [isGeneratingJoinCode, setIsGeneratingJoinCode] = useState(false);

    // Manual Add state
    const [manualAddOpen, setManualAddOpen] = useState(false);
    const [manualData, setManualData] = useState<any>({
        first_name: '', last_name: '', email: '', phone: '', dob: '',
        emergency_contact_name: '', emergency_contact_phone: '',
        role_title: '', employment_type: '', pay_cycle: 'weekly',
        start_date: new Date().toISOString().split('T')[0],
        weekday_rate: '',
        password: '',
        invite_as: 'employee',
        bank_account_name: '', bank_bsb: '', bank_account_number: '', abn: '', tfn: ''
    });

    const { user } = useAuth();
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: () => apiGet<Employee[]>("/employees"),
    });

    // Auto-generate employee_id for manual add
    React.useEffect(() => {
        if (manualAddOpen && user?.business?.business_name) {
            const prefix = generateBusinessPrefix(user.business.business_name);
            const activeEmps = employees.map(e => e.employee_id);

            let maxSerial = 0;
            for (const id of activeEmps) {
                const serial = getNumericSuffix(id);
                if (serial > maxSerial) maxSerial = serial;
            }

            const nextId = `${prefix}${formatEmpSuffix(maxSerial + 1)}`;
            setManualData((prev: any) => ({ ...prev, employee_id: nextId }));
        }
    }, [manualAddOpen, user?.business?.business_name, employees]);

    const filteredEmployees = useMemo(() => {
        if (statusFilter === "all") return employees;
        return employees.filter((e: Employee) => e.status === statusFilter);
    }, [employees, statusFilter]);

    const counts = useMemo(() => ({
        all: employees.length,
        active: employees.filter((e: Employee) => e.status === "active").length,
        invited: employees.filter((e: Employee) => e.status === "invited").length,
        inactive: employees.filter((e: Employee) => e.status === "inactive").length,
    }), [employees]);

    const inviteMutation = useMutation({
        mutationFn: (data: any) => apiPost("/employees/invite", data),
        onSuccess: (response: any) => {
            if (response?.results) {
                const count = response.success_count;
                const total = response.results.length;
                if (count === 0) {
                    // All failed — show the first error
                    const firstError = response.results[0]?.error || "Invitation failed. Please try again.";
                    toast.error(firstError);
                    return;
                } else if (count < total) {
                    // Partial success in bulk
                    toast.warning(`${count} of ${total} invitations sent. Some failed.`);
                } else {
                    toast.success(`Successfully sent ${count} invitation(s)!`);
                }
                const firstLink = response.results.find((r: any) => r.invite_link)?.invite_link;
                if (firstLink) setGeneratedLink(firstLink);
            } else {
                toast.success("Employee invitation sent successfully!");
                if (response?.invite_link) setGeneratedLink(response.invite_link);
            }

            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setInviteOpen(false);
            setBulkInviteOpen(false);
            resetForm();
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // Reset invitation forms when dialogs close
    React.useEffect(() => {
        if (!inviteOpen && !bulkInviteOpen) {
            resetForm();
        }
    }, [inviteOpen, bulkInviteOpen]);

    // Reset manual add form when dialog closes
    React.useEffect(() => {
        if (!manualAddOpen) {
            setManualData({
                first_name: '', last_name: '', email: '', phone: '', dob: '',
                emergency_contact_name: '', emergency_contact_phone: '',
                role_title: '', employment_type: '', pay_cycle: 'weekly',
                start_date: new Date().toISOString().split('T')[0],
                weekday_rate: '',
                password: '',
                invite_as: 'employee',
                bank_account_name: '', bank_bsb: '', bank_account_number: '', abn: '', tfn: ''
            });
        }
    }, [manualAddOpen]);

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

    const addManualMutation = useMutation({
        mutationFn: (data: any) => apiPost("/employees", data),
        onSuccess: () => {
            toast.success("Employee added successfully!");
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setManualAddOpen(false);
            setManualData({
                first_name: '', last_name: '', email: '', phone: '', dob: '',
                emergency_contact_name: '', emergency_contact_phone: '',
                role_title: '', employment_type: '', pay_cycle: 'weekly',
                start_date: new Date().toISOString().split('T')[0],
                weekday_rate: '',
                password: '',
                invite_as: 'employee',
                employee_id: '',
                bank_account_name: '', bank_bsb: '', bank_account_number: '', abn: '', tfn: ''
            });
        },
        // consol.log
        onError: (err: Error) => toast.error(err.message),
    });

    const handleManualAdd = () => {
        if (!manualData.email || !manualData.password || !manualData.first_name || !manualData.last_name || !manualData.start_date) {
            return toast.error("Please fill in all required (*) fields.");
        }
        addManualMutation.mutate({
            ...manualData,
            weekday_rate: manualData.weekday_rate ? parseFloat(manualData.weekday_rate) : undefined
        });
    };



    const resetForm = () => {
        setInvEmail("");
        setInvFirstName("");
        setInvLastName("");
        setInvPhone("");
        setInvRole("");
        setInvEmploymentType("");
        setInvRate("");
        setInvAs("employee");
        setBulkData([{ first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', invite_as: 'employee' }]);
    };

    const handleInvite = () => {
        if (!invEmail || !invFirstName || !invLastName) {
            return toast.error("Please fill in first name, last name, and email.");
        }
        inviteMutation.mutate({
            email: invEmail,
            first_name: invFirstName,
            last_name: invLastName,
            phone: invPhone,
            role_title: invRole,
            employment_type: invEmploymentType,
            weekday_rate: invRate ? parseFloat(invRate) : undefined,
            invite_as: invAs,
        });
    };

    const handleBulkInvite = () => {
        const validEmployees = bulkData.filter(e => e.email && e.first_name && e.last_name);
        if (validEmployees.length === 0) {
            return toast.error("Please enter at least one employee with required details (First Name, Last Name, Email)");
        }
        inviteMutation.mutate({ employees: validEmployees });
    };

    const handleGenerateJoinCode = async () => {
        setIsGeneratingJoinCode(true);
        try {
            const res = await apiPost<{ join_code: string }>("/employees/invite", { action: "generate_join_code" });
            setJoinCode(res.join_code);
            toast.success("Reusable join code generated!");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsGeneratingJoinCode(false);
        }
    };



    const STATUS_TABS: { key: StatusFilter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "active", label: "Active" },
        { key: "invited", label: "Invited" },
        { key: "inactive", label: "Inactive" },
    ];

    const columns: Column<Employee>[] = [
        {
            key: "name",
            label: "Name",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold shrink-0">
                        {(row.first_name?.[0] ?? "")}{(row.last_name?.[0] ?? "")}
                    </div>
                    <div>
                        <p className="font-medium">{row.first_name} {row.last_name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "role_title",
            label: "Role",
            sortable: true,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.role_title || "—"}</span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-bold tracking-tight">
                        {row.role || "employee"}
                    </span>
                </div>
            )
        },
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
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal size={16} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                                onClick={() => router.push(`/owner/employees/${row.employee_id}`)}
                                className="cursor-pointer"
                            >
                                <User size={14} className="mr-2" />
                                View Personal
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => router.push(`/owner/employees/${row.employee_id}?tab=employment`)}
                                className="cursor-pointer"
                            >
                                <Briefcase size={14} className="mr-2" />
                                Edit Employment
                            </DropdownMenuItem>
                            {row.status === "invited" && (
                                <DropdownMenuItem
                                    onClick={() => resendInviteMutation.mutate(row.employee_id)}
                                    className="cursor-pointer"
                                >
                                    <RefreshCw size={14} className="mr-2" />
                                    Resend Invite
                                </DropdownMenuItem>
                            )}

                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Employees"
            pageDescription="Manage your team"
        >
            {/* Status Filter Button */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9 gap-2 rounded-lg border-[hsl(var(--border))]">
                                <Filter size={14} />
                                <span>Filter: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-[10px] font-bold">
                                    {counts[statusFilter]}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            {STATUS_TABS.map((tab) => (
                                <DropdownMenuItem
                                    key={tab.key}
                                    onClick={() => setStatusFilter(tab.key)}
                                    className="flex items-center justify-between cursor-pointer"
                                >
                                    <span>{tab.label}</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{counts[tab.key]}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {statusFilter !== "all" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusFilter("all")}
                            className="h-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-2"
                        >
                            <X size={14} className="mr-1" /> Clear
                        </Button>
                    )}
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredEmployees}
                searchable
                searchKeys={["first_name", "last_name", "email", "role_title", "role"]}
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found."
                emptyIcon={<UserPlus size={40} />}
                loading={isLoading}
                onRowClick={(row) => router.push(`/owner/employees/${row.employee_id}`)}
                mobileCardRender={(row) => (
                    <div className="p-4 flex items-center justify-between border-b border-[hsl(var(--border))] last:border-0 active:bg-[hsl(var(--muted))]/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold shadow-sm">
                                {(row.first_name?.[0] ?? "")}{(row.last_name?.[0] ?? "")}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[hsl(var(--foreground))]">{row.first_name} {row.last_name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted-foreground))] tracking-wider">
                                        {row.role_title || "No Role"}
                                    </span>
                                    <StatusBadge status={row.status} className="scale-75 origin-left h-4" />
                                </div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-[hsl(var(--muted-foreground))]/40" />
                    </div>
                )}
                actions={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="h-9 gap-2 shadow-sm">
                                <UserPlus size={16} />
                                Add People
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setInviteOpen(true)} className="py-2.5">
                                <User size={16} className="mr-2 text-[hsl(var(--muted-foreground))]" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Single Invitation</span>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Invite one person at a time</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setBulkInviteOpen(true)} className="py-2.5">
                                <Users size={16} className="mr-2 text-[hsl(var(--muted-foreground))]" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Multiple Invitations</span>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Add many people at once</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setManualAddOpen(true)} className="py-2.5">
                                <Briefcase size={16} className="mr-2 text-[hsl(var(--muted-foreground))]" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Add Employee Manually</span>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Complete setup right now</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleGenerateJoinCode} disabled={isGeneratingJoinCode} className="py-2.5">
                                <ExternalLink size={16} className="mr-2 text-[hsl(var(--muted-foreground))]" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Business Join Link</span>
                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Reusable link for your team</span>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />

            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation. They&apos;ll set up their own password and bank details during onboarding.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Access Level Selector */}
                        <div className="space-y-2">
                            <label className="text-[12px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Access Level</label>
                            <select
                                value={invAs}
                                onChange={(e) => setInvAs(e.target.value as any)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            >
                                <option value="employee">Employee</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="First Name" showAsterisk placeholder="Jane" value={invFirstName} onChange={(e) => setInvFirstName(e.target.value)} />
                            <Input label="Last Name" showAsterisk placeholder="Doe" value={invLastName} onChange={(e) => setInvLastName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Email Address" showAsterisk type="email" placeholder="jane@company.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
                            <Input label="Mobile Number" type="tel" placeholder="0412 345 678" value={invPhone} onChange={(e) => setInvPhone(e.target.value)} />
                        </div>

                        {invAs === "employee" && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Role Title" placeholder="e.g. Barista" value={invRole} onChange={(e) => setInvRole(e.target.value)} />
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">
                                            Employment Type <span className={cn(
                                                "ml-0.5 transition-colors duration-200",
                                                invEmploymentType ? "text-[hsl(var(--foreground))]" : "text-[#FF4A4A]"
                                            )}>*</span>
                                        </label>
                                        <select
                                            value={invEmploymentType}
                                            onChange={(e) => setInvEmploymentType(e.target.value)}
                                            className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20"
                                        >
                                            <option value="" disabled>Select</option>
                                            <option value="full_time">Full Time</option>
                                            <option value="part_time">Part Time</option>
                                            <option value="casual">Casual</option>
                                            <option value="contract">Contract</option>
                                        </select>
                                    </div>
                                </div>

                                {/* <Input
                                    label="Base Hourly Rate ($) — optional, can be set later"
                                    type="number"
                                    placeholder="28.50"
                                    value={invRate}
                                    onChange={(e) => setInvRate(e.target.value)}
                                /> */}
                            </>
                        )}
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
                            Send this link manually to the employee so they can complete onboarding.
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

            {/* Bulk Invite Dialog */}
            <Dialog open={bulkInviteOpen} onOpenChange={setBulkInviteOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Add Multiple Employees</DialogTitle>
                        <DialogDescription>
                            Quickly invite multiple team members at once. Required: Name, Email, and Role.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[50vh] overflow-y-auto px-1 py-1 custom-scrollbar border rounded-xl bg-slate-50/30">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-slate-500">Employee Details</th>
                                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-slate-500">Contact</th>
                                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-slate-500">Role & Access</th>
                                    <th className="text-left py-3 px-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {bulkData.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                <div className="relative w-1/2">
                                                    <input
                                                        value={row.first_name}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].first_name = e.target.value;
                                                            setBulkData(newBulk);
                                                        }}
                                                        placeholder="First Name"
                                                        className="w-full h-9 bg-slate-50/50 border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#3724B3] focus:border-[#3724B3] outline-none"
                                                    />
                                                    <span className={cn(
                                                        "absolute right-2 top-2.5 text-[10px] transition-colors duration-200",
                                                        row.first_name ? "text-slate-400" : "text-[#FF4A4A]"
                                                    )}>*</span>
                                                </div>
                                                <div className="relative w-1/2">
                                                    <input
                                                        value={row.last_name}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].last_name = e.target.value;
                                                            setBulkData(newBulk);
                                                        }}
                                                        placeholder="Last Name"
                                                        className="w-full h-9 bg-slate-50/50 border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#3724B3] focus:border-[#3724B3] outline-none"
                                                    />
                                                    <span className={cn(
                                                        "absolute right-2 top-2.5 text-[10px] transition-colors duration-200",
                                                        row.last_name ? "text-slate-400" : "text-[#FF4A4A]"
                                                    )}>*</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="space-y-1.5">
                                                <div className="relative">
                                                    <input
                                                        type="email"
                                                        value={row.email}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].email = e.target.value;
                                                            setBulkData(newBulk);
                                                        }}
                                                        placeholder="email@example.com"
                                                        className="w-full h-9 bg-slate-50/50 border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#3724B3] focus:border-[#3724B3] outline-none"
                                                    />
                                                    <span className={cn(
                                                        "absolute right-2 top-2.5 text-[10px] transition-colors duration-200",
                                                        row.email ? "text-slate-400" : "text-[#FF4A4A]"
                                                    )}>*</span>
                                                </div>
                                                <input
                                                    type="tel"
                                                    value={row.phone}
                                                    onChange={(e) => {
                                                        const newBulk = [...bulkData];
                                                        newBulk[idx].phone = e.target.value;
                                                        setBulkData(newBulk);
                                                    }}
                                                    placeholder="Phone (optional)"
                                                    className="w-full h-9 bg-slate-50/50 border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#3724B3] focus:border-[#3724B3] outline-none"
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="space-y-1.5">
                                                <div className="relative">
                                                    <input
                                                        value={row.role_title}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].role_title = e.target.value;
                                                            setBulkData(newBulk);
                                                        }}
                                                        placeholder="Job Title (e.g. Barista)"
                                                        className="w-full h-9 bg-slate-50/50 border border-slate-200 rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#3724B3] focus:border-[#3724B3] outline-none font-medium"
                                                    />
                                                </div>
                                                <div className="pt-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter block mb-0.5">Employment Type</label>
                                                    <select
                                                        value={row.employment_type || ''}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].employment_type = e.target.value;
                                                            setBulkData(newBulk);
                                                        }}
                                                        className="w-full h-7 bg-transparent border-0 text-[10px] font-medium text-slate-600 outline-none cursor-pointer hover:text-[#3724B3] -ml-0.5"
                                                    >
                                                        <option value="" disabled>Select</option>
                                                        <option value="full_time">Full Time</option>
                                                        <option value="part_time">Part Time</option>
                                                        <option value="casual">Casual</option>
                                                        <option value="contract">Contract</option>
                                                    </select>
                                                </div>
                                                <div className="pt-1">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter block mb-0.5">Access Level</label>
                                                    <select
                                                        value={row.invite_as || 'employee'}
                                                        onChange={(e) => {
                                                            const newBulk = [...bulkData];
                                                            newBulk[idx].invite_as = e.target.value as any;
                                                            setBulkData(newBulk);
                                                        }}
                                                        className="w-full h-7 bg-transparent border-0 text-[10px] font-medium text-slate-600 outline-none cursor-pointer hover:text-[#3724B3] -ml-0.5 opacity-80"
                                                    >
                                                        <option value="employee">Standard Employee</option>
                                                        <option value="manager">Business Manager</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            {bulkData.length > 1 && (
                                                <button
                                                    onClick={() => setBulkData(bulkData.filter((_, i) => i !== idx))}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-4 bg-slate-50/50 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBulkData([...bulkData, { first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', invite_as: 'employee' }])}
                                className="h-9 border-dashed border-slate-300 text-slate-600 hover:border-[#3724B3] hover:text-[#3724B3] bg-white"
                            >
                                <UserPlus size={14} className="mr-2" /> Add Another Team Member
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="mt-6 border-t pt-4">
                        <Button variant="outline" onClick={() => setBulkInviteOpen(false)}>Cancel</Button>
                        <Button onClick={handleBulkInvite} loading={inviteMutation.isPending}>
                            <Send size={16} />
                            Invite {bulkData.filter(e => e.email).length} People
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Business Join Link Dialog */}
            <Dialog open={!!joinCode} onOpenChange={(open) => { if (!open) setJoinCode(null); setCopied(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Business Join Link</DialogTitle>
                        <DialogDescription>
                            Share this recurring link with any employee to let them join your business and start onboarding.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex items-center gap-2 p-3 bg-[hsl(var(--success-light))]/10 border border-[hsl(var(--success))]/20 rounded-xl">
                            <div className="h-10 w-10 rounded-full bg-[hsl(var(--success-light))] text-[hsl(var(--success))] flex items-center justify-center shrink-0">
                                <ExternalLink size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase font-bold text-[hsl(var(--success))] tracking-wider">Recurring Link</p>
                                <p className="text-xs font-mono truncate text-[hsl(var(--foreground))]">
                                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/onboarding?business=${joinCode}`}
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => {
                                    const link = `${window.location.origin}/onboarding?business=${joinCode}`;
                                    navigator.clipboard.writeText(link);
                                    setCopied(true);
                                    toast.success("Join link copied!");
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                            >
                                {copied ? <Check size={16} className="text-[hsl(var(--success))]" /> : <Copy size={16} />}
                            </Button>
                        </div>

                        <div className="bg-[hsl(var(--muted))] p-3 rounded-lg flex items-start gap-2">
                            <AlertTriangle size={14} className="text-[hsl(var(--warning))] mt-0.5 shrink-0" />
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                                <strong>Safety Policy:</strong> Only share this link with people you trust. Anyone with this link can attempt to join your business, but they will still require manual approval by an owner or manager to access shifts.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setJoinCode(null)} className="w-full">Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Add Dialog */}
            <Dialog open={manualAddOpen} onOpenChange={setManualAddOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Employee Manually</DialogTitle>
                        <DialogDescription>
                            Create a complete employee profile instantly.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Access Level Selector */}
                        <div className="space-y-2">
                            <label className="text-[12px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Access Level</label>
                            <select
                                value={manualData.invite_as}
                                onChange={(e) => setManualData({ ...manualData, invite_as: e.target.value })}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                            >
                                <option value="employee">Employee</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>

                        <section>
                            <h3 className="text-sm font-bold border-b pb-2 mb-3">Identity & Account</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <Input label="First Name" showAsterisk value={manualData.first_name} onChange={(e) => setManualData({ ...manualData, first_name: e.target.value })} />
                                <Input label="Last Name" showAsterisk value={manualData.last_name} onChange={(e) => setManualData({ ...manualData, last_name: e.target.value })} />
                                <Input label="Email" showAsterisk type="email" value={manualData.email} onChange={(e) => setManualData({ ...manualData, email: e.target.value })} />
                                <Input label="Temporary Password" showAsterisk type="password" value={manualData.password} onChange={(e) => setManualData({ ...manualData, password: e.target.value })} />
                                <Input label="Phone" type="tel" value={manualData.phone} onChange={(e) => setManualData({ ...manualData, phone: e.target.value })} />
                                <Input
                                    label="Date of Birth"
                                    type={manualData.dob ? "date" : "text"}
                                    placeholder="Not Set"
                                    value={manualData.dob}
                                    onFocus={(e) => e.target.type = 'date'}
                                    onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                                    onChange={(e) => setManualData({ ...manualData, dob: e.target.value })}
                                />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-bold border-b pb-2 mb-3">Employment Details</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                {manualData.invite_as === "employee" && (
                                    <>
                                        <Input label="Role Title" value={manualData.role_title} onChange={(e) => setManualData({ ...manualData, role_title: e.target.value })} />
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold ml-0.5">
                                                Employment Type <span className={cn(
                                                    "ml-0.5 transition-colors duration-200",
                                                    manualData.employment_type ? "text-[hsl(var(--foreground))]" : "text-[#FF4A4A]"
                                                )}>*</span>
                                            </label>
                                            <select value={manualData.employment_type} onChange={(e) => setManualData({ ...manualData, employment_type: e.target.value })} className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20">
                                                <option value="" disabled>Select</option>
                                                <option value="full_time">Full Time</option>
                                                <option value="part_time">Part Time</option>
                                                <option value="casual">Casual</option>
                                                <option value="contract">Contract</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold ml-0.5">
                                                Pay Cycle <span className={cn(
                                                    "ml-0.5 transition-colors duration-200",
                                                    manualData.pay_cycle ? "text-[hsl(var(--foreground))]" : "text-[#FF4A4A]"
                                                )}>*</span>
                                            </label>
                                            <select value={manualData.pay_cycle} onChange={(e) => setManualData({ ...manualData, pay_cycle: e.target.value })} className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20">
                                                <option value="weekly">weekly</option>
                                                <option value="fortnightly">fortnightly</option>
                                                <option value="monthly">monthly</option>
                                            </select>
                                        </div>
                                        {/* <Input label="Base Hourly Rate ($)" type="number" step="0.01" value={manualData.weekday_rate} onChange={(e) => setManualData({ ...manualData, weekday_rate: e.target.value })} /> */}
                                    </>
                                )}
                                <Input label="Start Date" showAsterisk type="date" value={manualData.start_date} onChange={(e) => setManualData({ ...manualData, start_date: e.target.value })} />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-bold border-b pb-2 mb-3">Emergency Contact</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Contact Name" value={manualData.emergency_contact_name} onChange={(e) => setManualData({ ...manualData, emergency_contact_name: e.target.value })} />
                                <Input label="Contact Phone" type="tel" value={manualData.emergency_contact_phone} onChange={(e) => setManualData({ ...manualData, emergency_contact_phone: e.target.value })} />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-bold border-b pb-2 mb-3">Bank Details</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Account Name" value={manualData.bank_account_name} onChange={(e) => setManualData({ ...manualData, bank_account_name: e.target.value })} />
                                <Input label="BSB Number" value={manualData.bank_bsb} onChange={(e) => setManualData({ ...manualData, bank_bsb: e.target.value })} />
                                <Input label="Account Number" value={manualData.bank_account_number} onChange={(e) => setManualData({ ...manualData, bank_account_number: e.target.value })} />
                                {manualData.employment_type === 'contract' ? (
                                    <Input
                                        label="ABN"
                                        showAsterisk
                                        value={manualData.abn}
                                        onChange={(e) => setManualData({ ...manualData, abn: e.target.value })}
                                        placeholder="Format: 00 000 000 000"
                                    />
                                ) : (
                                    <Input
                                        label="TFN"
                                        showAsterisk
                                        value={manualData.tfn}
                                        onChange={(e) => setManualData({ ...manualData, tfn: e.target.value })}
                                        placeholder="Format: 000 000 000"
                                    />
                                )}
                            </div>
                        </section>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManualAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleManualAdd} loading={addManualMutation.isPending}>
                            <UserPlus size={16} className="mr-2" /> Save Employee
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </DashboardLayout>
    );
}
