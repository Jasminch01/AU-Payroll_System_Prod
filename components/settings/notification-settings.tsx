"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch } from "@/lib/api-client";
import { toast } from "sonner";
import { Bell, Clock, ArrowLeftRight, FileText, UserPlus, Calendar } from "lucide-react";

const NOTIFICATION_CONFIG = [
    {
        type: "ATTENDANCE_CLOCK_EVENT",
        label: "Attendance Events",
        description: "Notify when employees clock in or out.",
        icon: Clock,
    },
    {
        type: "SHIFT_SWAP_REQUESTED",
        label: "Shift Requests",
        description: "Notify when a shift swap or transfer is requested.",
        icon: ArrowLeftRight,
    },
    {
        type: "TIMESHEET_SUBMITTED",
        label: "Timesheet Submissions",
        description: "Notify when an employee submits a timesheet for approval.",
        icon: FileText,
    },
    {
        type: "LEAVE_REQUESTED",
        label: "Leave Requests",
        description: "Notify when an employee requests leave.",
        icon: Calendar,
    },
    {
        type: "EMPLOYEE_JOINED",
        label: "New Team Members",
        description: "Notify when a new employee joins the business.",
        icon: UserPlus,
    },
];

export function NotificationSettings() {
    const queryClient = useQueryClient();

    const { data: preferences = [], isLoading } = useQuery({
        queryKey: ["notification-preferences"],
        queryFn: async () => {
            const res: any = await apiGet("/notifications/preferences");
            return res.data || res || [];
        },
    });

    const mutation = useMutation({
        mutationFn: ({ type, is_enabled }: { type: string; is_enabled: boolean }) =>
            apiPatch("/notifications/preferences", { type, is_enabled }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update preference");
        },
    });

    const isEnabled = (type: string) => {
        const pref = preferences.find((p: any) => p.type === type);
        return pref ? pref.is_enabled : true; // Default to true
    };

    const handleToggle = (type: string, currentStatus: boolean) => {
        mutation.mutate({ type, is_enabled: !currentStatus });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell size={20} /> Notification Preferences
                </CardTitle>
                <CardDescription>
                    Control which actions trigger notifications for your account.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-12 w-full animate-pulse bg-[hsl(var(--muted))] rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-[hsl(var(--border))]">
                        {NOTIFICATION_CONFIG.map((config) => {
                            const Icon = config.icon;
                            const active = isEnabled(config.type);
                            return (
                                <div key={config.type} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 p-2 rounded-lg ${active ? 'bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <Label htmlFor={config.type} className="text-sm font-semibold cursor-pointer">
                                                {config.label}
                                            </Label>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {config.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        id={config.type}
                                        checked={active}
                                        onCheckedChange={() => handleToggle(config.type, active)}
                                        disabled={mutation.isPending}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
