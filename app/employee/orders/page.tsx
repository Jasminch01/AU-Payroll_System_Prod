"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, RefreshCw } from "lucide-react";
import { CategoryCard } from "@/components/order-guide/CategoryCard";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeOrdersDashboard() {
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const isManagerOrOwner = authUser && (authUser.role === "manager" || authUser.role === "owner");
    const todayStr = new Date().toISOString().split("T")[0];

    // Fetch daily orders for today
    const { data: reportData, isLoading, refetch } = useQuery<any>({
        queryKey: ["daily-orders-today", todayStr],
        queryFn: () => apiGet(`/daily-orders?date=${todayStr}`),
    });

    // Mutation to generate today's order tasks
    const generateTasksMutation = useMutation({
        mutationFn: () => apiPost("/daily-orders", { date: todayStr }),
        onSuccess: (data: any) => {
            toast.success(data?.message || "Ordering tasks generated successfully!");
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

    return (
        <DashboardLayout
            role={authUser?.role === "employee" ? "employee" : "manager"}
            pageTitle="Today's Orders"
            pageDescription={`Replenishment checklist for ${todayStr}. Verify counts and confirm supplier order placement.`}
        >
            <div className="space-y-6">
                {/* Global Progress Bar */}
                {totalTasks > 0 && (
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
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                                className="h-9 shrink-0 gap-1.5 font-semibold text-xs"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                                Sync Status
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
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

                            return (
                                <CategoryCard
                                    key={cat.category_id}
                                    categoryId={cat.category_id}
                                    categoryName={cat.category_name}
                                    cutoffTime={cat.cutoff_time}
                                    totalItems={cat.tasks.length}
                                    completedItems={completedCount}
                                    issueCount={issueCount}
                                    href={`/employee/orders/${cat.category_id}`}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
