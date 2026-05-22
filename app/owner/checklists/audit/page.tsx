"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui";
import { apiGet } from "@/lib/api-client";
import {
    ClipboardList,
    Search,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    Info,
    MoveLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function ChecklistAuditPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState({
        from: format(new Date(), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
    });
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["checklist-audit", dateRange.from, dateRange.to],
        queryFn: () => apiGet<any[]>("/checklist-review", { from: dateRange.from, to: dateRange.to }),
    });

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesSearch =
                r.task_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.Shift?.Employee?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.Shift?.Employee?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;

            return matchesSearch && matchesStatus;
        });
    }, [records, searchQuery, filterStatus]);

    const stats = useMemo(() => {
        const total = records.length;
        const done = records.filter(r => r.status === 'done').length;
        const pending = records.filter(r => r.status === 'pending').length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;

        return { total, done, pending, percent };
    }, [records]);

    return (
        <DashboardLayout
            role="owner"
            pageTitle={
                <span className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"
                        title="Back"
                    >
                        <MoveLeft size={20} strokeWidth={2.5} />
                    </button>
                    <span>Checklist Audit</span>
                </span>
            }
            pageDescription="Review task completion across all shifts"
        >
            <div className="space-y-6">
                {/* Stats Header */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-[hsl(var(--brand-light))]/30 rounded-xl">
                                    <ClipboardList size={24} className="text-[hsl(var(--brand))]" />
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-600 border-none font-bold">Overall</Badge>
                            </div>
                            <h3 className="text-3xl font-black">{stats.percent}%</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Completion Rate</p>
                            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[hsl(var(--brand))] transition-all duration-1000" style={{ width: `${stats.percent}%` }} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-emerald-50 rounded-xl">
                                    <CheckCircle2 size={24} className="text-emerald-500" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-black">{stats.done}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Tasks Completed</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-amber-50 rounded-xl">
                                    <Clock size={24} className="text-amber-500" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-black text-amber-600">{stats.pending}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pending Tasks</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <Calendar size={24} className="text-slate-500" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">{format(new Date(dateRange.from), 'MMM d')} - {format(new Date(dateRange.to), 'MMM d')}</span>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Audit Period</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl border border-[hsl(var(--border))] flex flex-wrap items-center gap-4 shadow-sm">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="Search tasks, employees..."
                            className="pl-10 h-11 bg-slate-50 border-none rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-9 px-4 rounded-lg text-xs font-bold", filterStatus === 'all' ? "bg-white shadow-sm text-[hsl(var(--brand))]" : "text-slate-500")}
                                onClick={() => setFilterStatus('all')}
                            >
                                All
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-9 px-4 rounded-lg text-xs font-bold", filterStatus === 'done' ? "bg-white shadow-sm text-emerald-600" : "text-slate-500")}
                                onClick={() => setFilterStatus('done')}
                            >
                                Done
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-9 px-4 rounded-lg text-xs font-bold", filterStatus === 'pending' ? "bg-white shadow-sm text-amber-600" : "text-slate-500")}
                                onClick={() => setFilterStatus('pending')}
                            >
                                Pending
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => {
                                const d = new Date(dateRange.from);
                                d.setDate(d.getDate() - 1);
                                const s = format(d, 'yyyy-MM-dd');
                                setDateRange({ from: s, to: s });
                            }}
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <div className="px-3 text-xs font-black uppercase tracking-tighter">
                            {format(new Date(dateRange.from), 'EEE, MMM d')}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => {
                                const d = new Date(dateRange.from);
                                d.setDate(d.getDate() + 1);
                                const s = format(d, 'yyyy-MM-dd');
                                setDateRange({ from: s, to: s });
                            }}
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <Card className="bg-white border-none shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Employee</th>
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Task</th>
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Shift Type</th>
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Reason / Notes</th>
                                        <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">Completed At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        [1, 2, 3, 4, 5].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={6} className="px-6 py-4"><div className="h-10 bg-slate-50 rounded-lg" /></td>
                                            </tr>
                                        ))
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center opacity-20">
                                                    <AlertCircle size={48} className="mb-2" />
                                                    <p className="font-bold">No records found for this period.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRecords.map((record) => (
                                        <tr key={record.checklist_item_id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-[hsl(var(--brand-light))]/30 flex items-center justify-center text-[hsl(var(--brand))] font-bold text-xs">
                                                        {record.Shift?.Employee?.first_name?.[0]}{record.Shift?.Employee?.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-700">{record.Shift?.Employee?.first_name} {record.Shift?.Employee?.last_name}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">Employee ID: {record.Shift?.Employee?.employee_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="max-w-md">
                                                    <p className="font-bold text-slate-700 line-clamp-1">{record.task_text}</p>
                                                    {record.is_required && (
                                                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-amber-500 mt-0.5">
                                                            <Info size={10} /> Required Task
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 font-bold capitalize h-6">
                                                    {record.Shift?.shift_type}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        record.status === 'done' ? "bg-emerald-500" :
                                                            record.status === 'not_done' ? "bg-rose-500" :
                                                                record.status === 'not_applicable' ? "bg-slate-400" : "bg-amber-500"
                                                    )} />
                                                    <span className={cn(
                                                        "text-xs font-black uppercase tracking-widest",
                                                        record.status === 'done' ? "text-emerald-600" :
                                                            record.status === 'not_done' ? "text-rose-600" :
                                                                record.status === 'not_applicable' ? "text-slate-500" : "text-amber-600"
                                                    )}>
                                                        {record.status?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.status === 'not_done' && record.reason ? (
                                                    <span className="text-xs text-rose-600 font-semibold bg-rose-50/50 border border-rose-100 px-2 py-1 rounded-md italic inline-block max-w-xs truncate" title={record.reason}>
                                                        "{record.reason}"
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.completed_at ? (
                                                    <div>
                                                        <p className="font-bold text-slate-700">{format(new Date(record.completed_at), 'h:mm a')}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">{format(new Date(record.completed_at), 'MMM d, yyyy')}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 italic font-medium">Not completed</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
