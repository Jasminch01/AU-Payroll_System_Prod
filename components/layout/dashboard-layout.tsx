"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: "owner" | "manager" | "employee";
    pageTitle: string;
    pageDescription?: string;
    businessName?: string;
    actions?: React.ReactNode;
}

export function DashboardLayout({
    children,
    role,
    pageTitle,
    pageDescription,
    businessName,
    actions,
}: DashboardLayoutProps) {
    const { user } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-[hsl(var(--background))]">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
                <Sidebar
                    role={role}
                    businessName={businessName || user?.business?.business_name}
                />
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                            className="fixed left-0 top-0 z-50 lg:hidden"
                        >
                            <Sidebar
                                role={role}
                                businessName={businessName || user?.business?.business_name}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area — offset by sidebar width */}
            <div className="flex flex-1 flex-col lg:ml-[260px]">
                <TopNav
                    pageTitle={pageTitle}
                    pageDescription={pageDescription}
                    actions={actions}
                    onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                />

                {/* Page Content with fade-in animation */}
                <motion.main
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 p-6"
                >
                    {children}
                </motion.main>
            </div>
        </div>
    );
}
