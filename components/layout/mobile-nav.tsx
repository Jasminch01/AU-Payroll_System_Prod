"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
    LayoutDashboard, 
    CalendarDays, 
    Clock, 
    FileText, 
    User,
    Users,
    DollarSign,
    ShieldCheck
} from "lucide-react";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface MobileNavProps {
    role: "owner" | "manager" | "employee";
}

const navConfig = {
    owner: [
        { label: "Home", href: "/owner/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Team", href: "/owner/employees", icon: <Users size={20} /> },
        { label: "Roster", href: "/owner/roster", icon: <CalendarDays size={20} /> },
        { label: "Payroll", href: "/owner/payroll", icon: <DollarSign size={20} /> },
        { label: "Profile", href: "/profile", icon: <User size={20} /> },
    ],
    manager: [
        { label: "Home", href: "/manager/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Team", href: "/manager/team", icon: <Users size={20} /> },
        { label: "Roster", href: "/manager/roster", icon: <CalendarDays size={20} /> },
        { label: "Shifts", href: "/manager/shifts", icon: <CalendarDays size={20} /> },
        { label: "Profile", href: "/profile", icon: <User size={20} /> },
    ],
    employee: [
        { label: "Home", href: "/employee/dashboard", icon: <LayoutDashboard size={20} /> },
        { label: "Shifts", href: "/employee/shifts", icon: <CalendarDays size={20} /> },
        { label: "Timesheets", href: "/employee/timesheets", icon: <FileText size={20} /> },
        { label: "Leave", href: "/employee/leave", icon: <Clock size={20} /> },
        { label: "Profile", href: "/profile", icon: <User size={20} /> },
    ],
};

export function MobileNav({ role }: MobileNavProps) {
    const pathname = usePathname();
    const items = navConfig[role] || navConfig.employee;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-4 pb-4 pt-2">
            <div className="mx-auto max-w-md rounded-2xl bg-[hsl(var(--card))]/80 backdrop-blur-lg border border-[hsl(var(--border))] shadow-2xl flex items-center justify-around p-1">
                {items.slice(0, 5).map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/profile" && pathname?.startsWith(item.href));
                    
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 min-w-[64px]",
                                isActive 
                                    ? "text-[hsl(var(--brand))] bg-[hsl(var(--brand-light))]/50 font-medium" 
                                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            )}
                        >
                            <span className={cn(
                                "transition-transform duration-200",
                                isActive && "scale-110"
                            )}>
                                {item.icon}
                            </span>
                            <span className="text-[10px] font-medium leading-none">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
