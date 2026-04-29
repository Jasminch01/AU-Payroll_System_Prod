"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/ui/notification-bell";
import { motion, AnimatePresence } from "framer-motion";

interface TopNavProps {
    onMenuClick?: () => void;
}

export function TopNav({
    onMenuClick,
}: TopNavProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
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
            // Clear ALL cached query data so the next user never sees stale profile/data
            queryClient.clear();
            router.push("/login");
        } catch (err) {
            console.error("Logout failed:", err);
            // Still clear the cache even if logout API fails
            queryClient.clear();
            router.push("/login");
        }
    };

    const handleProfileClick = () => {
        setProfileOpen(false);
        router.push("/profile");
    };

    const handleSettingsClick = () => {
        setProfileOpen(false);
        if (user?.role === "owner") {
            router.push("/owner/settings");
        }
    };

    return (
        <header className="sticky top-0 z-100 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/80 px-6 backdrop-blur-md">
            {/* Left — Mobile Menu Toggle */}
            <div className="flex items-center">
                <button
                    onClick={onMenuClick}
                    className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors lg:hidden"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Right — Notifications + Profile */}
            <div className="flex items-center gap-2">
                <NotificationBell />
                {/* User Profile Dropdown */}
                <div ref={dropdownRef} className="relative">
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className={cn(
                            "flex items-center justify-center rounded-full transition-all duration-150 ring-offset-[hsl(var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
                            profileOpen ? "ring-2 ring-[hsl(var(--brand))]" : "hover:opacity-80"
                        )}
                        title="Profile Menu"
                    >
                        {/* Avatar Only */}
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark,var(--brand)))] text-white text-[10px] sm:text-xs font-bold uppercase shadow-sm">
                            {isLoading ? "…" : initials}
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl shadow-black/10 z-150"
                            >
                                {/* User Info Header */}
                                <div className="border-b border-[hsl(var(--border))] px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark,var(--brand)))] text-white text-sm font-bold uppercase">
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
