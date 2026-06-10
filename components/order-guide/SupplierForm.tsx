"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OrderSupplier, OrderingMethod } from "@/types/database";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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

export function SupplierForm({ initialData = {}, onSubmit, onCancel, isLoading }: SupplierFormProps) {
    const [name, setName] = useState(initialData.supplier_name || "");
    const [contact, setContact] = useState(initialData.contact_person || "");
    const [phone, setPhone] = useState(initialData.phone || "");
    const [email, setEmail] = useState(initialData.email || "");
    const [portalUrl, setPortalUrl] = useState(initialData.portal_url || "");
    const [hasCutoff, setHasCutoff] = useState(() => !!initialData.order_cutoff_time);
    const [cutoffTime, setCutoffTime] = useState(() => {
        if (!initialData.order_cutoff_time) return "17:00"; // default 5 PM (17:00)
        return initialData.order_cutoff_time.substring(0, 5);
    });
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const [timeSearch, setTimeSearch] = useState("");
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
            order_cutoff_time: hasCutoff ? `${cutoffTime}:00` : null,
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
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="has_cutoff" className="text-sm font-semibold cursor-pointer">
                                Enable Order Cut-off Time
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Set a daily cut-off time for this supplier.
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
