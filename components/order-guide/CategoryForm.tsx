"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OrderCategory, OrderSupplier, OrderingMethod } from "@/types/database";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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

const TIME_OPTIONS = [
    "00:00", "00:15", "00:30", "00:45",
    "01:00", "01:15", "01:30", "01:45",
    "02:00", "02:15", "02:30", "02:45",
    "03:00", "03:15", "03:30", "03:45",
    "04:00", "04:15", "04:30", "04:45",
    "05:00", "05:15", "05:30", "05:45",
    "06:00", "06:15", "06:30", "06:45",
    "07:00", "07:15", "07:30", "07:45",
    "08:00", "08:15", "08:30", "08:45",
    "09:00", "09:15", "09:30", "09:45",
    "10:00", "10:15", "10:30", "10:45",
    "11:00", "11:15", "11:30", "11:45",
    "12:00", "12:15", "12:30", "12:45",
    "13:00", "13:15", "13:30", "13:45",
    "14:00", "14:15", "14:30", "14:45",
    "15:00", "15:15", "15:30", "15:45",
    "16:00", "16:15", "16:30", "16:45",
    "17:00", "17:15", "17:30", "17:45",
    "18:00", "18:15", "18:30", "18:45",
    "19:00", "19:15", "19:30", "19:45",
    "20:00", "20:15", "20:30", "20:45",
    "21:00", "21:15", "21:30", "21:45",
    "22:00", "22:15", "22:30", "22:45",
    "23:00", "23:15", "23:30", "23:45"
];

export function CategoryForm({ initialData = {}, suppliers, onSubmit, onCancel, isLoading }: CategoryFormProps) {
    const [name, setName] = useState(initialData.category_name || "");
    const [supplierId, setSupplierId] = useState(initialData.default_supplier_id || "");
    const [method, setMethod] = useState<OrderingMethod | "">(initialData.default_ordering_method || "");
    const [orderDays, setOrderDays] = useState<string[]>(initialData.order_days || []);
    const [hasCutoff, setHasCutoff] = useState(() => !!initialData.cutoff_time);
    const [cutoffTime, setCutoffTime] = useState(() => {
        if (!initialData.cutoff_time) return "17:00"; // default 5 PM (17:00)
        return initialData.cutoff_time.substring(0, 5);
    });
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const [timeSearch, setTimeSearch] = useState("");
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
            cutoff_time: hasCutoff ? `${cutoffTime}:00` : null,
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
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="has_cutoff" className="text-sm font-semibold cursor-pointer">
                                Enable Ordering Cut-off Time
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Set a daily cut-off time for this category.
                            </p>
                        </div>
                        <Switch
                            id="has_cutoff"
                            checked={hasCutoff}
                            onCheckedChange={setHasCutoff}
                            disabled={isLoading}
                        />
                    </div>
                    {hasCutoff && (
                        <div className="space-y-1.5 relative pt-2 border-t border-border/50">
                            <button
                                type="button"
                                onClick={() => !isLoading && setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                                disabled={isLoading}
                                className={cn(
                                    "flex h-10 w-full md:w-48 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm items-center justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 focus:border-[hsl(var(--brand))]",
                                    isLoading && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <span>{cutoffTime}</span>
                                <Clock size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </button>

                            {isTimeDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsTimeDropdownOpen(false)} />
                                    <div className="absolute top-full mt-1 left-0 w-full md:w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="p-2 border-b bg-[hsl(var(--muted))]/30 sticky top-0">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Search time..."
                                                value={timeSearch}
                                                onChange={e => setTimeSearch(e.target.value)}
                                                className="w-full h-8 px-2 text-xs rounded-md border bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1" ref={el => {
                                            if (el && !el.dataset.scrolled) {
                                                const selected = el.querySelector('[data-selected="true"]');
                                                if (selected) {
                                                    selected.scrollIntoView({ block: "center" });
                                                    el.dataset.scrolled = "true";
                                                }
                                            }
                                        }}>
                                            {(() => {
                                                const filtered = TIME_OPTIONS.filter(t => t.includes(timeSearch));
                                                if (filtered.length === 0) {
                                                    return <div className="text-center py-2 text-xs text-muted-foreground">No matches</div>;
                                                }
                                                return filtered.map(time => (
                                                    <button
                                                        key={time}
                                                        type="button"
                                                        onClick={() => {
                                                            setCutoffTime(time);
                                                            setIsTimeDropdownOpen(false);
                                                            setTimeSearch("");
                                                        }}
                                                        data-selected={cutoffTime === time}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors font-semibold",
                                                            cutoffTime === time
                                                                ? "bg-[hsl(var(--brand))] text-white"
                                                                : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                                                        )}
                                                    >
                                                        {time}
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
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
