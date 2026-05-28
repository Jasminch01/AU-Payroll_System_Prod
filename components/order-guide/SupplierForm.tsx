"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OrderSupplier, OrderingMethod } from "@/types/database";

interface SupplierFormProps {
    initialData?: Partial<OrderSupplier>;
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

export function SupplierForm({ initialData = {}, onSubmit, onCancel, isLoading }: SupplierFormProps) {
    const [name, setName] = useState(initialData.supplier_name || "");
    const [contact, setContact] = useState(initialData.contact_person || "");
    const [phone, setPhone] = useState(initialData.phone || "");
    const [email, setEmail] = useState(initialData.email || "");
    const [portalUrl, setPortalUrl] = useState(initialData.portal_url || "");
    const [cutoffTime, setCutoffTime] = useState(() => {
        if (!initialData.order_cutoff_time) return "";
        // Cutoff time might be "14:00:00", we want "14:00"
        return initialData.order_cutoff_time.substring(0, 5);
    });
    const [deliveryDays, setDeliveryDays] = useState<string[]>(initialData.delivery_days || []);
    const [method, setMethod] = useState<OrderingMethod>(initialData.ordering_method || "portal");
    const [notes, setNotes] = useState(initialData.notes || "");
    const [isActive, setIsActive] = useState(initialData.is_active !== false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleDayToggle = (day: string) => {
        setDeliveryDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.supplier_name = "Supplier name is required";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit({
            supplier_name: name,
            contact_person: contact || null,
            phone: phone || null,
            email: email || null,
            portal_url: portalUrl || null,
            order_cutoff_time: cutoffTime ? `${cutoffTime}:00` : null,
            delivery_days: deliveryDays.length > 0 ? deliveryDays : null,
            ordering_method: method,
            notes: notes || null,
            is_active: isActive,
        });
    };

    return (
        <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Name */}
                <div className="space-y-2">
                    <Label htmlFor="supplier_name" className="text-sm font-semibold">
                        Supplier Name <span className="text-danger">*</span>
                    </Label>
                    <Input
                        id="supplier_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Fruit & Veg Wholesalers"
                        disabled={isLoading}
                        className={errors.supplier_name ? "border-danger" : ""}
                    />
                    {errors.supplier_name && (
                        <p className="text-xs text-danger">{errors.supplier_name}</p>
                    )}
                </div>

                {/* Contact Person */}
                <div className="space-y-2">
                    <Label htmlFor="contact_person" className="text-sm font-semibold">
                        Contact Person
                    </Label>
                    <Input
                        id="contact_person"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="e.g. John Doe"
                        disabled={isLoading}
                    />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">
                        Phone Number
                    </Label>
                    <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0400 123 456"
                        disabled={isLoading}
                    />
                </div>

                {/* Email */}
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                        Email Address
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. orders@supplier.com.au"
                        disabled={isLoading}
                    />
                </div>

                {/* Ordering Method */}
                <div className="space-y-2">
                    <Label htmlFor="ordering_method" className="text-sm font-semibold">
                        Primary Ordering Method
                    </Label>
                    <select
                        id="ordering_method"
                        value={method}
                        onChange={(e) => setMethod(e.target.value as OrderingMethod)}
                        disabled={isLoading}
                        className="flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/20 disabled:opacity-50"
                    >
                        {ORDERING_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Cut-off Time */}
                <div className="space-y-2">
                    <Label htmlFor="order_cutoff_time" className="text-sm font-semibold">
                        Order Cut-off Time
                    </Label>
                    <Input
                        id="order_cutoff_time"
                        type="time"
                        value={cutoffTime}
                        onChange={(e) => setCutoffTime(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                {/* Portal URL */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="portal_url" className="text-sm font-semibold">
                        Portal URL
                    </Label>
                    <Input
                        id="portal_url"
                        type="url"
                        value={portalUrl}
                        onChange={(e) => setPortalUrl(e.target.value)}
                        placeholder="e.g. https://portal.supplier.com/login"
                        disabled={isLoading}
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Do not enter passwords. Staff will copy this link to access the supplier page safely.
                    </p>
                </div>

                {/* Delivery Days */}
                <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-semibold">Delivery Days</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {DAYS_OF_WEEK.map((day) => {
                            const isSelected = deliveryDays.includes(day);
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

                {/* Notes */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes" className="text-sm font-semibold">
                        Internal Notes / Instructions
                    </Label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Account number: #99281, order code on portal is store post code."
                        disabled={isLoading}
                        rows={3}
                        className="flex w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand))]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                {/* Status toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 md:col-span-2">
                    <div className="space-y-0.5">
                        <Label htmlFor="is_active" className="text-sm font-semibold cursor-pointer">
                            Active Status
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Inactive suppliers won't appear as options for new products.
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
                    {initialData.supplier_id ? "Save Changes" : "Create Supplier"}
                </Button>
            </div>
        </form>
    );
}
