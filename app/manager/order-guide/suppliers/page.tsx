"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import Link from "next/link";
import { SupplierForm } from "@/components/order-guide/SupplierForm";
import {
    Plus,
    Truck,
    Phone,
    Mail,
    Globe,
    ShieldAlert,
    Edit2,
    Trash2,
    Loader2,
    CheckCircle,
    MoveLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function SupplierManagement() {
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const isOwner = authUser?.role === "owner";
    const basePath = authUser?.role === "owner" ? "/owner/order-guide" : "/manager/order-guide";

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

    // Fetch suppliers list
    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ["order-suppliers"],
        queryFn: () => apiGet<any[]>("/order-suppliers"),
    });

    const createMutation = useMutation({
        mutationFn: (newSup: any) => apiPost("/order-suppliers", newSup),
        onSuccess: () => {
            toast.success("Supplier created successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-suppliers"] });
            setIsCreateOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to create supplier");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) =>
            apiPatch(`/order-suppliers/${id}`, updates),
        onSuccess: () => {
            toast.success("Supplier updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["order-suppliers"] });
            setEditingSupplier(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update supplier");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiDelete(`/order-suppliers/${id}`),
        onSuccess: () => {
            toast.success("Supplier deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["order-suppliers"] });
            setSupplierToDelete(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete supplier");
        },
    });

    const handleCreateSupplier = (formData: any) => {
        createMutation.mutate(formData);
    };

    const handleUpdateSupplier = (formData: any) => {
        if (!editingSupplier) return;
        updateMutation.mutate({ id: editingSupplier.supplier_id, updates: formData });
    };

    const handleDeleteClick = (id: string, name: string) => {
        if (!isOwner) {
            toast.error("Only owners can delete suppliers.");
            return;
        }
        setSupplierToDelete({ id, name });
    };

    return (
        <DashboardLayout
            role={authUser?.role === "owner" ? "owner" : "manager"}
            pageTitle={
                <span className="flex items-center gap-3">
                    <Link
                        href={basePath}
                        className="inline-flex items-center text-[hsl(var(--muted-foreground))] p-1.5 -ml-1.5 transition-transform duration-200 ease-in-out hover:-translate-x-1"
                    >
                        <MoveLeft size={20} strokeWidth={2.5} />
                    </Link>
                    <span>Supplier Directory</span>
                </span>
            }
            pageDescription="Maintain delivery partners, cutoff times, primary ordering methods, and portal links safely."
        >
            <div className="space-y-6">
                {/* Security Warning Banner */}
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-500">
                    <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <h4 className="font-bold">Password Security Policy</h4>
                        <p className="leading-relaxed">
                            Supplier portal login credentials and passwords should **never** be entered or stored in this system.
                            Leave passwords on the store computer only. We only display the portal URL for quick staff reference.
                        </p>
                    </div>
                </div>

                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 border p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Suppliers: {suppliers.length}
                        </span>
                    </div>

                    <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto font-semibold">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Supplier
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    </div>
                ) : suppliers.length === 0 ? (
                    <Card className="border-dashed border-2 text-center py-12 bg-muted/5">
                        <CardContent className="space-y-3">
                            <Truck className="h-10 w-10 text-muted-foreground mx-auto" />
                            <h4 className="font-bold text-foreground">No Suppliers Added</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Add suppliers to tie order items to specific delivery cut-offs.
                            </p>
                            <Button onClick={() => setIsCreateOpen(true)} className="mt-2 font-semibold">
                                <Plus className="mr-1.5 h-4 w-4" /> Add First Supplier
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {suppliers.map((supplier) => {
                            const isPortal = supplier.portal_url;
                            const dDays = supplier.delivery_days || [];

                            return (
                                <Card
                                    key={supplier.supplier_id}
                                    className={`flex flex-col justify-between hover:shadow-md transition-all border ${supplier.is_active ? "border-border" : "border-dashed opacity-60"
                                        }`}
                                >
                                    <CardHeader className="pb-3 border-b bg-muted/5">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-base font-bold">
                                                        {supplier.supplier_name}
                                                    </CardTitle>
                                                    {!supplier.is_active && (
                                                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-semibold uppercase">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                {supplier.contact_person && (
                                                    <p className="text-xs text-muted-foreground font-medium">
                                                        Contact: <span className="text-foreground font-bold">{supplier.contact_person}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-xs font-bold bg-brand/10 text-brand px-2 py-0.5 rounded capitalize">
                                                {supplier.ordering_method || "portal"}
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-5 space-y-4 text-xs font-semibold">
                                        {/* Contact grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5" />
                                                <span>{supplier.phone || "No Phone"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-3.5 w-3.5" />
                                                <span className="truncate max-w-[180px]" title={supplier.email}>{supplier.email || "No Email"}</span>
                                            </div>
                                            {supplier.order_cutoff_time && (
                                                <div className="flex items-center gap-2 sm:col-span-2">
                                                    <span className="text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                        Cut-off: {supplier.order_cutoff_time.substring(0, 5)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Schedule */}
                                        {dDays.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Delivery Days</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {dDays.map((day: string) => (
                                                        <span key={day} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground">
                                                            {day}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Notes */}
                                        {supplier.notes && (
                                            <div className="bg-muted/30 p-2.5 rounded-lg border border-dashed text-muted-foreground leading-relaxed italic text-[11px]">
                                                "{supplier.notes}"
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex justify-between items-center pt-3 border-t">
                                            <div>
                                                {isPortal ? (
                                                    <a
                                                        href={supplier.portal_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-brand hover:underline font-bold text-xs"
                                                    >
                                                        <Globe className="h-3.5 w-3.5" /> Portal Link
                                                    </a>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-[11px]">No Portal URL</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setEditingSupplier(supplier)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="Edit Supplier"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(supplier.supplier_id, supplier.supplier_name)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-danger"
                                                        title="Delete Supplier"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Create Modal */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <DialogHeader>
                            <DialogTitle>Add Delivery Supplier</DialogTitle>
                            <DialogDescription>
                                Set contact details, cut-off hours, and ordering configurations.
                            </DialogDescription>
                        </DialogHeader>
                        <SupplierForm
                            onSubmit={handleCreateSupplier}
                            onCancel={() => setIsCreateOpen(false)}
                            isLoading={createMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>

                {/* Edit Modal */}
                <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <DialogHeader>
                            <DialogTitle>Edit Supplier Details</DialogTitle>
                            <DialogDescription>
                                Modify contact, scheduling, or ordering fields for the selected supplier.
                            </DialogDescription>
                        </DialogHeader>
                        {editingSupplier && (
                            <SupplierForm
                                initialData={editingSupplier}
                                onSubmit={handleUpdateSupplier}
                                onCancel={() => setEditingSupplier(null)}
                                isLoading={updateMutation.isPending}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                    isOpen={!!supplierToDelete}
                    onClose={() => setSupplierToDelete(null)}
                    onConfirm={() => {
                        if (supplierToDelete) {
                            deleteMutation.mutate(supplierToDelete.id);
                        }
                    }}
                    title="Delete Supplier?"
                    description={`Are you sure you want to permanently delete supplier "${supplierToDelete?.name}"?`}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    isLoading={deleteMutation.isPending}
                />
            </div>
        </DashboardLayout>
    );
}
