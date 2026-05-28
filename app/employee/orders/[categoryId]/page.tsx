"use client";

import React, { useState, use } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ClipboardCheck, Lock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ProductOrderCard } from "@/components/order-guide/ProductOrderCard";
import { OrderingInstructionModal } from "@/components/order-guide/OrderingInstructionModal";
import { OrderGuideItem, DailyOrderTask, OrderSupplier } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeCategoryOrdering({ params }: { params: Promise<{ categoryId: string }> }) {
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();

    // Unwrapping Next.js params using React.use
    const resolvedParams = use(params);
    const categoryId = resolvedParams.categoryId;

    const todayStr = new Date().toISOString().split("T")[0];

    // Instruction modal state
    const [selectedInstruction, setSelectedInstruction] = useState<{
        item: OrderGuideItem;
        task: DailyOrderTask;
        supplier: OrderSupplier | null;
    } | null>(null);

    // Fetch tasks/products for this category today
    const { data: categoryData, isLoading, refetch } = useQuery<any>({
        queryKey: ["daily-orders-category", categoryId, todayStr],
        queryFn: () => apiGet(`/daily-orders?date=${todayStr}&category_id=${categoryId}`),
    });

    // Mutation to update a single order task
    const updateTaskMutation = useMutation({
        mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<DailyOrderTask> }) =>
            apiPatch(`/daily-orders/${taskId}`, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["daily-orders-category", categoryId, todayStr] });
            queryClient.invalidateQueries({ queryKey: ["daily-orders-today", todayStr] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save stock check");
        },
    });

    // Bulk update tasks mutation
    const bulkUpdateMutation = useMutation({
        mutationFn: async (updates: Array<{ taskId: string; updates: Partial<DailyOrderTask> }>) => {
            // Update sequentially or concurrently using axios calls
            await Promise.all(updates.map(u => apiPatch(`/daily-orders/${u.taskId}`, u.updates)));
        },
        onSuccess: () => {
            toast.success("All items updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["daily-orders-category", categoryId, todayStr] });
            queryClient.invalidateQueries({ queryKey: ["daily-orders-today", todayStr] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update items");
        },
    });

    const handleUpdateTask = async (taskId: string, updates: Partial<DailyOrderTask>) => {
        await updateTaskMutation.mutateAsync({ taskId, updates });
    };

    const handleBulkMarkOrdered = () => {
        const tasks: any[] = categoryData?.tasks || [];
        const pendingTasks = tasks.filter(t => t.order_status === "pending" || t.order_status === "not_checked");

        if (pendingTasks.length === 0) {
            toast.info("No pending items to mark as ordered.");
            return;
        }

        // Before bulk ordering, verify if they all have a stock checked. If not, alert them to enter stock count.
        const unchecked = pendingTasks.filter(t => t.current_stock_qty === null || t.current_stock_qty === undefined);
        if (unchecked.length > 0) {
            toast.error("Please enter current stock counts for all items before marking as Ordered.");
            return;
        }

        const updates = pendingTasks.map(t => ({
            taskId: t.order_task_id,
            updates: {
                order_status: "ordered" as const,
                // Default the final_qty to suggested_qty if not already custom set
                final_qty: t.final_qty !== null ? t.final_qty : t.suggested_qty,
            }
        }));

        bulkUpdateMutation.mutate(updates);
    };

    const categoryTasks: any[] = categoryData?.tasks || [];
    const categoryInfo = categoryTasks[0]?.category;
    const catName = categoryInfo?.category_name || "Ordering Category";

    // Compliance check for Liquor
    const isLiquor = catName.toLowerCase().includes("liquor");
    const hasLiquorPermission = authUser?.role === "owner" || authUser?.can_order_liquor;

    if (!isLoading && isLiquor && !hasLiquorPermission) {
        return (
            <DashboardLayout
                role={authUser?.role === "employee" ? "employee" : "manager"}
                pageTitle="Access Restricted"
                pageDescription="Compliance verification failed."
            >
                <Card className="max-w-md mx-auto border-red-200 bg-red-50/20 dark:border-red-950 dark:bg-red-950/10">
                    <CardHeader className="text-center pb-4 flex flex-col items-center">
                        <Lock className="h-10 w-10 text-red-500 mb-2" />
                        <CardTitle className="text-red-800 dark:text-red-400">Liquor Ordering Locked</CardTitle>
                        <CardDescription>
                            Ordering compliance rules prohibit access to Liquor key items.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Only store owners or managers specifically granted permission by the owner are allowed to order liquor. Contact your store owner to request permissions.
                        </p>
                        <Button asChild variant="outline" className="w-full font-semibold">
                            <Link href="/employee/orders">
                                <ArrowLeft className="mr-1.5 h-4 w-4" /> Go Back
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            role={authUser?.role === "employee" ? "employee" : "manager"}
            pageTitle={`Order Checklist: ${catName}`}
            pageDescription={`Perform inventory stock checks and log order placements for today.`}
        >
            <div className="space-y-6 max-w-4xl">
                {/* Navigation and Bulk actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/employee/orders" className="flex items-center gap-1">
                            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                        </Link>
                    </Button>

                    {!isLoading && categoryTasks.length > 0 && (
                        <Button
                            onClick={handleBulkMarkOrdered}
                            disabled={bulkUpdateMutation.isPending}
                            className="w-full sm:w-auto font-semibold gap-1.5"
                        >
                            <ClipboardCheck className="h-4.5 w-4.5" />
                            Bulk Mark Checked as Ordered
                        </Button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : categoryTasks.length === 0 ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground font-semibold">No products assigned for ordering today.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {categoryTasks.map((task) => (
                            <ProductOrderCard
                                key={task.order_task_id}
                                item={task.item}
                                task={task}
                                onUpdateTask={(updates) => handleUpdateTask(task.order_task_id, updates)}
                                onShowInstructions={() =>
                                    setSelectedInstruction({
                                        item: task.item,
                                        task,
                                        supplier: task.supplier,
                                    })
                                }
                                isUpdating={updateTaskMutation.isPending && updateTaskMutation.variables?.taskId === task.order_task_id}
                            />
                        ))}
                    </div>
                )}

                {/* Instruction Modal */}
                {selectedInstruction && (
                    <OrderingInstructionModal
                        isOpen={!!selectedInstruction}
                        onClose={() => setSelectedInstruction(null)}
                        item={selectedInstruction.item}
                        supplier={selectedInstruction.supplier}
                        suggestedQty={
                            selectedInstruction.task.final_qty !== null
                                ? selectedInstruction.task.final_qty
                                : selectedInstruction.task.suggested_qty
                        }
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
