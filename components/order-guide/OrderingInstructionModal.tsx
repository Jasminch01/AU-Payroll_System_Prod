"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderSupplier, OrderGuideItem } from "@/types/database";
import { Clipboard, Check, Phone, Mail, Link as LinkIcon, MessageSquare, ShieldAlert } from "lucide-react";

interface OrderingInstructionModalProps {
    isOpen: boolean;
    onClose: () => void;
    supplier: OrderSupplier | null;
    item: OrderGuideItem;
    suggestedQty: number | null;
}

export function OrderingInstructionModal({
    isOpen,
    onClose,
    supplier,
    item,
    suggestedQty
}: OrderingInstructionModalProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const qty = suggestedQty || item.default_order_qty || 1;
    const method = item.ordering_method || supplier?.ordering_method || "portal";

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    // Render instruction helper blocks depending on ordering method
    const renderMethodInstructions = () => {
        switch (method) {
            case "portal":
            case "metcash": {
                const url = supplier?.portal_url || "https://www.metcash.com";
                const isMetcash = method === "metcash" || supplier?.supplier_name?.toLowerCase().includes("metcash");
                return (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold mb-1">Security & Policy Reminder</h4>
                                <p className="leading-relaxed">
                                    Portal credentials are never stored in this system. Please use the designated store computer or login using authorized credentials. Do not use personal or unauthorized accounts.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Ordering URL
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                                <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-medium truncate flex-1">{url}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(url, "url")}
                                    className="shrink-0 h-8"
                                >
                                    {copied === "url" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                                </Button>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-lg border bg-brand text-white px-3 py-1.5 text-xs font-medium hover:bg-brand-hover"
                                >
                                    Open Portal
                                </a>
                            </div>
                        </div>

                        {item.ordering_instruction && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Specific Item Instruction
                                </label>
                                <p className="text-sm bg-muted/40 p-3 rounded-lg border italic">
                                    "{item.ordering_instruction}"
                                </p>
                            </div>
                        )}

                        <div className="text-sm space-y-1">
                            <div className="font-semibold">Order details for portal:</div>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>Product: <span className="font-medium text-foreground">{item.product_name}</span></li>
                                <li>Quantity to Add: <span className="font-semibold text-brand">{qty} {item.unit}</span></li>
                            </ul>
                        </div>
                    </div>
                );
            }

            case "sms": {
                const phone = supplier?.phone || "N/A";
                const messageText = `Hi ${supplier?.contact_person || supplier?.supplier_name || "Supplier"}, I would like to order ${qty} x ${item.product_name} (${item.unit}). Thanks!`;
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Supplier SMS Phone Number
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-semibold truncate flex-1">{phone}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(phone, "phone")}
                                    className="shrink-0 h-8"
                                >
                                    {copied === "phone" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Generated SMS Message
                            </label>
                            <div className="rounded-lg border bg-muted/30 p-3 relative">
                                <p className="text-sm leading-relaxed pr-8">{messageText}</p>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(messageText, "msg")}
                                    className="absolute right-2 top-2 h-7 w-7"
                                >
                                    {copied === "msg" ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {item.ordering_instruction && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Specific Item Instruction
                                </label>
                                <p className="text-sm bg-muted/40 p-3 rounded-lg border italic">
                                    "{item.ordering_instruction}"
                                </p>
                            </div>
                        )}
                    </div>
                );
            }

            case "email": {
                const email = supplier?.email || "N/A";
                const subject = `Order Request - ${item.product_name}`;
                const bodyText = `Hi ${supplier?.contact_person || supplier?.supplier_name || "Supplier"},\n\nWe would like to place an order for the following item:\n- Item Name: ${item.product_name}\n- Quantity: ${qty} ${item.unit}\n\nPlease reply to confirm receipt and delivery day.\n\nThank you,\nStore Manager`;
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Supplier Email Address
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-semibold truncate flex-1">{email}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(email, "email")}
                                    className="shrink-0 h-8"
                                >
                                    {copied === "email" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Suggested Email Subject
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                                <span className="text-sm font-medium truncate flex-1">{subject}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(subject, "subject")}
                                    className="h-8 w-8"
                                >
                                    {copied === "subject" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Generated Email Body
                            </label>
                            <div className="rounded-lg border bg-muted/30 p-3 relative">
                                <pre className="text-sm font-sans leading-relaxed whitespace-pre-wrap pr-8">{bodyText}</pre>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(bodyText, "body")}
                                    className="absolute right-2 top-2 h-7 w-7"
                                >
                                    {copied === "body" ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            }

            case "phone":
            case "rep": {
                const isRep = method === "rep";
                const phone = supplier?.phone || "N/A";
                const name = supplier?.contact_person || supplier?.supplier_name || "Supplier";
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {isRep ? "Sales Rep Phone / Contact" : "Supplier Phone Number"}
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-bold truncate flex-1">{phone}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(phone, "phone")}
                                    className="shrink-0 h-8"
                                >
                                    {copied === "phone" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm leading-relaxed">
                            <h4 className="font-semibold text-foreground">Ordering Checklist:</h4>
                            <ul className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
                                <li>Call <span className="font-medium text-foreground">{name}</span> at <span className="font-semibold text-foreground">{phone}</span>.</li>
                                <li>State you are calling from your store/business.</li>
                                <li>Request to order <span className="font-semibold text-brand">{qty} {item.unit}</span> of <span className="font-semibold text-foreground">{item.product_name}</span>.</li>
                                <li>Verify delivery day and note down any reference number if provided.</li>
                            </ul>
                        </div>

                        {item.ordering_instruction && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Specific Item Instruction
                                </label>
                                <p className="text-sm bg-muted/40 p-3 rounded-lg border italic">
                                    "{item.ordering_instruction}"
                                </p>
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return <p className="text-sm">No specific instructions found for method: {method}</p>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-brand">
                        <MessageSquare className="h-5 w-5" />
                        <DialogTitle>Ordering Instructions</DialogTitle>
                    </div>
                    <DialogDescription>
                        Follow these instructions to order {qty} {item.unit} of {item.product_name} from {supplier?.supplier_name || "Supplier"}.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 border-t border-b my-2 max-h-[60vh] overflow-y-auto">
                    {renderMethodInstructions()}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close Instructions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
