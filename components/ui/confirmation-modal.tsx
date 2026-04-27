"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./dialog";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Are you sure?",
    description = "This action cannot be undone.",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    isLoading = false,
}: ConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader className="flex flex-col items-center text-center space-y-4">
                    <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full",
                        variant === "danger" ? "bg-red-50 text-red-600" : 
                        variant === "warning" ? "bg-amber-50 text-amber-600" : 
                        "bg-blue-50 text-blue-600"
                    )}>
                        {variant === "danger" ? <Trash2 size={24} /> : 
                         variant === "warning" ? <AlertTriangle size={24} /> : 
                         <AlertTriangle size={24} />}
                    </div>
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                        <DialogDescription className="text-sm text-[hsl(var(--muted-foreground))]">
                            {description}
                        </DialogDescription>
                    </div>
                </DialogHeader>
                <DialogFooter className="flex flex-row gap-3 mt-8">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 h-11 rounded-xl border border-[hsl(var(--border))] bg-transparent font-semibold text-sm hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "flex-1 h-11 rounded-xl font-semibold text-sm text-white shadow-lg transition-all active:scale-95 disabled:opacity-50",
                            variant === "danger" ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : 
                            variant === "warning" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20" : 
                            "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                        )}
                    >
                        {isLoading ? "Processing..." : confirmLabel}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
