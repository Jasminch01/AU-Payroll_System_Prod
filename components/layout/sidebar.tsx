"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    Clock,
    FileText,
    Palmtree,
    DollarSign,
    BarChart3,
    Settings,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    MonitorSmartphone,
} from "lucide-react";

export interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: string | number;
}

interface SidebarProps {
    role: "owner" | "manager" | "employee";
    businessName?: string;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const ownerNav: NavItem[] = [
    { label: "Dashboard", href: "/owner/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Employees", href: "/owner/employees", icon: <Users size={20} /> },
    { label: "Roster", href: "/owner/roster", icon: <CalendarDays size={20} /> },
    { label: "Attendance", href: "/owner/attendance", icon: <Clock size={20} /> },
    { label: "Approvals", href: "/owner/approvals", icon: <ShieldCheck size={20} /> },
    { label: "Timesheets", href: "/owner/timesheets", icon: <FileText size={20} /> },
    { label: "Leave", href: "/owner/leave", icon: <Palmtree size={20} /> },
    { label: "Payroll", href: "/owner/payroll", icon: <DollarSign size={20} /> },
    { label: "Analytics", href: "/owner/analytics", icon: <BarChart3 size={20} /> },
    { label: "Audit Log", href: "/owner/audit", icon: <ShieldCheck size={20} /> },
];

const managerNav: NavItem[] = [
    { label: "Dashboard", href: "/manager/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Team", href: "/manager/team", icon: <Users size={20} /> },
    { label: "Roster", href: "/manager/roster", icon: <CalendarDays size={20} /> },
    { label: "My Shifts", href: "/manager/shifts", icon: <CalendarDays size={20} /> },
    { label: "Attendance", href: "/manager/attendance", icon: <Clock size={20} /> },
    { label: "Timesheets", href: "/manager/timesheets", icon: <FileText size={20} /> },
    { label: "Leave", href: "/manager/leave", icon: <Palmtree size={20} /> },
    { label: "Approvals", href: "/manager/approvals", icon: <ShieldCheck size={20} /> },
];

const employeeNav: NavItem[] = [
    { label: "Dashboard", href: "/employee/dashboard", icon: <LayoutDashboard size={20} /> },
  //  { label: "Clock In / Out", href: "/employee/clock", icon: <Clock size={20} /> },
    { label: "My Shifts", href: "/employee/shifts", icon: <CalendarDays size={20} /> },
    { label: "Timesheets", href: "/employee/timesheets", icon: <FileText size={20} /> },
    { label: "Leave", href: "/employee/leave", icon: <Palmtree size={20} /> },
];

const navMap = {
    owner: ownerNav,
    manager: managerNav,
    employee: employeeNav,
};

export function Sidebar({ role, businessName = "AU Payroll", isCollapsed = false, onToggleCollapse }: SidebarProps) {
    const pathname = usePathname();
    const items = navMap[role];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 72 : 260 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[hsl(var(--sidebar-muted))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] shadow-[1px_0_0_0_hsl(var(--sidebar-muted))]"
        >

            {/* Logo / Business Name */}
            <div className="flex h-16 items-center gap-3 border-b border-[hsl(var(--sidebar-muted))] px-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-accent))] text-white font-bold text-sm">
                    {(businessName || "A").charAt(0).toUpperCase()}
                </div>
                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="truncate text-sm font-semibold overflow-hidden whitespace-nowrap"
                        >
                            {businessName || "AU Payroll"}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150",
                                isActive
                                    ? "bg-[hsl(var(--sidebar-accent))] text-white shadow-md shadow-[hsl(var(--sidebar-accent))/20]"
                                    : "text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-foreground))]"
                            )}

                            title={isCollapsed ? item.label : undefined}
                        >
                            <span className="shrink-0">{item.icon}</span>
                            <AnimatePresence>
                                {!isCollapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: "auto" }}
                                        exit={{ opacity: 0, width: 0 }}
                                        className="overflow-hidden whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {!isCollapsed && item.badge && (
                                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--danger))] px-1.5 text-[10px] font-bold text-white">
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section — Collapse Toggle only */}
            {onToggleCollapse && (
                <div className="border-t border-[hsl(var(--sidebar-muted))] p-3">
                    <button
                        onClick={onToggleCollapse}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-foreground))] transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        <AnimatePresence>
                            {!isCollapsed && (
                                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    Collapse
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            )}
        </motion.aside>
    );
}
