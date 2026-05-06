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
import { UserPlus, Users, Send, RefreshCw, Copy, Check, MoreHorizontal, Eye, ExternalLink, Trash2, AlertTriangle, Filter, X, Briefcase, User, ShieldCheck, UserPlus2, ChevronRight, Shield, Lock, CreditCard, ChevronDown, Info, Plus } from "lucide-react";
import type { Employee } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { generateBusinessPrefix, formatEmpSuffix, getNumericSuffix } from "@/lib/utils/employee-id";
import { useBusinessTimezone } from "@/lib/timezone-context";
import { getDateInTimezone } from "@/lib/timezone-utils";

type StatusFilter = "all" | "active" | "invited" | "inactive";
type RoleFilter = "all" | "employee" | "manager";

export default function OwnerEmployeesPage() {
    const { businessTimezone } = useBusinessTimezone();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [inviteOpen, setInviteOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

    // Server-side table state
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("first_name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const pageSize = 10;



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
    const [bulkData, setBulkData] = useState<any[]>([{ first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', role: 'employee' }]);

    // Join Code state
    const [joinCode, setJoinCode] = useState<string | null>(null);
    const [isGeneratingJoinCode, setIsGeneratingJoinCode] = useState(false);

    // Manual Add state
    const [manualAddOpen, setManualAddOpen] = useState(false);
    const [manualData, setManualData] = useState<any>({
        first_name: '', last_name: '', email: '', phone: '', dob: '',
        emergency_contact_name: '', emergency_contact_phone: '',
        role_title: '', employment_type: '', pay_cycle: 'weekly',
        start_date: getDateInTimezone(new Date().toISOString(), businessTimezone),
        weekday_rate: '',
        password: '',
        role: 'employee',
        bank_account_name: '', bank_bsb: '', bank_account_number: '', abn: '', tfn: ''
    });

    const [inviteExistingOpen, setInviteExistingOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [inviteExistingEmail, setInviteExistingEmail] = useState("");

    const { user } = useAuth();

    // Query payload builder
    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: pageSize.toString(),
            paginate: 'true',
            search,
            sortBy: sortKey,
            sortDir,
        });
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (roleFilter !== "all") params.append("role", roleFilter);
        return params.toString();
    }, [page, search, sortKey, sortDir, statusFilter, roleFilter]);

    const { data: responseData, isLoading } = useQuery({
        queryKey: ["employees", queryParams],
        queryFn: () => apiGet<any>(`/employees?${queryParams}`),
    });

    const employees = responseData?.employees || [];
    const metaCounts = responseData?.meta?.counts || {
        all: 0,
        active: 0,
        invited: 0,
        inactive: 0,
        employee: 0,
        manager: 0
    };
    const totalItems = responseData?.meta?.total_count || 0;

    // Reset page when filters change
    React.useEffect(() => {
        setPage(1);
    }, [statusFilter, roleFilter, search]);

    // Real-time Sync for Employee List
    React.useEffect(() => {
        if (!user?.business_id) return;

        const supabase = createClient();
        const channel = supabase
            .channel('employee-table-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Employee',
                    filter: `business_id=eq.${user.business_id}`
                },
                (payload: any) => {
                    queryClient.invalidateQueries({ queryKey: ["employees"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.business_id, queryClient]);

    // Auto-generate employee_id for manual add
    React.useEffect(() => {
        if (manualAddOpen && user?.business?.business_name) {
            const prefix = generateBusinessPrefix(user.business.business_name);
            const activeEmps = employees.map((e: Employee) => e.employee_id);

            let maxSerial = 0;
            for (const id of activeEmps) {
                const serial = getNumericSuffix(id);
                if (serial > maxSerial) maxSerial = serial;
            }

            const nextId = `${prefix}${formatEmpSuffix(maxSerial + 1)}`;
            setManualData((prev: any) => ({ ...prev, employee_id: nextId }));
        }
    }, [manualAddOpen, user?.business?.business_name, employees]);

    // We don't need client-side filtering anymore since server handles it
    const filteredEmployees = employees;

    const counts = metaCounts;

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
                start_date: getDateInTimezone(new Date().toISOString(), businessTimezone),
                weekday_rate: '',
                password: '',
                role: 'employee',
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
                start_date: getDateInTimezone(new Date().toISOString(), businessTimezone),
                weekday_rate: '',
                password: '',
                role: 'employee',
                employee_id: '',
                bank_account_name: '', bank_bsb: '', bank_account_number: '', abn: '', tfn: ''
            });
        },
        // consol.log
        onError: (err: Error) => toast.error(err.message),
    });

    const handleManualAdd = () => {
        if (!manualData.first_name || !manualData.last_name || !manualData.start_date) {
            return toast.error("Please fill in first name, last name, and start date.");
        }
        addManualMutation.mutate({
            ...manualData,
            invite_as: manualData.role, // Map role to invite_as for backward compatibility in backend if needed
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
        setBulkData([{ first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', role: 'employee' }]);
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

    const handleInviteExisting = () => {
        if (!inviteExistingEmail || !selectedEmployee) {
            return toast.error("Please enter an email address.");
        }
        inviteMutation.mutate({
            email: inviteExistingEmail,
            first_name: selectedEmployee.first_name,
            last_name: selectedEmployee.last_name,
            employee_id: selectedEmployee.employee_id,
            invite_as: selectedEmployee.role === 'manager' ? 'manager' : 'employee'
        });
        setInviteExistingOpen(false);
        setSelectedEmployee(null);
        setInviteExistingEmail("");
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
            label: "Employee",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-sm font-bold shrink-0">
                        {(row.first_name?.[0] ?? "")}{(row.last_name?.[0] ?? "")}
                    </div>
                    <div>
                        <p className="font-medium leading-none mb-1">{row.first_name} {row.last_name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{row.email || "Not Invited"}</p>
                    </div>
                </div>
            ),
        },
        {
            key: "employee_id",
            label: "ID",
            sortable: true,
            render: (row) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(row.employee_id);
                        toast.success(`ID ${row.employee_id} copied!`);
                    }}
                    className="group flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all active:scale-95"
                    title="Click to copy ID"
                >
                    {row.employee_id}
                    <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            )
        },
        {
            key: "role",
            label: "Access",
            sortable: true,
            render: (row) => (
                <div className="flex items-center">
                    <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight",
                        row.role === 'manager'
                            ? "bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]"
                            : "bg-slate-100 text-slate-500"
                    )}>
                        {row.role === 'manager' ? 'Manager' : 'Staff'}
                    </span>
                </div>
            )
        },
        {
            key: "role_title",
            label: "Job Title",
            sortable: true,
            render: (row) => <span className="font-medium">{row.role_title || "—"}</span>
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
                            {!row.user_id && (
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedEmployee(row);
                                        setInviteExistingOpen(true);
                                    }}
                                    className="cursor-pointer text-[hsl(var(--brand))]"
                                >
                                    <Send size={14} className="mr-2" />
                                    Invite Now
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
            <DataTable
                serverPagination
                maxHeight="calc(90vh - 280px)"
                totalItems={totalItems}
                pageSize={pageSize}
                page={page}
                onPageChange={setPage}
                onSearch={setSearch}
                onSort={(key, dir) => {
                    setSortKey(key);
                    setSortDir(dir);
                }}
                columns={columns}
                data={filteredEmployees}
                searchable
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

                    </div>
                )}
                filters={
                    <>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9 gap-2 rounded-lg border-[hsl(var(--border))] px-3 shadow-sm shrink-0">
                                    <Filter size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    <span className="hidden sm:inline-block font-semibold">Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                                    <span className="sm:hidden font-semibold">{statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-[9px] font-black">
                                        {counts[statusFilter]}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                                {STATUS_TABS.map((tab) => (
                                    <DropdownMenuItem
                                        key={tab.key}
                                        onClick={() => setStatusFilter(tab.key)}
                                        className={cn("flex items-center justify-between cursor-pointer rounded-lg py-2 transition-all", statusFilter === tab.key && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}
                                    >
                                        <span className="font-medium">{tab.label}</span>
                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{counts[tab.key]}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {statusFilter !== "all" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setStatusFilter("all")}
                                className="h-9 w-9 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0 ml-[-8px]"
                            >
                                <X size={14} />
                            </Button>
                        )}

                        <div className="hidden lg:block h-5 w-px bg-[hsl(var(--border))] mx-1 opacity-50 shrink-0" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9 gap-2 rounded-lg border-[hsl(var(--border))] px-3 shadow-sm shrink-0">
                                    <ShieldCheck size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    <span className="hidden sm:inline-block font-semibold">Access: {roleFilter === 'all' ? 'All Roles' : (roleFilter === 'manager' ? 'Managers' : 'Staff')}</span>
                                    <span className="sm:hidden font-semibold">{roleFilter === 'all' ? 'Access' : (roleFilter === 'manager' ? 'Managers' : 'Staff')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                                <DropdownMenuItem onClick={() => setRoleFilter("all")} className={cn("cursor-pointer rounded-lg py-2 font-medium transition-all", roleFilter === "all" && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}>All Access Levels</DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem onClick={() => setRoleFilter("manager")} className={cn("flex items-center justify-between cursor-pointer rounded-lg py-2 font-medium transition-all", roleFilter === "manager" && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}>
                                    <span>Managers</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{counts.manager}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRoleFilter("employee")} className={cn("flex items-center justify-between cursor-pointer rounded-lg py-2 font-medium transition-all", roleFilter === "employee" && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]")}>
                                    <span>Staff</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{counts.employee}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {roleFilter !== "all" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRoleFilter("all")}
                                className="h-9 w-9 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0 ml-[-8px]"
                            >
                                <X size={14} />
                            </Button>
                        )}
                    </>
                }
                actions={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="fixed bottom-24 right-6 size-10 lg:h-9 lg:w-auto p-0 lg:px-4 lg:py-2 gap-2 shadow-2xl shadow-[hsl(var(--brand))]/40 lg:shadow-md hover:shadow-lg transition-all lg:ml-2 rounded-full lg:rounded-lg z-50 lg:static">
                                <Plus size={24} className="lg:w-4 lg:h-4" />
                                <span className="hidden lg:inline">Add People</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl p-1.5 border-[hsl(var(--border))]">
                            <DropdownMenuItem onClick={() => setInviteOpen(true)} className="py-3 px-3 rounded-lg cursor-pointer hover:bg-[hsl(var(--muted))]/50">
                                <User size={16} className="mr-3 text-[hsl(var(--brand))]" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">Single Invitation</span>
                                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Invite one person at a time</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setBulkInviteOpen(true)} className="py-3 px-3 rounded-lg cursor-pointer hover:bg-[hsl(var(--muted))]/50">
                                <Users size={16} className="mr-3 text-[hsl(var(--brand))]" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">Multiple Invitations</span>
                                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Add many people at once</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setManualAddOpen(true)} className="py-3 px-3 rounded-lg cursor-pointer hover:bg-[hsl(var(--muted))]/50">
                                <Briefcase size={16} className="mr-3 text-[hsl(var(--brand))]" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">Add Manually</span>
                                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Complete setup right now</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1.5" />
                            <DropdownMenuItem onClick={handleGenerateJoinCode} disabled={isGeneratingJoinCode} className="py-3 px-3 rounded-lg cursor-pointer hover:bg-[hsl(var(--muted))]/50">
                                <ExternalLink size={16} className="mr-3 text-[hsl(var(--brand))]" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">Business Join Link</span>
                                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Reusable link for your team</span>
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
                                <option value="employee">Standard Staff</option>
                                <option value="manager">Business Manager</option>
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
                                onClick={() => setBulkData([...bulkData, { first_name: '', last_name: '', email: '', role_title: '', phone: '', employment_type: '', role: 'employee' }])}
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
                <DialogContent className="max-w-3xl overflow-hidden p-0 border-0 rounded-2xl shadow-2xl [&>button]:text-white [&>button]:font-black [&>button]:z-50 [&>button]:right-6 [&>button]:top-6 [&>button]:scale-125">
                    <div className="p-6 bg-[hsl(var(--brand))] text-white relative overflow-hidden shrink-0">
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                <UserPlus size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">Add New Team Member</DialogTitle>
                                <DialogDescription className="text-white/70 text-sm mt-1">
                                    Create a complete profile and grant system access.
                                </DialogDescription>
                            </div>
                        </div>
                        {/* Decorative background elements */}
                        <div className="absolute -right-8 -top-8 h-32 w-32 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute right-20 bottom-0 h-16 w-16 bg-white/10 rounded-full blur-2xl" />
                    </div>

                    <div className="overflow-y-auto max-h-[calc(90vh-160px)] p-6 space-y-8 custom-scrollbar">
                        {/* Access Level Selector */}
                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3 border-b border-slate-200/50 pb-3">
                                <div className="h-8 w-8 rounded-lg bg-[hsl(var(--brand-light))]/20 flex items-center justify-center text-[hsl(var(--brand))]">
                                    <Shield size={18} />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">System Permissions</h3>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Choose Access Level</label>
                                <div className="relative group">
                                    <select
                                        value={manualData.role}
                                        onChange={(e) => setManualData({ ...manualData, role: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-[hsl(var(--brand))]/10 focus:border-[hsl(var(--brand))] hover:border-[hsl(var(--brand))]/30 appearance-none cursor-pointer pr-10"
                                    >
                                        <option value="employee">Standard Staff Member</option>
                                        <option value="manager">Business Manager</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-[hsl(var(--brand))] transition-colors">
                                        <ChevronDown size={18} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <div className="h-4 w-4 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                        <Info size={10} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic">Managers can edit rosters and manage other team members</p>
                                </div>
                            </div>
                        </div>

                        {/* Identity Section */}
                        <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-1">
                                <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                    <User size={18} />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">Personal Identity</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="First Name" showAsterisk placeholder="John" value={manualData.first_name} onChange={(e) => setManualData({ ...manualData, first_name: e.target.value })} />
                                <Input label="Last Name" showAsterisk placeholder="Doe" value={manualData.last_name} onChange={(e) => setManualData({ ...manualData, last_name: e.target.value })} />
                                <Input label="Email (Optional)" type="email" placeholder="john@example.com" value={manualData.email} onChange={(e) => setManualData({ ...manualData, email: e.target.value })} />
                                <Input label="Phone Number" type="tel" placeholder="0400 000 000" value={manualData.phone} onChange={(e) => setManualData({ ...manualData, phone: e.target.value })} />
                            </div>
                        </section>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Employment Section */}
                            <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-5 h-full">
                                <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-1">
                                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Briefcase size={18} />
                                    </div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">Employment</h3>
                                </div>
                                <div className="space-y-4">
                                    {manualData.role === "employee" && (
                                        <Input label="Job Title" placeholder="e.g. Senior Barista" value={manualData.role_title} onChange={(e) => setManualData({ ...manualData, role_title: e.target.value })} />
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold ml-0.5 text-slate-600">
                                            Employment Type <span className="text-red-500">*</span>
                                        </label>
                                        <select value={manualData.employment_type} onChange={(e) => setManualData({ ...manualData, employment_type: e.target.value })} className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 transition-all font-medium">
                                            <option value="" disabled>Select</option>
                                            <option value="full_time">Full Time</option>
                                            <option value="part_time">Part Time</option>
                                            <option value="casual">Casual</option>
                                            <option value="contract">Contract</option>
                                        </select>
                                    </div>
                                    <Input label="Start Date" showAsterisk type="date" value={manualData.start_date} onChange={(e) => setManualData({ ...manualData, start_date: e.target.value })} />
                                </div>
                            </section>

                            <div className="space-y-6">
                                {/* Security Section */}
                                <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-1">
                                        <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                                            <Lock size={18} />
                                        </div>
                                        <h3 className="font-bold text-slate-800 tracking-tight">Access Security</h3>
                                    </div>
                                    <Input label="Temporary Password (Optional)" type="password" placeholder="Min. 8 characters" value={manualData.password} onChange={(e) => setManualData({ ...manualData, password: e.target.value })} />
                                </section>

                                {/* Emergency Section */}
                                <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-1">
                                        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                                            <Shield size={18} />
                                        </div>
                                        <h3 className="font-bold text-slate-800 tracking-tight">Emergency</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <Input label="Contact Name" placeholder="Full name" value={manualData.emergency_contact_name} onChange={(e) => setManualData({ ...manualData, emergency_contact_name: e.target.value })} />
                                        <Input label="Contact Phone" type="tel" placeholder="0400 000 000" value={manualData.emergency_contact_phone} onChange={(e) => setManualData({ ...manualData, emergency_contact_phone: e.target.value })} />
                                    </div>
                                </section>
                            </div>
                        </div>

                        {/* Financial Details hidden for Rostering module Phase */}
                        {/* 
                        <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-1">
                                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                                    <CreditCard size={18} />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">Financial Details</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Account Name" value={manualData.bank_account_name} onChange={(e) => setManualData({ ...manualData, bank_account_name: e.target.value })} />
                                <Input label="BSB Number" value={manualData.bank_bsb} onChange={(e) => setManualData({ ...manualData, bank_bsb: e.target.value })} />
                                <Input label="Account Number" value={manualData.bank_account_number} onChange={(e) => setManualData({ ...manualData, bank_account_number: e.target.value })} />
                                {manualData.employment_type === 'contract' ? (
                                    <Input label="ABN" showAsterisk placeholder="00 000 000 000" ... />
                                ) : (
                                    <Input label="TFN" showAsterisk placeholder="000 000 000" ... />
                                )}
                            </div>
                        </section>
                        */}
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 border-t z-20 shrink-0">
                        <Button variant="outline" onClick={() => setManualAddOpen(false)} className="rounded-xl px-6">Cancel</Button>
                        <Button onClick={handleManualAdd} loading={addManualMutation.isPending} className="rounded-xl px-8 shadow-lg shadow-[hsl(var(--brand))]/20">
                            <UserPlus size={16} className="mr-2" /> Save Employee Profile
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invite Existing Employee Dialog */}
            <Dialog open={inviteExistingOpen} onOpenChange={setInviteExistingOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Employee</DialogTitle>
                        <DialogDescription>
                            Send an invitation to {selectedEmployee?.first_name} {selectedEmployee?.last_name}. They will be able to set their own password and access the system.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <Input
                            label="Email Address"
                            type="email"
                            showAsterisk
                            placeholder="jane@company.com"
                            value={inviteExistingEmail}
                            onChange={(e) => setInviteExistingEmail(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setInviteExistingOpen(false); setSelectedEmployee(null); setInviteExistingEmail(""); }}>Cancel</Button>
                        <Button onClick={handleInviteExisting} loading={inviteMutation.isPending}>
                            <Send size={16} />
                            Send Invitation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </DashboardLayout>
    );
}
