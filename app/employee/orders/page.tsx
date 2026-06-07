"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, RefreshCw, ArrowLeft, AlertTriangle, Lock } from "lucide-react";
import { CategoryCard } from "@/components/order-guide/CategoryCard";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

export default function EmployeeOrdersDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const isManagerOrOwner = authUser && (authUser.role === "manager" || authUser.role === "owner");
    const todayStr = new Date().toISOString().split("T")[0];

    // Fetch daily orders for today
    const { data: reportData, isLoading, refetch } = useQuery<any>({
        queryKey: ["daily-orders-today", todayStr],
        queryFn: () => apiGet(`/daily-orders?date=${todayStr}`),
    });

    // Fetch employee clock status
    const { data: attendanceData } = useQuery<any>({
        queryKey: ["my-attendance"],
        queryFn: () => apiGet("/attendance/me"),
        enabled: authUser?.role === "employee",
    });

    const isClockedIn = authUser?.role !== "employee" ||
        attendanceData?.current_status === "CLOCK_IN" ||
        attendanceData?.current_status === "BREAK_END";

    const hasOrderingResponsibility = authUser?.role !== "employee" ||
        attendanceData?.has_ordering_responsibility === true;

    // Mutation to generate today's order tasks
    const generateTasksMutation = useMutation({
        mutationFn: () => apiPost("/daily-orders", { date: todayStr }),
        onSuccess: (data: any) => {
            const created = data?.created ?? 0;
            const skipped = data?.skipped ?? 0;
            if (created === 0) {
                if (skipped > 0) {
                    toast.info("All ordering tasks for today have already been generated.");
                } else {
                    toast.info("No tasks generated: Your active categories do not contain any active products scheduled to order today.");
                }
            } else {
                toast.success(`Successfully generated ${created} ordering task(s) for today!`);
            }
            queryClient.invalidateQueries({ queryKey: ["daily-orders-today"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to generate ordering tasks");
        },
    });

    const categoriesGrouped = reportData?.grouped || [];
    const tasks = reportData?.tasks || [];

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
        (t: any) => t.order_status !== "pending" && (t.order_status !== "issue" || t.comment_reason)
    ).length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const routerBack = () => router.back();

    return (
        <DashboardLayout
            role={(authUser?.role as any) || "employee"}
            pageTitle="Today's Orders"
            pageDescription={`Replenishment checklist for ${todayStr}. Verify counts and confirm supplier order placement.`}
        >
            <div className="space-y-6">
                {authUser?.role === "employee" && hasOrderingResponsibility && !isClockedIn && (
                    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger-light))]/10 p-4 text-[hsl(var(--danger))]">
                        <AlertTriangle className="shrink-0" size={18} />
                        <p className="text-xs font-semibold">
                            Checklist Locked: You must clock in to edit stock counts or mark items as ordered.
                        </p>
                    </div>
                )}
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground -mb-2 w-fit gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {/* Global Progress Bar */}
                {totalTasks > 0 && (hasOrderingResponsibility || isManagerOrOwner) && (
                    <Card className="border border-[hsl(var(--border))]">
                        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 flex-1">
                                <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="text-muted-foreground">Overall Stocktake Progress</span>
                                    <span className="text-foreground">{completedTasks} / {totalTasks} items ({completionPercent}%)</span>
                                </div>
                                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand rounded-full transition-all duration-300"
                                        style={{ width: `${completionPercent}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {isManagerOrOwner && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateTasksMutation.mutate()}
                                        loading={generateTasksMutation.isPending}
                                        className="h-9 gap-1.5 font-semibold text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Update Checklist
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refetch()}
                                    className="h-9 gap-1.5 font-semibold text-xs"
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                                    Sync Status
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : authUser?.role === "employee" && !hasOrderingResponsibility ? (
                    <Card className="border-dashed border-2 text-center py-12 bg-muted/5">
                        <CardContent className="space-y-3">
                            <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
                            <h4 className="font-bold text-foreground">Access Restricted</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                You do not have a published rostered shift with ordering responsibility today. 
                                Only the assigned employee can view and complete the daily orders checklist.
                            </p>
                        </CardContent>
                    </Card>
                ) : categoriesGrouped.length === 0 ? (
                    <Card className="border-dashed border-2 text-center py-12 bg-muted/5">
                        <CardContent className="space-y-3">
                            <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto" />
                            <h4 className="font-bold text-foreground">No tasks generated for today</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Tasks are automatically triggered when staff clock in for shifts assigned with ordering checklists.
                            </p>
                            {isManagerOrOwner && (
                                <Button
                                    onClick={() => generateTasksMutation.mutate()}
                                    loading={generateTasksMutation.isPending}
                                    className="mt-2 font-semibold"
                                >
                                    <Plus className="mr-1.5 h-4 w-4" /> Generate Tasks Now
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categoriesGrouped.map((cat: any) => {
                            const completedCount = cat.tasks.filter(
                                (t: any) => t.order_status !== "pending" && (t.order_status !== "issue" || t.comment_reason)
                            ).length;
                            const issueCount = cat.tasks.filter((t: any) => t.order_status === "issue").length;

                            const getCategoryHref = (categoryId: string) => {
                                if (authUser?.role === "owner") return `/owner/orders/${categoryId}`;
                                if (authUser?.role === "manager") return `/manager/orders/${categoryId}`;
                                return `/employee/orders/${categoryId}`;
                            };

                            return (
                                <CategoryCard
                                    key={cat.category_id}
                                    categoryId={cat.category_id}
                                    categoryName={cat.category_name}
                                    cutoffTime={cat.cutoff_time}
                                    totalItems={cat.tasks.length}
                                    completedItems={completedCount}
                                    issueCount={issueCount}
                                    href={getCategoryHref(cat.category_id)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
