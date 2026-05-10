"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PushPermissionCard } from "@/components/settings/push-permission-card";

export default function ManagerSettingsPage() {
    return (
        <DashboardLayout
            role="manager"
            pageTitle="Settings"
            pageDescription="Manage your personal preferences"
        >
            <div className="max-w-4xl space-y-6">
                <PushPermissionCard />
                <NotificationSettings />
            </div>
        </DashboardLayout>
    );
}
