"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { CategoryForm } from "@/components/order-guide/CategoryForm";
import {
    Plus,
    Layers,
    Clock,
    User,
    ArrowRight,
    Edit2,
    Trash2,
    Loader2,
    SlidersHorizontal,
    ListFilter,
    ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function CategoryManagement() {
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const basePath = authUser?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";
    const isOwner = authUser?.role === "owner";

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

    // Fetch categories and suppliers
    const { data: categories = [], isLoading: catsLoading } = useQuery({
        queryKey: ["order-categories"],
        queryFn: () => apiGet<any[]>("/order-categories"),
    });

    const { data: suppliers = [], isLoading: supsLoading } = useQuery({
        queryKey: ["order-suppliers"],
        queryFn: () => apiGet<any[]>("/order-suppliers"),
    });

    const createMutation = useMutation({
        mutationFn: (newCat: any) => apiPost("/order-categories", newCat),
        onSuccess: () => {
            toast.success("Category created successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-categories"] });
            setIsCreateOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to create category");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) =>
            apiPatch(`/order-categories/${id}`, updates),
        onSuccess: () => {
            toast.success("Category updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-categories"] });
            setEditingCategory(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update category");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/order-categories/${id}`),
        onSuccess: () => {
            toast.success("Category deleted/deactivated successfully");
            queryClient.invalidateQueries({ queryKey: ["order-categories"] });
            setIsDeletingId(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete category");
        },
    });

    const handleCreateCategory = (formData: any) => {
        // Enforce that only owners can create Liquor categories
        const isLiquor = formData.category_name.toLowerCase().includes("liquor");
        if (isLiquor && !isOwner) {
            toast.error("Only store owners can manage Liquor categories");
            return;
        }
        createMutation.mutate(formData);
    };

    const handleUpdateCategory = (formData: any) => {
        if (!editingCategory) return;
        const isLiquor = formData.category_name.toLowerCase().includes("liquor");
        if (isLiquor && !isOwner) {
            toast.error("Only store owners can manage Liquor categories");
            return;
        }
        updateMutation.mutate({ id: editingCategory.category_id, updates: formData });
    };

    const handleDeleteClick = (id: string, name: string) => {
        if (!isOwner) {
            toast.error("Only owners can delete categories.");
            return;
        }
        if (confirm(`Are you sure you want to soft-delete the category "${name}"? Historical logs will be preserved but active checklist runs will skip this category.`)) {
            deleteMutation.mutate(id);
        }
    };

    const isLoading = catsLoading || supsLoading;

    // Helper to get supplier name
    const getSupplierName = (supplierId: string) => {
        const found = suppliers.find((s) => s.supplier_id === supplierId);
        return found ? found.supplier_name : "None (Ad-Hoc)";
    };

    return (
        <DashboardLayout
            role={authUser?.role === "owner" ? "owner" : "manager"}
            pageTitle="Category Setup"
            pageDescription="Group products into checklists (e.g. Fruit & Veg, Liquor, Dairy) to allocate stocktakes to daily shifts."
        >
            <div className="space-y-6">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 border p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                        <ListFilter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Groups: {categories.length}
                        </span>
                    </div>

                    <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto font-semibold">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Category
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : categories.length === 0 ? (
                    <Card className="border-dashed border-2 text-center py-12 bg-muted/5">
                        <CardContent className="space-y-3">
                            <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
                            <h4 className="font-bold text-foreground">No Categories Added</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Add your first order guide category to start managing items and stocktakes.
                            </p>
                            <Button onClick={() => setIsCreateOpen(true)} className="mt-2 font-semibold">
                                <Plus className="mr-1.5 h-4 w-4" /> Add First Category
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map((category) => {
                            const supplierName = getSupplierName(category.default_supplier_id);
                            const itemCount = category.item_count ?? 0;
                            const isLiquor = category.category_name.toLowerCase().includes("liquor");

                            return (
                                <Card
                                    key={category.category_id}
                                    className={`flex flex-col justify-between hover:shadow-md transition-all border ${
                                        category.is_active ? "border-border" : "border-dashed opacity-60"
                                    }`}
                                >
                                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <CardTitle className="text-base font-bold truncate max-w-[200px]">
                                                    {category.category_name}
                                                </CardTitle>
                                                {!category.is_active && (
                                                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-semibold uppercase">
                                                        Inactive
                                                    </span>
                                                )}
                                                {isLiquor && (
                                                    <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold uppercase flex items-center gap-0.5">
                                                        <ShieldAlert className="h-2.5 w-2.5" /> Owner Only
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Default Supplier: <span className="font-semibold text-foreground">{supplierName}</span>
                                            </p>
                                        </div>
                                        <div className="bg-brand/5 text-brand px-2.5 py-1 rounded-lg text-xs font-extrabold shrink-0">
                                            {itemCount} {itemCount === 1 ? "item" : "items"}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-4 text-xs font-semibold pb-4">
                                        <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-3 border-t border-dashed">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>Cut-off: {category.cutoff_time ? category.cutoff_time.substring(0, 5) : "N/A"}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <User className="h-3.5 w-3.5" />
                                                <span className="capitalize">{category.responsible_role}s</span>
                                            </div>
                                        </div>

                                        {category.order_days && category.order_days.length > 0 && (
                                            <div className="space-y-1 pt-1">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Schedule</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {category.order_days.map((day: string) => (
                                                        <span key={day} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground">
                                                            {day}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 pt-3 border-t">
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingCategory(category)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="Edit Category Settings"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(category.category_id, category.category_name)}
                                                        disabled={deleteMutation.isPending && isDeletingId === category.category_id}
                                                        className="h-8 w-8 text-muted-foreground hover:text-danger"
                                                        title="Delete Category"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>

                                            <Button asChild size="sm" variant="ghost" className="text-brand hover:text-brand-hover hover:bg-brand/5 text-xs">
                                                <Link href={`${basePath}/categories/${category.category_id}`} className="flex items-center gap-1">
                                                    Manage Items <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Create Modal */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Create New Category</DialogTitle>
                            <DialogDescription>
                                Set up a new product category group and establish order parameters.
                            </DialogDescription>
                        </DialogHeader>
                        <CategoryForm
                            suppliers={suppliers}
                            onSubmit={handleCreateCategory}
                            onCancel={() => setIsCreateOpen(false)}
                            isLoading={createMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>

                {/* Edit Modal */}
                <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Edit Category Settings</DialogTitle>
                            <DialogDescription>
                                Modify configurations for the selected order category.
                            </DialogDescription>
                        </DialogHeader>
                        {editingCategory && (
                            <CategoryForm
                                initialData={editingCategory}
                                suppliers={suppliers}
                                onSubmit={handleUpdateCategory}
                                onCancel={() => setEditingCategory(null)}
                                isLoading={updateMutation.isPending}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
