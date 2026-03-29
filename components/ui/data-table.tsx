"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
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
    filters?: React.ReactNode;
    mobileCardRender?: (row: T) => React.ReactNode;
    // Server-side pagination and handlers
    serverPagination?: boolean;
    totalItems?: number;
    pageSize?: number;
    page?: number;     // controlled page state
    onPageChange?: (page: number) => void;
    onSearch?: (search: string) => void;
    onSort?: (key: string, dir: "asc" | "desc") => void;
    maxHeight?: string; // e.g. "calc(100vh - 300px)"
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
    filters,
    mobileCardRender,
    serverPagination = false,
    totalItems = 0,
    pageSize = 10,
    page: controlledPage,
    onPageChange,
    onSearch,
    onSort,
    maxHeight,
}: DataTableProps<T>) {
    const isMobile = useIsMobile();
    const [search, setSearch] = React.useState("");
    const [sortKey, setSortKey] = React.useState<string | null>(null);
    const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

    const [currentPage, setCurrentPage] = React.useState(1);
    
    // Default to controlled if provided
    const actualPage = serverPagination && controlledPage !== undefined ? controlledPage : currentPage;

    React.useEffect(() => {
        if (!serverPagination) {
            setCurrentPage(1);
        }
    }, [search, sortKey, sortDir, serverPagination]);

    // Handle debounced search for server pagination
    React.useEffect(() => {
        if (serverPagination && onSearch) {
            const timer = setTimeout(() => {
                onSearch(search);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [search, serverPagination, onSearch]);

    // Helper to get nested values by dot-notation key (e.g. "Employee.first_name")
    const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    };

    // Filter
    const filtered = React.useMemo(() => {
        if (serverPagination || !search || searchKeys.length === 0) return data;
        const lower = search.toLowerCase();
        return data.filter((row) =>
            searchKeys.some((key) => String(getNestedValue(row, key) ?? "").toLowerCase().includes(lower))
        );
    }, [data, search, searchKeys, serverPagination]);

    // Sort
    const sorted = React.useMemo(() => {
        if (serverPagination || !sortKey) return filtered;
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey] ?? "";
            const bVal = b[sortKey] ?? "";
            if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [filtered, sortKey, sortDir, serverPagination]);

    // Pagination
    const totalPages = serverPagination ? Math.ceil(totalItems / pageSize) || 1 : Math.ceil(sorted.length / pageSize) || 1;
    const paginated = React.useMemo(() => {
        if (serverPagination) return sorted; // data is already paginated
        const start = (actualPage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, actualPage, pageSize, serverPagination]);

    const handleSort = (key: string) => {
        let newDir: "asc" | "desc" = "asc";
        if (sortKey === key) {
            newDir = sortDir === "asc" ? "desc" : "asc";
        }
        setSortKey(key);
        setSortDir(newDir);
        if (serverPagination && onSort) {
            onSort(key, newDir);
        }
    };
    
    const handlePageChange = (newPage: number) => {
        if (serverPagination && onPageChange) {
            onPageChange(newPage);
        } else {
            setCurrentPage(newPage);
        }
    };
    
    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const maxVisible = 5;
        let start = Math.max(1, actualPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        const pages = [];
        for (let p = start; p <= end; p++) {
            pages.push(p);
        }
        return { pages, start, end };
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Toolbar (Search & Actions) */}
            {(searchable || filters || actions) && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3 w-full sm:w-auto flex-1">
                        {searchable && (
                            <div className="relative w-full sm:max-w-sm shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-transparent pl-9 pr-3 py-2 text-sm transition-all placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]"
                                />
                            </div>
                        )}
                        {filters && (
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
                                {filters}
                            </div>
                        )}
                    </div>
                    {actions && (
                        <div className="w-full sm:w-auto flex justify-end shrink-0">
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
                    <div 
                        className="overflow-auto custom-scrollbar"
                        style={{ maxHeight: maxHeight || undefined }}
                    >
                        <table className="w-full text-sm relative">
                            <thead className="sticky top-0 z-10 bg-[hsl(var(--muted))] shadow-sm border-b border-[hsl(var(--border))]">
                                <tr>
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[hsl(var(--border))]">
                    <span className="text-sm text-[hsl(var(--muted-foreground))] font-medium">
                        Showing {((actualPage - 1) * pageSize) + 1} to {serverPagination ? Math.min(actualPage * pageSize, totalItems) : Math.min(actualPage * pageSize, sorted.length)} of {serverPagination ? totalItems : sorted.length} entries
                    </span>
                    <div className="flex items-center gap-1.5 bg-[hsl(var(--muted))]/30 p-1 rounded-xl border border-[hsl(var(--border))]">
                        <button
                            disabled={actualPage === 1}
                            onClick={() => handlePageChange(Math.max(1, actualPage - 1))}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--background))] hover:shadow-sm transition-all text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            title="Previous Page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1 px-1">
                            {getPageNumbers().start > 1 && (
                                <>
                                    <button onClick={() => handlePageChange(1)} className="h-8 w-8 rounded-lg text-sm font-medium hover:bg-[hsl(var(--background))] hover:shadow-sm transition-all text-[hsl(var(--muted-foreground))]">1</button>
                                    {getPageNumbers().start > 2 && <span className="text-[hsl(var(--muted-foreground))] px-1">...</span>}
                                </>
                            )}
                            
                            {getPageNumbers().pages.map(p => (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    className={cn(
                                        "h-8 w-8 rounded-lg text-sm font-medium transition-all",
                                        actualPage === p 
                                            ? "bg-[hsl(var(--brand))] text-white shadow-sm" 
                                            : "hover:bg-[hsl(var(--background))] hover:shadow-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                    )}
                                >
                                    {p}
                                </button>
                            ))}

                            {getPageNumbers().end < totalPages && (
                                <>
                                    {getPageNumbers().end < totalPages - 1 && <span className="text-[hsl(var(--muted-foreground))] px-1">...</span>}
                                    <button onClick={() => handlePageChange(totalPages)} className="h-8 w-8 rounded-lg text-sm font-medium hover:bg-[hsl(var(--background))] hover:shadow-sm transition-all text-[hsl(var(--muted-foreground))]">{totalPages}</button>
                                </>
                            )}
                        </div>

                        <button
                            disabled={actualPage === totalPages}
                            onClick={() => handlePageChange(Math.min(totalPages, actualPage + 1))}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--background))] hover:shadow-sm transition-all text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            title="Next Page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
