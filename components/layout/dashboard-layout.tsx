"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";
import { motion } from "framer-motion";
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

    return (
        <div className="flex min-h-screen bg-[hsl(var(--background))]">
            {/* Sidebar */}
            <Sidebar
                role={role}
                businessName={businessName || user?.business?.business_name}
            />

            {/* Main Content Area — offset by sidebar width */}
            <div className="flex flex-1 flex-col lg:ml-[260px]">
                <TopNav
                    pageTitle={pageTitle}
                    pageDescription={pageDescription}
                    actions={actions}
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
