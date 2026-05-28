"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { StockStatus } from "@/types/database";

interface StockStatusBadgeProps {
    status: StockStatus;
}

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
    switch (status) {
        case "enough":
            return (
                <Badge variant="success" className="font-semibold px-2 py-0.5">
                    Enough
                </Badge>
            );
        case "low":
            return (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-0.5 border-none">
                    Low Stock
                </Badge>
            );
        case "out_of_stock":
            return (
                <Badge variant="danger" className="font-semibold px-2 py-0.5">
                    Out of Stock
                </Badge>
            );
        case "not_checked":
        default:
            return (
                <Badge variant="secondary" className="font-semibold px-2 py-0.5">
                    Not Checked
                </Badge>
            );
    }
}
