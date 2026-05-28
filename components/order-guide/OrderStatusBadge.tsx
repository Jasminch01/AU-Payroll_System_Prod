"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { OrderStatus } from "@/types/database";

interface OrderStatusBadgeProps {
    status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
    switch (status) {
        case "ordered":
            return (
                <Badge variant="success" className="font-semibold px-2 py-0.5">
                    Ordered
                </Badge>
            );
        case "not_required":
            return (
                <Badge variant="secondary" className="font-semibold px-2 py-0.5 text-xs text-muted-foreground">
                    Not Required
                </Badge>
            );
        case "issue":
            return (
                <Badge variant="danger" className="font-semibold px-2 py-0.5">
                    Issue / Blocked
                </Badge>
            );
        case "pending":
        default:
            return (
                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 font-semibold px-2 py-0.5 dark:text-blue-400 dark:border-blue-900 dark:bg-blue-950/30">
                    Pending
                </Badge>
            );
    }
}
