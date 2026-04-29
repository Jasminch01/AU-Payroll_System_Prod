"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default function ManagerSettingsPage() {
    return (
        <DashboardLayout
            role="manager"
            pageTitle="Settings"
            pageDescription="Manage your personal preferences"
        >
            <div className="max-w-4xl">
                <NotificationSettings />
            </div>
        </DashboardLayout>
    );
}
