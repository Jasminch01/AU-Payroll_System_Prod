"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import Link from "next/link";

interface CategoryCardProps {
    categoryId: string;
    categoryName: string;
    defaultSupplierName?: string;
    cutoffTime?: string | null;
    totalItems: number;
    completedItems: number;
    issueCount: number;
    href: string;
}

export function CategoryCard({
    categoryId,
    categoryName,
    defaultSupplierName = "N/A",
    cutoffTime,
    totalItems,
    completedItems,
    issueCount,
    href
}: CategoryCardProps) {
    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const isCompleted = completedItems === totalItems && totalItems > 0;
    const hasIssues = issueCount > 0;

    return (
        <Link href={href} className="block transition-all hover:scale-[1.01] active:scale-[0.99]">
            <Card className="h-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h3 className="font-bold text-lg text-[hsl(var(--foreground))]">{categoryName}</h3>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Supplier: <span className="font-medium text-foreground">{defaultSupplierName}</span>
                            </p>
                        </div>

                        {/* Status Icon */}
                        <div>
                            {isCompleted ? (
                                <CheckCircle2 className="h-6 w-6 text-green-500 fill-green-50 dark:fill-green-950/20" />
                            ) : hasIssues ? (
                                <AlertCircle className="h-6 w-6 text-red-500 fill-red-50 dark:fill-red-950/20" />
                            ) : (
                                <HelpCircle className="h-6 w-6 text-blue-500 fill-blue-50 dark:fill-blue-950/20" />
                            )}
                        </div>
                    </div>

                    {/* Progress Bar & Numbers */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Ordering Status</span>
                            <span className="text-foreground">
                                {completedItems} / {totalItems} items ({percent}%)
                            </span>
                        </div>
                        {/* Custom modern progress bar if ui/progress is not fully configured, otherwise simple div */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isCompleted
                                        ? "bg-green-500"
                                        : hasIssues
                                        ? "bg-red-500"
                                        : "bg-brand"
                                }`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between pt-2 border-t text-xs text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Cutoff: {cutoffTime ? cutoffTime.substring(0, 5) : "N/A"}</span>
                        </div>

                        {hasIssues && (
                            <span className="text-red-500 font-medium">
                                {issueCount} blocked item{issueCount > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
