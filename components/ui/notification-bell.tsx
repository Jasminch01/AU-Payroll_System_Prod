"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { getNotificationRoute } from "@/lib/notification-routes";

interface NotificationData {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    entity_id: string | null;
}

export function NotificationBell() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();
    const router = useRouter();

    // Fetch Notifications
    const { data: notifications = [] } = useQuery<NotificationData[]>({
        queryKey: ["notifications", user?.user_id],
        queryFn: async () => {
            const res = await fetch("/api/notifications?limit=20");
            if (!res.ok) throw new Error("Network response was not ok");
            const result = await res.json();
            return result.data || [];
        },
        enabled: !!user,
    });

    // Real-time listener for notifications
    useEffect(() => {
        if (!user) return;
        const supabase = createClient();
        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.user_id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["notifications", user.user_id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Mutation to mark as read
    const markAsReadMutation = useMutation({
        mutationFn: async (ids?: string[]) => {
            const res = await fetch("/api/notifications/read", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notification_ids: ids }),
            });
            if (!res.ok) throw new Error("Failed to mark as read");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", user?.user_id] });
        }
    });

    const handleMarkAllRead = () => {
        markAsReadMutation.mutate(undefined);
    };

    const handleNotificationClick = (n: NotificationData) => {
        if (!n.is_read) {
            markAsReadMutation.mutate([n.id]);
        }
        setOpen(false);

        // Use centralized routing utility
        if (user?.role) {
            const route = getNotificationRoute(
                n.type as any,
                n.entity_id,
                user.role as 'owner' | 'manager' | 'employee'
            );

            if (route) {
                router.push(route);
            }
        }
    };

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition-all duration-150 ring-offset-[hsl(var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
                    open ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]" : "hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                )}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl shadow-black/10 origin-top-right z-150"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs font-medium text-[hsl(var(--brand))] hover:underline"
                                    disabled={markAsReadMutation.isPending}
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-[310px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center space-y-2 px-4 py-8 text-center">
                                    <Bell className="h-8 w-8 text-[hsl(var(--muted-foreground))]/50" />
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">You have no notifications.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={cn(
                                                "cursor-pointer border-b border-[hsl(var(--border))]/50 px-4 py-3 last:border-0 hover:bg-[hsl(var(--muted))]/50 transition-colors",
                                                !notification.is_read ? "bg-[hsl(var(--muted))]/30" : "opacity-75"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-4 mb-0.5">
                                                        <p className={cn(
                                                            "text-sm",
                                                            !notification.is_read ? "font-semibold text-[hsl(var(--foreground))]" : "font-medium text-[hsl(var(--foreground))]"
                                                        )}>
                                                            {notification.title}
                                                        </p>
                                                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap pt-0.5">
                                                            {new Date(notification.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                </div>
                                                {!notification.is_read && (
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--brand))]" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
