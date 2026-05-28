"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    CalendarDays,
    Clock,
    FileText,
    Users,
    DollarSign,
    BarChart3,
    Settings,
    ShieldCheck,
    Palmtree,
    LogOut,
    Menu,
    X,
    ClipboardList,
    Package,
} from "lucide-react";

interface MobileNavProps {
    role: "owner" | "manager" | "employee";
}

// Primary bottom-bar tabs (max 4, excluding "More")
const primaryNav = {
    owner: [
        { label: "Home", href: "/owner/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Team", href: "/owner/employees", icon: <Users size={20} /> },
        { label: "Roster", href: "/owner/roster", icon: <CalendarDays size={20} /> },
    ],
    manager: [
        { label: "Home", href: "/manager/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Team", href: "/manager/team", icon: <Users size={20} /> },
        { label: "Roster", href: "/manager/roster", icon: <CalendarDays size={20} /> },
        { label: "Shifts", href: "/manager/shifts", icon: <CalendarDays size={20} /> },
    ],
    employee: [
        { label: "Home", href: "/employee/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Shifts", href: "/employee/shifts", icon: <CalendarDays size={20} /> },
        { label: "Availability", href: "/employee/availability", icon: <CalendarDays size={20} /> },
        { label: "Timesheets", href: "/employee/timesheets", icon: <FileText size={20} /> },
        { label: "Leave", href: "/employee/leave", icon: <Palmtree size={20} /> },
    ],
};

// Secondary routes that appear in the "More" drawer
const moreNav = {
    owner: [
        { label: "Payroll", href: "/owner/payroll", icon: <DollarSign size={20} /> },
        { label: "Checklists", href: "/owner/checklists", icon: <ClipboardList size={20} /> },
        { label: "Order Guide", href: "/owner/order-guide", icon: <Package size={20} /> },
        { label: "Attendance", href: "/owner/attendance", icon: <Clock size={20} /> },
        { label: "Timesheets", href: "/owner/timesheets", icon: <FileText size={20} /> },
        { label: "Leave", href: "/owner/leave", icon: <Palmtree size={20} /> },
        { label: "Approvals", href: "/owner/approvals", icon: <ShieldCheck size={20} /> },
        { label: "Analytics", href: "/owner/analytics", icon: <BarChart3 size={20} /> },
        { label: "Audit Log", href: "/owner/audit", icon: <ShieldCheck size={20} /> },
        { label: "Settings", href: "/owner/settings", icon: <Settings size={20} /> },
    ],
    manager: [
        { label: "Checklists", href: "/owner/checklists", icon: <ClipboardList size={20} /> },
        { label: "Order Guide", href: "/manager/order-guide", icon: <Package size={20} /> },
        { label: "Attendance", href: "/manager/attendance", icon: <Clock size={20} /> },
        { label: "Timesheets", href: "/manager/timesheets", icon: <FileText size={20} /> },
        { label: "Leave", href: "/manager/leave", icon: <Palmtree size={20} /> },
        { label: "Approvals", href: "/manager/approvals", icon: <ShieldCheck size={20} /> },
        { label: "Settings", href: "/manager/settings", icon: <Settings size={20} /> },
    ],
    employee: [
        { label: "Today's Orders", href: "/employee/orders", icon: <Package size={20} /> },
        { label: "Attendance", href: "/employee/attendance", icon: <Clock size={20} /> },
    ],
};

export function MobileNav({ role }: MobileNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [moreOpen, setMoreOpen] = useState(false);

    const primary = primaryNav[role] || primaryNav.employee;
    const more = moreNav[role] || moreNav.employee;

    // Check if current page is in the "more" section to highlight the More button
    const isMoreActive = more.some(
        (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
    );

    const handleLogout = async () => {
        setMoreOpen(false);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            queryClient.clear();
            router.push("/login");
        } catch {
            queryClient.clear();
            router.push("/login");
        }
    };

    return (
        <>
            {/* Bottom App Bar */}
            <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 lg:hidden w-[calc(100%-2rem)] max-w-sm">
                <div className="rounded-2xl bg-[hsl(var(--card))]/90 backdrop-blur-lg border border-[hsl(var(--border))] shadow-2xl shadow-black/20 flex items-center justify-around p-1">
                    {/* Primary nav items */}
                    {primary.map((item) => {
                        const isActive =
                            pathname === item.href || pathname?.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px]",
                                    isActive
                                        ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/50 font-medium"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                <span
                                    className={cn(
                                        "transition-transform duration-200",
                                        isActive && "scale-110"
                                    )}
                                >
                                    {item.icon}
                                </span>
                                <span className="text-[10px] font-medium leading-none">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* More button */}
                    <button
                        onClick={() => setMoreOpen(true)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px]",
                            isMoreActive || moreOpen
                                ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/50 font-medium"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        )}
                    >
                        <span className={cn("transition-transform duration-200", moreOpen && "scale-110")}>
                            <Menu size={20} />
                        </span>
                        <span className="text-[10px] font-medium leading-none">More</span>
                    </button>
                </div>
            </nav>

            {/* More Drawer */}
            <AnimatePresence>
                {moreOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm lg:hidden"
                            onClick={() => setMoreOpen(false)}
                        />

                        {/* Drawer panel */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                            className="fixed bottom-0 left-0 right-0 z-61 lg:hidden rounded-t-3xl bg-[hsl(var(--card))] border-t border-[hsl(var(--border))] shadow-2xl overflow-hidden"
                        >
                            {/* Handle bar */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-[hsl(var(--muted-foreground))]/30" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] uppercase tracking-wider">
                                    More Options
                                </h3>
                                <button
                                    onClick={() => setMoreOpen(false)}
                                    className="p-2 rounded-xl text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* More nav links */}
                            <div className="px-2 py-2 max-h-[55vh] overflow-y-auto">
                                <div className="flex flex-col">
                                    {more.map((item) => {
                                        const isActive =
                                            pathname === item.href ||
                                            (item.href !== "/profile" &&
                                                pathname?.startsWith(item.href + "/"));
                                        return (
                                            <Link
                                                key={item.label}
                                                href={item.href}
                                                onClick={() => setMoreOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-4 px-4 py-3.5 text-sm font-medium transition-colors",
                                                    isActive
                                                        ? "text-[hsl(var(--brand))]"
                                                        : "text-[hsl(var(--foreground))] hover:text-[hsl(var(--brand))]"
                                                )}
                                            >
                                                <span className={cn(
                                                    "shrink-0",
                                                    isActive
                                                        ? "text-[hsl(var(--brand))]"
                                                        : "text-[hsl(var(--muted-foreground))]"
                                                )}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sign out */}
                            <div className="px-4 pb-8 pt-2 border-t border-[hsl(var(--border))]">
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-4 px-4 py-3.5 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                                >
                                    <LogOut size={18} />
                                    Sign Out
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
