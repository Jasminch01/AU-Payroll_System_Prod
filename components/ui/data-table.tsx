"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
    actions?: React.ReactNode;
    mobileCardRender?: (row: T) => React.ReactNode;
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
    actions,
    mobileCardRender,
}: DataTableProps<T>) {
    const isMobile = useIsMobile();
    const [search, setSearch] = React.useState("");
    const [sortKey, setSortKey] = React.useState<string | null>(null);
    const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

    const [currentPage, setCurrentPage] = React.useState(1);
    const pageSize = 10;

    React.useEffect(() => {
        setCurrentPage(1);
    }, [search, sortKey, sortDir]);

    // Helper to get nested values by dot-notation key (e.g. "Employee.first_name")
    const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    };

    // Filter
    const filtered = React.useMemo(() => {
        if (!search || searchKeys.length === 0) return data;
        const lower = search.toLowerCase();
        return data.filter((row) =>
            searchKeys.some((key) => String(getNestedValue(row, key) ?? "").toLowerCase().includes(lower))
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

    // Pagination
    const totalPages = Math.ceil(sorted.length / pageSize) || 1;
    const paginated = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, currentPage, pageSize]);

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
            {/* Toolbar (Search & Actions) */}
            {(searchable || actions) && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {searchable ? (
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent pl-9 pr-3 py-2 text-sm transition-all placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    {actions && (
                        <div className="w-full sm:w-auto flex shrink-0">
                            {actions}
                        </div>
                    )}
                </div>
            )}

            {/* Table / Card View */}
            <div className={cn(
                "rounded-xl overflow-hidden",
                !isMobile && "border border-[hsl(var(--border))]"
            )}>
                {isMobile ? (
                    /* Mobile Card View */
                    <div className="space-y-4">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 animate-pulse">
                                    <div className="h-4 w-1/3 bg-[hsl(var(--muted))] rounded mb-3" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-[hsl(var(--muted))] rounded" />
                                        <div className="h-3 w-3/4 bg-[hsl(var(--muted))] rounded" />
                                    </div>
                                </div>
                            ))
                        ) : sorted.length === 0 ? (
                            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    {emptyIcon && <div className="text-[hsl(var(--muted-foreground))]">{emptyIcon}</div>}
                                    <p className="text-[hsl(var(--muted-foreground))]">{emptyMessage}</p>
                                </div>
                            </div>
                        ) : (
                            paginated.map((row, i) => (
                                <div
                                    key={i}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(
                                        "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm active:scale-[0.98] transition-all",
                                        onRowClick && "cursor-pointer"
                                    )}
                                >
                                    {mobileCardRender ? (
                                        mobileCardRender(row)
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Default Card Layout using columns */}
                                            {columns.map((col, idx) => {
                                                const value = col.render ? col.render(row) : row[col.key];
                                                if (idx === 0) {
                                                    return (
                                                        <div key={col.key} className="flex justify-between items-start border-b border-[hsl(var(--border))] pb-2 mb-2">
                                                            <div className="font-bold text-base text-[hsl(var(--foreground))]">{value}</div>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={col.key} className="flex justify-between text-sm py-0.5">
                                                        <span className="text-[hsl(var(--muted-foreground))]">{col.label}</span>
                                                        <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) }
                    </div>
                ) : (
                    /* Desktop Table View */
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
                                    paginated.map((row, i) => (
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
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} entries
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="h-8 px-3 rounded-md text-sm border border-[hsl(var(--input))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--foreground))]"
                        >
                            Previous
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="h-8 px-3 rounded-md text-sm border border-[hsl(var(--input))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--foreground))]"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
