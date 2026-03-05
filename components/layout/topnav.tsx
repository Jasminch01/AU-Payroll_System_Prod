"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Menu, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavProps {
    pageTitle: string;
    pageDescription?: string;
    onMenuClick?: () => void;
    actions?: React.ReactNode;
}

export function TopNav({
    pageTitle,
    pageDescription,
    onMenuClick,
    actions,
}: TopNavProps) {
    const router = useRouter();
    const { user, fullName, initials, isLoading } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setProfileOpen(false);
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    const handleProfileClick = () => {
        setProfileOpen(false);
        if (user?.role === "owner") {
            router.push("/owner/settings");
        } else if (user?.role === "employee") {
            router.push("/employee/profile");
        }
    };

    const handleSettingsClick = () => {
        setProfileOpen(false);
        if (user?.role === "owner") {
            router.push("/owner/settings");
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 px-6 backdrop-blur-md">
            {/* Left — Title */}
            <div className="flex items-center gap-4">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors lg:hidden"
                >
                    <Menu size={20} />
                </button>

                <div>
                    <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">{pageTitle}</h1>
                    {pageDescription && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{pageDescription}</p>
                    )}
                </div>
            </div>

            {/* Right — Actions + Profile */}
            <div className="flex items-center gap-2">
                {/* Custom page actions (e.g. "Add Employee" button) */}
                {actions}

                {/* Global Search */}
                <button
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    title="Search"
                >
                    <Search size={18} />
                </button>

                {/* Notifications */}
                <button
                    className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                    title="Notifications"
                >
                    <Bell size={18} />
                    {/* Notification dot */}
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--danger))]" />
                </button>

                {/* Divider */}
                <div className="mx-1 h-6 w-px bg-[hsl(var(--border))]" />

                {/* User Profile Dropdown */}
                <div ref={dropdownRef} className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className={cn(
                            "flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all duration-150",
                            profileOpen
                                ? "bg-[hsl(var(--muted))]"
                                : "hover:bg-[hsl(var(--muted))]"
                        )}
                    >
                        {/* Avatar */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark,var(--brand)))] text-white text-xs font-bold uppercase shadow-sm">
                            {isLoading ? "…" : initials}
                        </div>
                        {/* Name + Role */}
                        <div className="hidden sm:block text-left">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] leading-tight truncate max-w-[120px]">
                                {isLoading ? "Loading…" : fullName || "User"}
                            </p>
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] capitalize leading-tight">
                                {user?.role || ""}
                            </p>
                        </div>
                        <ChevronDown
                            size={14}
                            className={cn(
                                "hidden sm:block text-[hsl(var(--muted-foreground))] transition-transform duration-200",
                                profileOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl shadow-black/10"
                            >
                                {/* User Info Header */}
                                <div className="border-b border-[hsl(var(--border))] px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark,var(--brand)))] text-white text-sm font-bold uppercase">
                                            {initials}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                                                {fullName || "User"}
                                            </p>
                                            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                                {user?.email || ""}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items */}
                                <div className="py-1.5">
                                    <button
                                        onClick={handleProfileClick}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                                    >
                                        <User size={16} className="text-[hsl(var(--muted-foreground))]" />
                                        <span>My Profile</span>
                                    </button>

                                    {user?.role === "owner" && (
                                        <button
                                            onClick={handleSettingsClick}
                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                                        >
                                            <Settings size={16} className="text-[hsl(var(--muted-foreground))]" />
                                            <span>Settings</span>
                                        </button>
                                    )}
                                </div>

                                {/* Sign Out */}
                                <div className="border-t border-[hsl(var(--border))] py-1.5">
                                    <button
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
