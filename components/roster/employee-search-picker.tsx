"use client";

import React, { useState, useMemo } from "react";
import { Search, ChevronDown, Check, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Employee {
    employee_id: string;
    first_name: string;
    last_name: string;
    role?: string;
    role_title?: string;
}

interface EmployeeSearchPickerProps {
    employees: Employee[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
    error?: string;
}

export function EmployeeSearchPicker({ employees, value, onChange, disabled, error }: EmployeeSearchPickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedEmployee = useMemo(() => 
        employees.find(e => e.employee_id === value),
        [employees, value]
    );

    const filteredEmployees = useMemo(() => {
        if (!search) return employees;
        const s = search.toLowerCase();
        return employees.filter(e => 
            e.first_name.toLowerCase().includes(s) || 
            e.last_name.toLowerCase().includes(s) ||
            (e.role && e.role.toLowerCase().includes(s))
        );
    }, [employees, search]);

    return (
        <div className="space-y-1.5 w-full">
            <label className="text-sm font-medium">Employee</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "flex h-10 w-full items-center justify-between rounded-lg border bg-transparent px-3 py-2 text-sm transition-all duration-150",
                            "hover:bg-[hsl(var(--muted))]/10",
                            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/20 focus:border-[hsl(var(--brand))]",
                            disabled && "opacity-50 cursor-not-allowed",
                            error ? "border-[hsl(var(--danger))]" : "border-[hsl(var(--input))]"
                        )}
                    >
                        {selectedEmployee ? (
                            <div className="flex items-center gap-2 truncate">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] text-[10px] font-bold">
                                    {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                                </div>
                                <span className="font-medium truncate">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                            </div>
                        ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">Select employee...</span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-(--radix-popover-trigger-width) p-0 z-100 bg-white shadow-2xl border-[hsl(var(--border))] rounded-xl overflow-hidden" align="start">
                    <div className="flex flex-col h-[300px] bg-white">
                        <div className="flex items-center border-b p-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                placeholder="Search by name or role..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                            {filteredEmployees.length === 0 ? (
                                <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                    No employees found.
                                </div>
                            ) : (
                                filteredEmployees.map((emp) => (
                                    <button
                                        key={emp.employee_id}
                                        onClick={() => {
                                            onChange(emp.employee_id);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className={cn(
                                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                                            "hover:bg-[hsl(var(--muted))] text-left",
                                            value === emp.employee_id && "bg-[hsl(var(--brand-light))]/50 text-[hsl(var(--brand))]"
                                        )}
                                    >
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-[10px] font-bold">
                                            {emp.first_name[0]}{emp.last_name[0]}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="font-medium truncate">{emp.first_name} {emp.last_name}</span>
                                            {emp.role && (
                                                <span className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-bold tracking-tight truncate">
                                                    {emp.role === 'manager' ? 'Manager' : 'Staff'}
                                                </span>
                                            )}
                                        </div>
                                        {value === emp.employee_id && <Check className="h-4 w-4 shrink-0" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            {error && <p className="text-xs text-[hsl(var(--danger))] mt-1">{error}</p>}
        </div>
    );
}
