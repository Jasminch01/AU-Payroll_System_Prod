"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

/* ============================================
   DataTable — Reusable sortable, filterable table
   ============================================ */

export interface Column<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    searchable?: boolean;
    searchPlaceholder?: string;
    searchKeys?: string[];
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    onRowClick?: (row: T) => void;
    className?: string;
    loading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
    columns,
    data,
    searchable = false,
    searchPlaceholder = "Search...",
    searchKeys = [],
    emptyMessage = "No data found",
    emptyIcon,
    onRowClick,
    className,
    loading = false,
}: DataTableProps<T>) {
    const [search, setSearch] = React.useState("");
    const [sortKey, setSortKey] = React.useState<string | null>(null);
    const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

    // Filter
    const filtered = React.useMemo(() => {
        if (!search || searchKeys.length === 0) return data;
        const lower = search.toLowerCase();
        return data.filter((row) =>
            searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(lower))
        );
    }, [data, search, searchKeys]);

    // Sort
    const sorted = React.useMemo(() => {
        if (!sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey] ?? "";
            const bVal = b[sortKey] ?? "";
            if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Search Bar */}
            {searchable && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex h-10 w-full max-w-sm rounded-lg border border-[hsl(var(--input))] bg-transparent pl-9 pr-3 py-2 text-sm transition-all placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                    />
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            "px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]",
                                            col.sortable && "cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors",
                                            col.className
                                        )}
                                        onClick={() => col.sortable && handleSort(col.key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {col.sortable && sortKey === col.key && (
                                                sortDir === "asc"
                                                    ? <ChevronUp className="h-3.5 w-3.5" />
                                                    : <ChevronDown className="h-3.5 w-3.5" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                // Skeleton rows
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[hsl(var(--border))]">
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-4 py-3">
                                                <div className="skeleton h-4 w-3/4 rounded" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : sorted.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            {emptyIcon && <div className="text-[hsl(var(--muted-foreground))]">{emptyIcon}</div>}
                                            <p className="text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sorted.map((row, i) => (
                                    <tr
                                        key={i}
                                        className={cn(
                                            "border-b border-[hsl(var(--border))] transition-colors",
                                            onRowClick && "cursor-pointer hover:bg-[hsl(var(--muted))]"
                                        )}
                                        onClick={() => onRowClick?.(row)}
                                    >
                                        {columns.map((col) => (
                                            <td key={col.key} className={cn("px-4 py-3", col.className)}>
                                                {col.render ? col.render(row) : row[col.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
