"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OrderCategory, OrderSupplier, OrderingMethod } from "@/types/database";

interface CategoryFormProps {
    initialData?: Partial<OrderCategory>;
    suppliers: OrderSupplier[];
    onSubmit: (data: any) => void;
    onCancel: () => void;
    isLoading: boolean;
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ORDERING_METHODS: { value: OrderingMethod; label: string }[] = [
    { value: "portal", label: "Supplier Web Portal" },
    { value: "phone", label: "Phone Call" },
    { value: "sms", label: "SMS / Text Message" },
    { value: "email", label: "Email Order" },
    { value: "rep", label: "Sales Representative" },
    { value: "metcash", label: "Metcash Portal" },
];

export function CategoryForm({ initialData = {}, suppliers, onSubmit, onCancel, isLoading }: CategoryFormProps) {
    const [name, setName] = useState(initialData.category_name || "");
    const [supplierId, setSupplierId] = useState(initialData.default_supplier_id || "");
    const [method, setMethod] = useState<OrderingMethod | "">(initialData.default_ordering_method || "");
    const [orderDays, setOrderDays] = useState<string[]>(initialData.order_days || []);
    const [cutoffTime, setCutoffTime] = useState(() => {
        if (!initialData.cutoff_time) return "";
        return initialData.cutoff_time.substring(0, 5); // "14:00:00" -> "14:00"
    });
    const [role, setRole] = useState(initialData.responsible_role || "manager");
    const [isActive, setIsActive] = useState(initialData.is_active !== false);
    const [sortOrder, setSortOrder] = useState(initialData.sort_order || 0);

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
            newErrors.category_name = "Category name is required";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit({
            category_name: name,
            default_supplier_id: supplierId || null,
            default_ordering_method: method || null,
            order_days: orderDays.length > 0 ? orderDays : null,
            cutoff_time: cutoffTime ? `${cutoffTime}:00` : null,
            responsible_role: role,
            is_active: isActive,
            sort_order: Number(sortOrder) || 0,
        });
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Name */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="category_name" className="text-sm font-semibold">
                        Category Name <span className="text-danger">*</span>
                    </Label>
                    <Input
                        id="category_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Fruit & Veg, Bread, Dairy"
                        disabled={isLoading}
                        className={errors.category_name ? "border-danger" : ""}
                    />
                    {errors.category_name && (
                        <p className="text-xs text-danger">{errors.category_name}</p>
                    )}
                </div>

                {/* Default Supplier */}
                <div className="space-y-2">
                    <Label htmlFor="default_supplier" className="text-sm font-semibold">
                        Default Supplier
                    </Label>
                    <select
                        id="default_supplier"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        disabled={isLoading}
                        className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                    >
                        <option value="">-- No default supplier --</option>
                        {suppliers.map((s) => (
                            <option key={s.supplier_id} value={s.supplier_id}>
                                {s.supplier_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Default Ordering Method */}
                <div className="space-y-2">
                    <Label htmlFor="default_method" className="text-sm font-semibold">
                        Default Ordering Method
                    </Label>
                    <select
                        id="default_method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value as OrderingMethod | "")}
                        disabled={isLoading}
                        className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                    >
                        <option value="">-- Pick default method --</option>
                        {ORDERING_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Responsible Role */}
                <div className="space-y-2">
                    <Label htmlFor="responsible_role" className="text-sm font-semibold">
                        Responsible Role
                    </Label>
                    <select
                        id="responsible_role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={isLoading}
                        className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                    >
                        <option value="manager">Manager</option>
                        <option value="owner">Owner Only (e.g. Liquor)</option>
                    </select>
                </div>

                {/* Cut-off Time */}
                <div className="space-y-2">
                    <Label htmlFor="cutoff_time" className="text-sm font-semibold">
                        Ordering Cut-off Time
                    </Label>
                    <Input
                        id="cutoff_time"
                        type="time"
                        value={cutoffTime}
                        onChange={(e) => setCutoffTime(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                {/* Order Days */}
                <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-semibold">Default Order Days</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {DAYS_OF_WEEK.map((day) => {
                            const isSelected = orderDays.includes(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDayToggle(day)}
                                    disabled={isLoading}
                                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
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

                {/* Sort Order */}
                <div className="space-y-2">
                    <Label htmlFor="sort_order" className="text-sm font-semibold">
                        Sort Order Position
                    </Label>
                    <Input
                        id="sort_order"
                        type="number"
                        min="0"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(Number(e.target.value))}
                        disabled={isLoading}
                    />
                </div>

                {/* Status toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 md:col-span-2">
                    <div className="space-y-0.5">
                        <Label htmlFor="is_active" className="text-sm font-semibold cursor-pointer">
                            Active Status
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Inactive categories won't show in the employee ordering screens.
                        </p>
                    </div>
                    <Switch
                        id="is_active"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" loading={isLoading}>
                    {initialData.category_id ? "Save Changes" : "Create Category"}
                </Button>
            </div>
        </form>
    );
}
