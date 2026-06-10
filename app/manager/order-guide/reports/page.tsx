"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import {
    Calendar,
    Search,
    Loader2,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    User,
    Clock,
    FileDown,
    Layers,
    ClipboardList,
    MoveLeft,
} from "lucide-react";
import { StockStatusBadge } from "@/components/order-guide/StockStatusBadge";
import { OrderStatusBadge } from "@/components/order-guide/OrderStatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";

export default function OrderReports() {
    const { user } = useAuth();
    const basePath = user?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";
    const todayStr = new Date().toISOString().split("T")[0];
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");

    // Fetch categories to populate category filter
    const { data: categories = [] } = useQuery({
        queryKey: ["order-categories"],
        queryFn: () => apiGet<any[]>("/order-categories"),
    });

    // Fetch tasks for the selected date
    const { data: reportData, isLoading, refetch } = useQuery<any>({
        queryKey: ["daily-orders-report", selectedDate],
        queryFn: () => apiGet(`/daily-orders?date=${selectedDate}`),
    });

    const tasksList: any[] = reportData?.tasks || [];

    // Filter tasks based on UI inputs
    const filteredTasks = tasksList.filter((task) => {
        if (statusFilter !== "all" && task.order_status !== statusFilter) return false;
        if (categoryFilter !== "all" && task.category_id !== categoryFilter) return false;
        return true;
    });

    // Calculate report statistics
    const totalItems = tasksList.length;
    const completedItems = tasksList.filter(
        (t) => t.order_status !== "pending" && (t.order_status !== "issue" || t.comment_reason)
    ).length;
    const issueItems = tasksList.filter((t) => t.order_status === "issue").length;
    const orderedItems = tasksList.filter((t) => t.order_status === "ordered").length;
    const notRequiredItems = tasksList.filter((t) => t.order_status === "not_required").length;

    const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const handleExportCSV = () => {
        if (filteredTasks.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["Category", "Product", "Min Stock", "Max Stock", "Unit", "Current Stock", "Suggested Qty", "Final Qty", "Stock Status", "Order Status", "Ordered By", "Ordered At", "Reference / Reason"];
        const rows = filteredTasks.map((t) => [
            t.category?.category_name || "N/A",
            t.item?.product_name || "N/A",
            t.item?.min_stock_qty || "N/A",
            t.item?.max_stock_qty || "N/A",
            t.item?.unit || "N/A",
            t.current_stock_qty ?? "N/A",
            t.suggested_qty ?? "N/A",
            t.final_qty ?? "N/A",
            t.stock_status || "N/A",
            t.order_status || "N/A",
            t.ordered_by_user ? `${t.ordered_by_user.first_name} ${t.ordered_by_user.last_name}` : "N/A",
            t.ordered_at ? new Date(t.ordered_at).toLocaleTimeString("en-AU", { hour: '2-digit', minute: '2-digit', hour12: false }) : "N/A",
            t.order_status === "issue" ? t.comment_reason : t.order_reference || "N/A",
        ]);

        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Order_Report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DashboardLayout
            role={user?.role === "owner" ? "owner" : "manager"}
            pageTitle={
                <span className="flex items-center gap-3">
                    <Link
                        href={basePath}
                        className="inline-flex items-center text-[hsl(var(--muted-foreground))] p-1.5 -ml-1.5 transition-transform duration-200 ease-in-out hover:-translate-x-1"
                    >
                        <MoveLeft size={20} strokeWidth={2.5} />
                    </Link>
                    <span>Order Audit Reports</span>
                </span>
            }
            pageDescription="Review past stock counts, ordering checklist operations, and flagged order issues."
        >
            <div className="space-y-6">
                {/* Search & Filter Options */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Search className="h-4.5 w-4.5 text-brand" /> Report Filter Options
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                            {/* Date Selector */}
                            <div className="space-y-1.5">
                                <Label htmlFor="report_date" className="text-xs font-semibold">
                                    Checklist Date
                                </Label>
                                <Input
                                    id="report_date"
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>

                            {/* Category Filter */}
                            <div className="space-y-1.5">
                                <Label htmlFor="category_filter" className="text-xs font-semibold">
                                    Filter by Category
                                </Label>
                                <select
                                    id="category_filter"
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((c) => (
                                        <option key={c.category_id} value={c.category_id}>
                                            {c.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-1.5">
                                <Label htmlFor="status_filter" className="text-xs font-semibold">
                                    Filter by Status
                                </Label>
                                <select
                                    id="status_filter"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="ordered">Ordered</option>
                                    <option value="not_required">Not Required</option>
                                    <option value="issue">Issue</option>
                                </select>
                            </div>

                            {/* Export CSV button */}
                            <Button
                                onClick={handleExportCSV}
                                disabled={isLoading || filteredTasks.length === 0}
                                variant="outline"
                                className="font-semibold h-10 gap-1.5"
                            >
                                <FileDown className="h-4 w-4" /> Export CSV
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : totalItems === 0 ? (
                    <Card className="border-dashed border-2 text-center py-12 bg-muted/5">
                        <CardContent className="space-y-3">
                            <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                            <h4 className="font-bold text-foreground">No Records Found</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                There were no checklist tasks generated or logged on {selectedDate}.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Daily Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            {/* Completion percent */}
                            <Card className="p-4 flex flex-col justify-between">
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Completion Rate</span>
                                <span className="text-2xl font-extrabold mt-1 text-foreground">{completionPercent}%</span>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                                    <div className="h-full bg-brand rounded-full" style={{ width: `${completionPercent}%` }} />
                                </div>
                            </Card>

                            {/* Placed orders */}
                            <Card className="p-4">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Orders Placed</p>
                                <p className="text-2xl font-extrabold mt-1 text-green-600">{orderedItems} Items</p>
                                <p className="text-[10px] text-muted-foreground font-medium mt-1">Confirmed by staff</p>
                            </Card>

                            {/* Not Required */}
                            <Card className="p-4">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Not Required</p>
                                <p className="text-2xl font-extrabold mt-1 text-slate-500">{notRequiredItems} Items</p>
                                <p className="text-[10px] text-muted-foreground font-medium mt-1">Sufficient shelf stock</p>
                            </Card>

                            {/* Flagged issues */}
                            <Card className="p-4">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Flagged Issues</p>
                                <p className="text-2xl font-extrabold mt-1 text-red-500">{issueItems} Items</p>
                                <p className="text-[10px] text-muted-foreground font-medium mt-1">Requires manager attention</p>
                            </Card>
                        </div>

                        {/* List/Table of tasks */}
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <th className="p-4 pl-6">Product Details</th>
                                                <th className="p-4 text-center w-28">Stock Checked</th>
                                                <th className="p-4 text-center w-28">Final Ordered</th>
                                                <th className="p-4">Supplier</th>
                                                <th className="p-4 text-center w-28">Status</th>
                                                <th className="p-4">Checked By</th>
                                                <th className="p-4 pr-6">Notes / References</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-sm">
                                            {filteredTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                                        No records match your filters. Try selecting other parameters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredTasks.map((task) => {
                                                    const formattedTime = task.ordered_at
                                                        ? new Date(task.ordered_at).toLocaleTimeString("en-AU", { hour: '2-digit', minute: '2-digit', hour12: false })
                                                        : "";

                                                    return (
                                                        <tr key={task.order_task_id} className="hover:bg-muted/10 transition-colors">
                                                            {/* Product name & Category */}
                                                            <td className="p-4 pl-6">
                                                                <div className="font-bold">{task.item?.product_name || "N/A"}</div>
                                                                <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                                                                    <Layers className="h-3 w-3" />
                                                                    {task.category?.category_name || "N/A"}
                                                                </div>
                                                            </td>

                                                            {/* Current stock */}
                                                            <td className="p-4 text-center">
                                                                <div className="font-semibold text-foreground">
                                                                    {task.current_stock_qty !== null ? `${task.current_stock_qty} ${task.item?.unit || ""}` : "--"}
                                                                </div>
                                                                {task.stock_status !== "not_checked" && (
                                                                    <div className="mt-1">
                                                                        <StockStatusBadge status={task.stock_status} />
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Final quantity */}
                                                            <td className="p-4 text-center font-bold text-foreground">
                                                                {task.final_qty !== null ? `${task.final_qty} ${task.item?.unit || ""}` : "--"}
                                                            </td>

                                                            {/* Supplier name */}
                                                            <td className="p-4 text-xs font-semibold text-muted-foreground">
                                                                {task.supplier?.supplier_name || "Ad-Hoc"}
                                                            </td>

                                                            {/* Order Status */}
                                                            <td className="p-4 text-center">
                                                                <OrderStatusBadge status={task.order_status} />
                                                            </td>

                                                            {/* Checked by user */}
                                                            <td className="p-4 text-xs font-semibold">
                                                                {task.ordered_by_user ? (
                                                                    <div className="space-y-0.5">
                                                                        <div className="flex items-center gap-1">
                                                                            <User className="h-3 w-3 text-muted-foreground" />
                                                                            <span>{task.ordered_by_user.first_name} {task.ordered_by_user.last_name}</span>
                                                                        </div>
                                                                        {formattedTime && (
                                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                                <Clock className="h-2.5 w-2.5" />
                                                                                <span>{formattedTime}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground">--</span>
                                                                )}
                                                            </td>

                                                            {/* Reference or comment */}
                                                            <td className="p-4 pr-6 text-xs text-muted-foreground max-w-[200px] truncate">
                                                                {task.order_status === "issue" ? (
                                                                    <span className="text-red-500 font-medium" title={task.comment_reason}>
                                                                        Issue: {task.comment_reason}
                                                                    </span>
                                                                ) : task.order_reference ? (
                                                                    <span className="text-green-600 font-bold" title={task.order_reference}>
                                                                        Ref: {task.order_reference}
                                                                    </span>
                                                                ) : (
                                                                    <span>--</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
