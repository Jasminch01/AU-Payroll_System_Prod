"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Link2, CheckCircle, XCircle, MonitorSmartphone } from "lucide-react";

export default function OwnerSettingsPage() {
    const queryClient = useQueryClient();
    // Xero status
    const { data: xeroStatus, isLoading: xeroLoading } = useQuery({
        queryKey: ["xero-status"],
        queryFn: () => apiGet<any>("/xero/status"),
    });

    const handleXeroConnect = () => {
        window.location.href = "/api/xero/auth";
    };

    const handleXeroDisconnect = async () => {
        try {
            await apiPost("/xero/status");
            toast.success("Xero disconnected");
            queryClient.invalidateQueries({ queryKey: ["xero-status"] });
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <DashboardLayout
            role="owner"
            pageTitle="Settings"
            pageDescription="Business settings and integrations"
        >
            {/* Xero Integration */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Link2 size={20} /> Xero Integration
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {xeroStatus?.connected ? (
                                <>
                                    <CheckCircle size={20} className="text-[hsl(var(--success))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--success))]">Connected</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            Tenant ID: {xeroStatus.tenant_id?.slice(0, 8)}...
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <XCircle size={20} className="text-[hsl(var(--muted-foreground))]" />
                                    <p className="text-[hsl(var(--muted-foreground))]">Not connected</p>
                                </>
                            )}
                        </div>
                        {xeroStatus?.connected ? (
                            <Button variant="danger" size="sm" onClick={handleXeroDisconnect}>
                                Disconnect
                            </Button>
                        ) : (
                            <Button onClick={handleXeroConnect}>
                                <Link2 size={16} /> Connect Xero
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Kiosk Mode Setup */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MonitorSmartphone size={20} /> Kiosk Mode
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-[hsl(var(--muted-foreground))]">
                                <p className="font-medium text-[hsl(var(--foreground))]">Setup Kiosk Device</p>
                                <p className="text-sm">Authorize an iPad or Tablet to securely run Kiosk Mode.</p>
                            </div>
                        </div>
                        <Button onClick={() => window.open("/kiosk/setup", "_blank")}>
                            <MonitorSmartphone size={16} /> Launch Kiosk
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout >
    );
}
