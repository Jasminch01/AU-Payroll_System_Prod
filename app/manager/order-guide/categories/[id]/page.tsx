"use client";

import React, { useState, use } from "react";
import { DashboardLayout } from "@/components/layout";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import {
    ArrowLeft,
    Plus,
    Loader2,
    Edit2,
    Trash2,
    Calendar,
    Truck,
    PackageOpen,
    Save,
    X,
    Clock,
    User,
    Check,
    MoveLeft,
} from "lucide-react";
import Link from "next/link";
import { OrderGuideItem, OrderSupplier, OrderingMethod, OrderFrequency } from "@/types/database";
import { useAuth } from "@/hooks/use-auth";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ORDERING_METHODS: { value: OrderingMethod; label: string }[] = [
    { value: "portal", label: "Supplier Web Portal" },
    { value: "phone", label: "Phone Call" },
    { value: "sms", label: "SMS / Text Message" },
    { value: "email", label: "Email Order" },
    { value: "rep", label: "Sales Representative" },
    { value: "metcash", label: "Metcash Portal" },
];

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    suppliers: OrderSupplier[];
    initialData?: Partial<OrderGuideItem>;
    onSubmit: (data: any) => void;
    isLoading: boolean;
    categoryId: string;
}

function ProductFormModal({
    isOpen,
    onClose,
    suppliers,
    initialData = {},
    onSubmit,
    isLoading,
    categoryId,
}: ProductFormModalProps) {
    const [name, setName] = useState(initialData.product_name || "");
    const [minStock, setMinStock] = useState(initialData.min_stock_qty !== undefined ? initialData.min_stock_qty.toString() : "2");
    const [maxStock, setMaxStock] = useState(initialData.max_stock_qty !== undefined ? initialData.max_stock_qty.toString() : "5");
    const [defaultOrder, setDefaultOrder] = useState(initialData.default_order_qty !== null && initialData.default_order_qty !== undefined ? initialData.default_order_qty.toString() : "");
    const [unit, setUnit] = useState(initialData.unit || "box");
    const [freq, setFreq] = useState<OrderFrequency>(initialData.order_frequency || "daily");
    const [orderDays, setOrderDays] = useState<string[]>(initialData.order_days || []);
    const [supplierId, setSupplierId] = useState(initialData.supplier_id || "");
    const [method, setMethod] = useState<OrderingMethod | "">(initialData.ordering_method || "");
    const [instruction, setInstruction] = useState(initialData.ordering_instruction || "");
    const [comment, setComment] = useState(initialData.comment || "");
    const [isActive, setIsActive] = useState(initialData.is_active !== false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleDayToggle = (day: string) => {
        setOrderDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.product_name = "Product name is required";
        }
        if (minStock === "" || isNaN(Number(minStock)) || Number(minStock) < 0) {
            newErrors.min_stock_qty = "Enter valid minimum stock";
        }
        if (maxStock === "" || isNaN(Number(maxStock)) || Number(maxStock) < 0) {
            newErrors.max_stock_qty = "Enter valid maximum stock";
        }
        if (Number(maxStock) < Number(minStock)) {
            newErrors.max_stock_qty = "Max stock must be greater than or equal to Min stock";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit({
            category_id: categoryId,
            product_name: name,
            min_stock_qty: Number(minStock),
            max_stock_qty: Number(maxStock),
            default_order_qty: defaultOrder !== "" ? Number(defaultOrder) : null,
            unit,
            order_frequency: freq,
            order_days: freq === "specific_days" ? orderDays : null,
            supplier_id: supplierId || null,
            ordering_method: method || null,
            ordering_instruction: instruction || null,
            comment: comment || null,
            is_active: isActive,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData.item_id ? "Edit Product" : "Add Product to Guide"}</DialogTitle>
                    <DialogDescription>
                        Set stock replenishment thresholds and instructions for this catalog item.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleFormSubmit} className="space-y-5 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product Name */}
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="prod_name" className="text-xs font-semibold">
                                Product Name <span className="text-danger">*</span>
                            </Label>
                            <Input
                                id="prod_name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Whole Milk 2L, Brown Onions 10kg"
                                disabled={isLoading}
                                className={errors.product_name ? "border-danger" : ""}
                            />
                            {errors.product_name && (
                                <p className="text-[11px] text-danger">{errors.product_name}</p>
                            )}
                        </div>

                        {/* Min Stock */}
                        <div className="space-y-1.5">
                            <Label htmlFor="min_stock" className="text-xs font-semibold">
                                Minimum Stock Limit (Trigger) <span className="text-danger">*</span>
                            </Label>
                            <Input
                                id="min_stock"
                                type="number"
                                min="0"
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                placeholder="e.g. 2"
                                disabled={isLoading}
                                className={errors.min_stock_qty ? "border-danger" : ""}
                            />
                            {errors.min_stock_qty && (
                                <p className="text-[11px] text-danger">{errors.min_stock_qty}</p>
                            )}
                        </div>

                        {/* Max Stock */}
                        <div className="space-y-1.5">
                            <Label htmlFor="max_stock" className="text-xs font-semibold">
                                Target Max Stock Limit <span className="text-danger">*</span>
                            </Label>
                            <Input
                                id="max_stock"
                                type="number"
                                min="0"
                                value={maxStock}
                                onChange={(e) => setMaxStock(e.target.value)}
                                placeholder="e.g. 6"
                                disabled={isLoading}
                                className={errors.max_stock_qty ? "border-danger" : ""}
                            />
                            {errors.max_stock_qty && (
                                <p className="text-[11px] text-danger">{errors.max_stock_qty}</p>
                            )}
                        </div>

                        {/* Unit */}
                        <div className="space-y-1.5">
                            <Label htmlFor="unit" className="text-xs font-semibold">
                                Unit of Measurement
                            </Label>
                            <select
                                id="unit"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                            >
                                <option value="box">Box / Carton</option>
                                <option value="each">Each / Piece</option>
                                <option value="kg">Kilogram (kg)</option>
                                <option value="crate">Crate / Tray</option>
                                <option value="bag">Bag / Sack</option>
                                <option value="pack">Pack / Bundle</option>
                            </select>
                        </div>

                        {/* Default Order Qty */}
                        <div className="space-y-1.5">
                            <Label htmlFor="default_qty" className="text-xs font-semibold">
                                Default Order Qty (Fallback)
                            </Label>
                            <Input
                                id="default_qty"
                                type="number"
                                min="0"
                                value={defaultOrder}
                                onChange={(e) => setDefaultOrder(e.target.value)}
                                placeholder="e.g. 3 (optional)"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Supplier Override */}
                        <div className="space-y-1.5">
                            <Label htmlFor="supplier_override" className="text-xs font-semibold">
                                Supplier Override (Optional)
                            </Label>
                            <select
                                id="supplier_override"
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                            >
                                <option value="">-- Use Category Default --</option>
                                {suppliers.map((s) => (
                                    <option key={s.supplier_id} value={s.supplier_id}>
                                        {s.supplier_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Method Override */}
                        <div className="space-y-1.5">
                            <Label htmlFor="method_override" className="text-xs font-semibold">
                                Method Override (Optional)
                            </Label>
                            <select
                                id="method_override"
                                value={method}
                                onChange={(e) => setMethod(e.target.value as OrderingMethod | "")}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                            >
                                <option value="">-- Use Category Default --</option>
                                {ORDERING_METHODS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Order Frequency */}
                        <div className="space-y-1.5">
                            <Label htmlFor="frequency" className="text-xs font-semibold">
                                Check Frequency
                            </Label>
                            <select
                                id="frequency"
                                value={freq}
                                onChange={(e) => setFreq(e.target.value as OrderFrequency)}
                                disabled={isLoading}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                            >
                                <option value="daily">Every day</option>
                                <option value="specific_days">Specific days of week</option>
                                <option value="weekly">Weekly</option>
                                <option value="manual">Manual only (Ad-Hoc)</option>
                            </select>
                        </div>

                        {/* Specific days multiselect */}
                        {freq === "specific_days" && (
                            <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-semibold">Choose Checklist Days</Label>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const isSelected = orderDays.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => handleDayToggle(day)}
                                                disabled={isLoading}
                                                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                                                    isSelected
                                                        ? "bg-[hsl(var(--brand))] text-white shadow-sm"
                                                        : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80"
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Ordering Instruction override */}
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="instruction" className="text-xs font-semibold">
                                Specific Ordering Instructions
                            </Label>
                            <Input
                                id="instruction"
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="e.g. Use account #1128A. Call only if portal fails."
                                disabled={isLoading}
                            />
                        </div>

                        {/* Internal Comment */}
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="comment" className="text-xs font-semibold">
                                Internal Comment / Warning
                            </Label>
                            <Input
                                id="comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="e.g. Check expiry date on milk cartons before ordering."
                                disabled={isLoading}
                            />
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 md:col-span-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="item_active" className="text-xs font-semibold cursor-pointer">
                                    Product Active Status
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                    Inactive products will not trigger checklist tasks for new shifts.
                                </p>
                            </div>
                            <Switch
                                id="item_active"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={isLoading}>
                            {initialData.item_id ? "Save Product" : "Add Product"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function CategoryDetail({ params }: { params: Promise<{ id: string }> }) {
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const basePath = authUser?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";
    const isOwner = authUser?.role === "owner";

    // Unwrapping Next.js params using React.use
    const resolvedParams = use(params);
    const categoryId = resolvedParams.id;

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);

    // Track unsaved inline changes to min/max
    const [inlineChanges, setInlineChanges] = useState<Record<string, { min: string; max: string }>>({});

    // Fetch category with items
    const { data: categoryData, isLoading: catLoading } = useQuery<any>({
        queryKey: ["order-category-detail", categoryId],
        queryFn: () => apiGet(`/order-categories/${categoryId}`),
    });

    // Fetch suppliers for override selection
    const { data: suppliers = [], isLoading: supsLoading } = useQuery<any[]>({
        queryKey: ["order-suppliers"],
        queryFn: () => apiGet("/order-suppliers"),
    });

    const createProductMutation = useMutation({
        mutationFn: (newProduct: any) => apiPost("/order-guide-items", newProduct),
        onSuccess: () => {
            toast.success("Product added successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-category-detail", categoryId] });
            setIsAddOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to add product");
        },
    });

    const updateProductMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) =>
            apiPatch(`/order-guide-items/${id}`, updates),
        onSuccess: () => {
            toast.success("Product updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-category-detail", categoryId] });
            setEditingProduct(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update product");
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/order-guide-items/${id}`),
        onSuccess: () => {
            toast.success("Product deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["order-category-detail", categoryId] });
            setProductToDelete(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete product");
        },
    });

    const handleCreateProduct = (formData: any) => {
        createProductMutation.mutate(formData);
    };

    const handleUpdateProduct = (formData: any) => {
        if (!editingProduct) return;
        updateProductMutation.mutate({ id: editingProduct.item_id, updates: formData });
    };

    const handleInlineChange = (itemId: string, field: "min" | "max", val: string) => {
        const item = categoryData?.items?.find((i: any) => i.item_id === itemId);
        if (!item) return;

        setInlineChanges((prev) => {
            const current = prev[itemId] || {
                min: item.min_stock_qty.toString(),
                max: item.max_stock_qty.toString(),
            };
            return {
                ...prev,
                [itemId]: {
                    ...current,
                    [field]: val,
                },
            };
        });
    };

    const handleInlineSave = (itemId: string) => {
        const changes = inlineChanges[itemId];
        if (!changes) return;

        const minNum = Number(changes.min);
        const maxNum = Number(changes.max);

        if (isNaN(minNum) || minNum < 0 || isNaN(maxNum) || maxNum < 0) {
            toast.error("Please enter positive numbers for stock limits.");
            return;
        }

        if (maxNum < minNum) {
            toast.error("Maximum target cannot be less than minimum trigger stock.");
            return;
        }

        updateProductMutation.mutate({
            id: itemId,
            updates: {
                min_stock_qty: minNum,
                max_stock_qty: maxNum,
            },
        });

        // Clear inline changes state for this item
        setInlineChanges((prev) => {
            const copy = { ...prev };
            delete copy[itemId];
            return copy;
        });
    };

    const handleToggleActive = (itemId: string, currentStatus: boolean) => {
        updateProductMutation.mutate({
            id: itemId,
            updates: { is_active: !currentStatus },
        });
    };

    const handleDeleteProduct = (id: string, name: string) => {
        setProductToDelete({ id, name });
    };

    const isLoading = catLoading || supsLoading;

    const category = categoryData;
    const itemsList: OrderGuideItem[] = categoryData?.items || [];

    const getSupplierName = (id: string | null) => {
        if (!id) return "Category Default";
        return suppliers.find((s) => s.supplier_id === id)?.supplier_name || "Unknown";
    };

    return (
        <DashboardLayout
            role={authUser?.role === "owner" ? "owner" : "manager"}
            pageTitle={
                <span className="flex items-center gap-3">
                    <Link
                        href={`${basePath}/categories`}
                        className="inline-flex items-center text-[hsl(var(--muted-foreground))] p-1.5 -ml-1.5 transition-transform duration-200 ease-in-out hover:-translate-x-1"
                    >
                        <MoveLeft size={20} strokeWidth={2.5} />
                    </Link>
                    <span>{category ? `Order Guide: ${category.category_name}` : "Loading Category..."}</span>
                </span>
            }
            pageDescription="Manage products, set stock check limits (Min/Max thresholds), and configure supplier ordering pathways."
        >
            <div className="space-y-6">

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : !category ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-muted-foreground font-semibold">Category not found.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Category Profile Header */}
                        <Card className="bg-[hsl(var(--card))] border">
                            <CardHeader className="pb-4">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded font-extrabold uppercase">
                                                Active Guide
                                            </span>
                                            <h3 className="font-extrabold text-xl text-foreground">
                                                {category.category_name} Configuration
                                            </h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Setup limits. Order checklist tasks are auto-generated according to product schedules.
                                        </p>
                                    </div>
                                    <Button onClick={() => setIsAddOpen(true)} className="font-semibold shrink-0">
                                        <Plus className="mr-1.5 h-4.5 w-4.5" /> Add Product
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="border-t pt-4 bg-muted/10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-semibold">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950/20">
                                        <Truck className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Default Supplier</p>
                                        <p className="text-foreground text-sm font-bold">
                                            {suppliers.find((s) => s.supplier_id === category.default_supplier_id)?.supplier_name || "None (Ad-Hoc)"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/20">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ordering Cutoff</p>
                                        <p className="text-foreground text-sm font-bold">
                                            {category.cutoff_time ? category.cutoff_time.substring(0, 5) : "N/A"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/20">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Responsible role</p>
                                        <p className="text-foreground text-sm font-bold capitalize">
                                            {category.responsible_role}s Only
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Product list table */}
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                <th className="p-4 pl-6">Product Details</th>
                                                <th className="p-4 w-28 text-center">Min Stock</th>
                                                <th className="p-4 w-28 text-center">Max Stock</th>
                                                <th className="p-4">Supplier Override</th>
                                                <th className="p-4">Schedule</th>
                                                <th className="p-4 text-center w-24">Active</th>
                                                <th className="p-4 text-right pr-6 w-32">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-sm">
                                            {itemsList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                                        <PackageOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                                        No products in this category. Click Add Product to get started.
                                                    </td>
                                                </tr>
                                            ) : (
                                                itemsList.map((item) => {
                                                    const changes = inlineChanges[item.item_id];
                                                    const minVal = changes ? changes.min : item.min_stock_qty.toString();
                                                    const maxVal = changes ? changes.max : item.max_stock_qty.toString();
                                                    const isModified = !!changes;

                                                    return (
                                                        <tr
                                                            key={item.item_id}
                                                            className={`hover:bg-muted/10 transition-colors ${
                                                                item.is_active ? "text-foreground" : "text-muted-foreground bg-muted/5 opacity-70"
                                                            }`}
                                                        >
                                                            {/* Product Info */}
                                                            <td className="p-4 pl-6">
                                                                <div className="font-bold">{item.product_name}</div>
                                                                <div className="text-xs font-medium text-muted-foreground mt-0.5">
                                                                    Unit: {item.unit} | Method: {item.ordering_method || "Default"}
                                                                </div>
                                                            </td>

                                                            {/* Min Stock Inline */}
                                                            <td className="p-3 text-center">
                                                                <Input
                                                                    type="number"
                                                                    value={minVal}
                                                                    onChange={(e) => handleInlineChange(item.item_id, "min", e.target.value)}
                                                                    className="h-8 w-20 text-center mx-auto"
                                                                />
                                                            </td>

                                                            {/* Max Stock Inline */}
                                                            <td className="p-3 text-center">
                                                                <Input
                                                                    type="number"
                                                                    value={maxVal}
                                                                    onChange={(e) => handleInlineChange(item.item_id, "max", e.target.value)}
                                                                    className="h-8 w-20 text-center mx-auto"
                                                                />
                                                            </td>

                                                            {/* Supplier Override */}
                                                            <td className="p-4 font-semibold text-xs">
                                                                {getSupplierName(item.supplier_id)}
                                                            </td>

                                                            {/* Order Frequency */}
                                                            <td className="p-4 text-xs font-semibold">
                                                                <div className="capitalize">{item.order_frequency.replace("_", " ")}</div>
                                                                {item.order_frequency === "specific_days" && item.order_days && (
                                                                    <div className="flex gap-0.5 mt-1 flex-wrap">
                                                                        {item.order_days.map((d) => (
                                                                            <span key={d} className="bg-muted px-1 rounded text-[10px]">
                                                                                {d}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Active Status */}
                                                            <td className="p-4 text-center">
                                                                <Switch
                                                                    checked={item.is_active}
                                                                    onCheckedChange={() => handleToggleActive(item.item_id, item.is_active)}
                                                                    className="mx-auto"
                                                                />
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="p-4 text-right pr-6">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {isModified ? (
                                                                        <>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => handleInlineSave(item.item_id)}
                                                                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                                                title="Save Limits"
                                                                            >
                                                                                <Check className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => {
                                                                                    setInlineChanges((prev) => {
                                                                                        const copy = { ...prev };
                                                                                        delete copy[item.item_id];
                                                                                        return copy;
                                                                                    });
                                                                                }}
                                                                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                                                                title="Cancel Changes"
                                                                            >
                                                                                <X className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => setEditingProduct(item)}
                                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                                title="Edit Product Settings"
                                                                            >
                                                                                <Edit2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => handleDeleteProduct(item.item_id, item.product_name)}
                                                                                className="h-8 w-8 text-muted-foreground hover:text-danger"
                                                                                title="Delete Product"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
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

                {/* Add product modal */}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <ProductFormModal
                        isOpen={isAddOpen}
                        onClose={() => setIsAddOpen(false)}
                        suppliers={suppliers}
                        categoryId={categoryId}
                        onSubmit={handleCreateProduct}
                        isLoading={createProductMutation.isPending}
                    />
                </Dialog>

                {/* Edit product modal */}
                {editingProduct && (
                    <ProductFormModal
                        isOpen={!!editingProduct}
                        onClose={() => setEditingProduct(null)}
                        suppliers={suppliers}
                        categoryId={categoryId}
                        initialData={editingProduct}
                        onSubmit={handleUpdateProduct}
                        isLoading={updateProductMutation.isPending}
                    />
                )}

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                    isOpen={!!productToDelete}
                    onClose={() => setProductToDelete(null)}
                    onConfirm={() => {
                        if (productToDelete) {
                            deleteProductMutation.mutate(productToDelete.id);
                        }
                    }}
                    title="Delete Product?"
                    description={`Are you sure you want to delete the product "${productToDelete?.name}"? Historical orders remain intact but future shifts won't generate tasks for this item.`}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    isLoading={deleteProductMutation.isPending}
                />
            </div>
        </DashboardLayout>
    );
}
