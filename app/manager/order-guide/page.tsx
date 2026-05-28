"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import {
    ClipboardList,
    Layers,
    Truck,
    Upload,
    BarChart3,
    Plus,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

export default function OrderGuideDashboard() {
    const { user } = useAuth();
    const basePath = user?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";
    const queryClient = useQueryClient();
    const todayStr = new Date().toISOString().split("T")[0];

    // Fetch stats & details
    const { data: categories = [], isLoading: catsLoading } = useQuery({
        queryKey: ["order-categories"],
        queryFn: () => apiGet<any[]>("/order-categories"),
    });

    const { data: suppliers = [], isLoading: supsLoading } = useQuery({
        queryKey: ["order-suppliers"],
        queryFn: () => apiGet<any[]>("/order-suppliers"),
    });

    const { data: dailyOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
        queryKey: ["daily-orders", todayStr],
        queryFn: () => apiGet<any[]>(`/daily-orders?date=${todayStr}`),
    });

    // Mutation to generate today's order tasks
    const generateTasksMutation = useMutation({
        mutationFn: () => apiPost("/daily-orders", { date: todayStr }),
        onSuccess: (data: any) => {
            toast.success(data?.message || "Today's ordering tasks generated successfully!");
            queryClient.invalidateQueries({ queryKey: ["daily-orders"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to generate ordering tasks");
        },
    });

    const isLoading = catsLoading || supsLoading || ordersLoading;

    // Calculate daily order stats
    const totalItems = dailyOrders.length;
    const completedItems = dailyOrders.filter(
        (t) => t.order_status !== "pending" && (t.order_status !== "issue" || t.comment_reason)
    ).length;
    const issueItems = dailyOrders.filter((t) => t.order_status === "issue").length;
    const pendingItems = totalItems - completedItems;

    const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const statsCards = [
        {
            title: "Order Categories",
            value: categories.length,
            description: "Active product groups",
            icon: Layers,
            color: "text-blue-500 bg-blue-50 dark:bg-blue-950/20",
            href: `${basePath}/categories`,
        },
        {
            title: "Active Suppliers",
            value: suppliers.filter((s) => s.is_active).length,
            description: "Registered delivery partners",
            icon: Truck,
            color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
            href: `${basePath}/suppliers`,
        },
        {
            title: "Today's Checklist Items",
            value: totalItems,
            description: `${pendingItems} pending checks`,
            icon: ClipboardList,
            color: "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
            href: "/employee/orders",
        },
    ];

    const quickLinks = [
        {
            title: "Manage Categories & Items",
            description: "Create or modify categories and list product catalogs, min/max limits.",
            href: `${basePath}/categories`,
            icon: Layers,
            actionText: "Go to Categories",
        },
        {
            title: "Manage Suppliers",
            description: "Add or edit supplier contact info, cutoff times, and order methods.",
            href: `${basePath}/suppliers`,
            icon: Truck,
            actionText: "Go to Suppliers",
        },
        {
            title: "Import Spreadsheet",
            description: "Bulk import or update categories and items using Excel sheets or Google Sheets.",
            href: `${basePath}/import`,
            icon: Upload,
            actionText: "Import Data",
        },
        {
            title: "Order Reports",
            description: "View historical order completions, issues, and delivery compliance logs.",
            href: `${basePath}/reports`,
            icon: BarChart3,
            actionText: "View Reports",
        },
    ];

    return (
        <DashboardLayout
            role={user?.role === "owner" ? "owner" : "manager"}
            pageTitle="Product Order Guide"
            pageDescription="Setup product catalogs, track stock counts, and monitor daily supplier ordering checklists."
        >
            <div className="space-y-8">
                {/* Stats grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {statsCards.map((card, idx) => {
                        const Icon = card.icon;
                        return (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: idx * 0.08 }}
                            >
                                <Card className="hover:shadow-md transition-all">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                {card.title}
                                            </p>
                                            <p className="text-3xl font-extrabold text-foreground">{isLoading ? "..." : card.value}</p>
                                            <p className="text-xs text-muted-foreground font-medium">{card.description}</p>
                                        </div>
                                        <div className={`p-4 rounded-xl ${card.color}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                    </CardContent>
                                    <div className="px-6 py-3 border-t bg-muted/10 flex justify-between items-center text-xs font-semibold text-brand hover:bg-muted/20">
                                        <Link href={card.href} className="flex items-center gap-1">
                                            View Details <ArrowRight className="h-3 w-3" />
                                        </Link>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Today's Order Checklist Status */}
                <Card className="border border-[hsl(var(--border))]">
                    <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-brand" /> Today's Ordering Status
                            </CardTitle>
                            <CardDescription>
                                Monitor stocktaking and order placement progression for today ({todayStr}).
                            </CardDescription>
                        </div>

                        {!isLoading && totalItems === 0 && (
                            <Button
                                onClick={() => generateTasksMutation.mutate()}
                                loading={generateTasksMutation.isPending}
                                className="w-full sm:w-auto font-semibold"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Generate Ordering Tasks
                            </Button>
                        )}
                    </CardHeader>

                    <CardContent className="p-6 pt-0">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                            </div>
                        ) : totalItems === 0 ? (
                            <div className="text-center py-10 space-y-3 rounded-xl border-2 border-dashed bg-muted/10">
                                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                                <div className="space-y-1">
                                    <h4 className="font-bold text-foreground">No tasks generated for today</h4>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Ordering tasks are automatically triggered during staff clock-in or can be manual initialized below.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => generateTasksMutation.mutate()}
                                    loading={generateTasksMutation.isPending}
                                    variant="outline"
                                    className="mt-2 font-semibold"
                                >
                                    Generate Tasks Now
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Progress bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm font-semibold">
                                        <span className="text-muted-foreground">Checklist Progress</span>
                                        <span className="text-foreground">{completionPercent}% Complete</span>
                                    </div>
                                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand rounded-full transition-all duration-500"
                                            style={{ width: `${completionPercent}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Status indicators */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-green-50/10 dark:bg-green-950/5">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold">Completed Checks</p>
                                            <p className="text-lg font-bold">{completedItems} Items</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-amber-50/10 dark:bg-amber-950/5">
                                        <Clock className="h-5 w-5 text-amber-500" />
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold">Pending Checks</p>
                                            <p className="text-lg font-bold">{pendingItems} Items</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-red-50/10 dark:bg-red-950/5">
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold">Reported Issues</p>
                                            <p className="text-lg font-bold">{issueItems} Items</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button asChild variant="outline" className="font-semibold text-xs h-8">
                                        <Link href="/employee/orders">
                                            Open Today's Checklist <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Management Sections Grid */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-foreground">Management Console</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {quickLinks.map((link, idx) => {
                            const Icon = link.icon;
                            return (
                                <motion.div
                                    key={link.title}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.25, delay: 0.15 + idx * 0.05 }}
                                >
                                    <Card className="hover:shadow-md hover:border-brand/40 transition-all flex flex-col justify-between h-full">
                                        <CardHeader className="flex flex-row gap-4 items-start pb-4">
                                            <div className="p-3 bg-brand/5 rounded-xl text-brand shrink-0">
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-1">
                                                <CardTitle className="text-base font-bold">{link.title}</CardTitle>
                                                <CardDescription className="leading-relaxed">
                                                    {link.description}
                                                </CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0 flex justify-end">
                                            <Button asChild size="sm" variant="ghost" className="text-xs font-semibold text-brand hover:text-brand-hover hover:bg-brand/5">
                                                <Link href={link.href} className="flex items-center gap-1">
                                                    {link.actionText} <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
