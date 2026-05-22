"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

import { MobileNav } from "./mobile-nav";
import { usePathname } from "next/navigation";

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: "owner" | "manager" | "employee";
    pageTitle: React.ReactNode;
    pageDescription?: string;
    businessName?: string;
    actions?: React.ReactNode;
    defaultCollapsed?: boolean;
}

export function DashboardLayout({
    children,
    role,
    pageTitle,
    pageDescription,
    businessName,
    actions,
    defaultCollapsed = true,
}: DashboardLayoutProps) {
    const { user } = useAuth();
    const pathname = usePathname();


    // Check if we're on a roster route
    const isRosterRoute = pathname?.includes('/roster');
    
    // Use localStorage to persist the user's preference
    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar-collapsed');
            if (saved !== null) return saved === 'true';
        }
        return defaultCollapsed || isRosterRoute;
    });

    // Save preference when manually changed
    const handleToggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', newState.toString());
    };

    // Only force-collapse when navigating TO a roster route from a non-roster route
    const lastPathRef = React.useRef(pathname);
    React.useEffect(() => {
        const wasRoster = lastPathRef.current?.includes('/roster');
        if (isRosterRoute && !wasRoster) {
            setIsCollapsed(true);
        }
        lastPathRef.current = pathname;
    }, [pathname, isRosterRoute]);

    return (
        <div className="flex min-h-screen bg-[hsl(var(--background))]">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar
                    role={role}
                    businessName={businessName || user?.business?.business_name}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={handleToggleCollapse}
                />
            </div>


            {/* Main Content Area — dynamically offset by sidebar width */}
            <div 
                className={cn(
                    "flex flex-1 flex-col min-w-0 transition-[margin] duration-200 ease-[0.4,0,0.2,1]",
                    isCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
                )}
            >
                <TopNav />


                {/* Page Content with fade-in animation */}
                <motion.main
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 px-6 pt-3 lg:pt-6 pb-28 lg:pb-6"
                >
                    {/* Page Content with fade-in animation */}
                    {(pageTitle || actions) && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 lg:mb-8 gap-4">
                            <div className="hidden lg:block">
                                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">{pageTitle}</h1>
                                {pageDescription && (
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">{pageDescription}</p>
                                )}
                            </div>
                            {actions && (
                                <div className="flex items-center gap-3 shrink-0">
                                    {actions}
                                </div>
                            )}
                        </div>
                    )}

                    {children}
                </motion.main>
            </div>

            {/* Mobile Navigation Bar */}
            <MobileNav role={role} />
        </div>
    );
}
