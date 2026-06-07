"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OrderGuideItem, DailyOrderTask, OrderStatus, StockStatus } from "@/types/database";
import { calculateSuggestedQty } from "@/lib/order-guide-utils";
import { HelpCircle, AlertTriangle, Check, Loader2 } from "lucide-react";
import { StockStatusBadge } from "./StockStatusBadge";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface ProductOrderCardProps {
    item: OrderGuideItem;
    task: DailyOrderTask;
    onUpdateTask: (updates: Partial<DailyOrderTask>) => Promise<void>;
    onShowInstructions: () => void;
    isUpdating: boolean;
    disabled?: boolean;
}

export function ProductOrderCard({
    item,
    task,
    onUpdateTask,
    onShowInstructions,
    isUpdating,
    disabled = false
}: ProductOrderCardProps) {
    const [currentStock, setCurrentStock] = useState<string>(
        task.current_stock_qty !== null && task.current_stock_qty !== undefined
            ? task.current_stock_qty.toString()
            : ""
    );
    const [finalQty, setFinalQty] = useState<string>(
        task.final_qty !== null && task.final_qty !== undefined
            ? task.final_qty.toString()
            : ""
    );
    const [status, setStatus] = useState<OrderStatus>(task.order_status || "pending");
    const [reason, setReason] = useState<string>(task.comment_reason || "");
    const [refNumber, setRefNumber] = useState<string>(task.order_reference || "");

    const [suggested, setSuggested] = useState<number | null>(task.suggested_qty);
    const [stockState, setStockState] = useState<StockStatus>(task.stock_status || "not_checked");

    const min = Number(item.min_stock_qty);
    const max = Number(item.max_stock_qty);

    // Calculate suggested quantity reactively when currentStock changes
    useEffect(() => {
        const stockNum = currentStock === "" ? null : Number(currentStock);
        if (stockNum === null || isNaN(stockNum)) {
            setSuggested(null);
            setStockState("not_checked");
            return;
        }

        const res = calculateSuggestedQty(item, stockNum);
        setSuggested(res.suggestedQty);
        setStockState(res.stockStatus);

        // If user hasn't touched finalQty yet, auto-fill it with the suggested qty
        if (finalQty === "") {
            setFinalQty(res.suggestedQty !== null ? res.suggestedQty.toString() : "");
        }
    }, [currentStock, item]);

    const handleSave = async (newStatus: OrderStatus) => {
        const stockNum = currentStock === "" ? null : Number(currentStock);
        const finalNum = finalQty === "" ? null : Number(finalQty);

        if (newStatus === "issue" && !reason.trim()) {
            return; // Enforce reason on issue
        }

        setStatus(newStatus);
        await onUpdateTask({
            current_stock_qty: stockNum,
            final_qty: finalNum,
            order_status: newStatus,
            stock_status: stockState,
            comment_reason: newStatus === "issue" ? reason : null,
            order_reference: newStatus === "ordered" ? refNumber : null,
            suggested_qty: suggested,
        });
    };

    const handleStockBlur = () => {
        // Auto-save changes on focus loss if status isn't pending
        if (status !== "pending") {
            handleSave(status);
        }
    };

    const handleFinalBlur = () => {
        if (status !== "pending") {
            handleSave(status);
        }
    };

    const isIssueInvalid = status === "issue" && !reason.trim();

    return (
        <Card className={`border transition-all duration-200 ${
            status === "ordered"
                ? "border-green-200 bg-green-50/10 dark:border-green-900/30"
                : status === "not_required"
                ? "border-slate-200 bg-slate-50/10 opacity-75 dark:border-slate-800"
                : status === "issue"
                ? "border-red-200 bg-red-50/10 dark:border-red-900/30"
                : "border-border bg-card"
        }`}>
            <CardContent className="p-5 space-y-4">
                {/* Product Name, Min/Max info, Stock Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                        <h4 className="font-bold text-base text-foreground">{item.product_name}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                            <span>Min Stock: <strong className="text-foreground">{min}</strong></span>
                            <span>Max Target: <strong className="text-foreground">{max}</strong></span>
                            <span>Unit: <strong className="text-foreground">{item.unit}</strong></span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <StockStatusBadge status={stockState} />
                        <OrderStatusBadge status={status} />
                    </div>
                </div>

                {/* Stock Check Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-dashed">
                    {/* Current Stock Input */}
                    <div className="space-y-1.5">
                        <Label htmlFor={`stock-${item.item_id}`} className="text-xs font-semibold text-muted-foreground uppercase">
                            Current Stock
                        </Label>
                        <div className="relative">
                            <Input
                                id={`stock-${item.item_id}`}
                                type="number"
                                min="0"
                                value={currentStock}
                                onChange={(e) => setCurrentStock(e.target.value)}
                                onBlur={handleStockBlur}
                                placeholder="Enter count..."
                                className="pr-12"
                                disabled={isUpdating || disabled}
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">
                                {item.unit}
                            </span>
                        </div>
                    </div>

                    {/* Suggested Qty Display */}
                    <div className="space-y-1.5 bg-muted/30 p-2.5 rounded-lg border border-dashed flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            Suggested Order Qty
                        </span>
                        <div className="text-lg font-extrabold text-foreground mt-0.5">
                            {suggested !== null ? `${suggested} ${item.unit}` : "--"}
                        </div>
                    </div>

                    {/* Final Ordered Qty Input */}
                    <div className="space-y-1.5">
                        <Label htmlFor={`final-${item.item_id}`} className="text-xs font-semibold text-muted-foreground uppercase">
                            Final Order Qty
                        </Label>
                        <div className="relative">
                            <Input
                                id={`final-${item.item_id}`}
                                type="number"
                                min="0"
                                value={finalQty}
                                onChange={(e) => setFinalQty(e.target.value)}
                                onBlur={handleFinalBlur}
                                placeholder="Adjust qty..."
                                className="pr-12"
                                disabled={isUpdating || disabled}
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">
                                {item.unit}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Issue Reason / Order Ref block */}
                {status === "issue" && (
                    <div className="space-y-2 p-3 rounded-lg border border-red-200 bg-red-50/20 dark:border-red-900/30 dark:bg-red-950/10">
                        <Label htmlFor={`reason-${item.item_id}`} className="text-xs font-semibold text-red-800 dark:text-red-300">
                            Describe the Issue <span className="text-red-500">*</span>
                        </Label>
                        <textarea
                            id={`reason-${item.item_id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            onBlur={() => handleSave("issue")}
                            placeholder="e.g. Supplier out of stock, delivery delayed, price too high..."
                            rows={2}
                            className="flex w-full rounded-lg border border-red-200 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isUpdating || disabled}
                        />
                        {isIssueInvalid && (
                            <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Reason is required to flag as an issue.
                            </p>
                        )}
                    </div>
                )}

                {status === "ordered" && (
                    <div className="space-y-1.5 p-3 rounded-lg border border-green-200 bg-green-50/20 dark:border-green-900/30 dark:bg-green-950/10">
                        <Label htmlFor={`ref-${item.item_id}`} className="text-xs font-semibold text-green-800 dark:text-green-300">
                            Order Reference Number (Optional)
                        </Label>
                        <Input
                            id={`ref-${item.item_id}`}
                            value={refNumber}
                            onChange={(e) => setRefNumber(e.target.value)}
                            onBlur={() => handleSave("ordered")}
                            placeholder="e.g. PO-883921"
                            disabled={isUpdating || disabled}
                        />
                    </div>
                )}

                {/* Footer Action buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                    {/* View instructions */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onShowInstructions}
                        className="text-xs gap-1.5 h-8 font-medium w-full sm:w-auto"
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                        How to Order
                    </Button>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                            variant={status === "not_required" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => handleSave("not_required")}
                            disabled={isUpdating || disabled || currentStock === ""}
                            className="h-8 text-xs font-semibold"
                        >
                            Not Required
                        </Button>
                        <Button
                            variant={status === "issue" ? "danger" : "ghost"}
                            size="sm"
                            onClick={() => handleSave("issue")}
                            disabled={isUpdating || disabled || currentStock === ""}
                            className="h-8 text-xs font-semibold"
                        >
                            Flag Issue
                        </Button>
                        <Button
                            variant={status === "ordered" ? "success" : "default"}
                            size="sm"
                            onClick={() => handleSave("ordered")}
                            disabled={isUpdating || disabled || currentStock === ""}
                            className="h-8 text-xs font-semibold gap-1"
                        >
                            {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : status === "ordered" ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : null}
                            Mark Ordered
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
