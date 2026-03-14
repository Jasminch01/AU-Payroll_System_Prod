"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Link2, CheckCircle, XCircle, MonitorSmartphone, Calendar } from "lucide-react";
import Link from "next/link";

export default function OwnerSettingsPage() {
    const queryClient = useQueryClient();

    const { data: xeroStatus, isLoading: xeroLoading } = useQuery({
        queryKey: ["xero-status"],
        queryFn: () => apiGet<any>("/xero/status"),
    });

    // Listen for messages from the Xero popup
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'xero-connected') {
                toast.success("Xero connected successfully!");
                queryClient.invalidateQueries({ queryKey: ["xero-status"] });
            } else if (event.data?.type === 'xero-error') {
                toast.error(event.data.msg || "Xero connection failed");
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [queryClient]);

    const handleXeroConnect = () => {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
            "/api/xero/auth", 
            "XeroConnect", 
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );
    };




    const handleXeroDisconnect = async () => {
        try {
            // ✅ Fix Bug 1 — correct endpoint is /xero/disconnect
            await apiPost("/xero/disconnect");
            toast.success("Xero disconnected");
            queryClient.invalidateQueries({ queryKey: ["xero-status"] });
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    // ✅ Fix Bug 3 — safely unwrap in case apiGet wraps in { data: ... }
    const xeroConnected = xeroStatus?.data?.connected ?? xeroStatus?.connected ?? false;
    const xeroTenantId = xeroStatus?.data?.tenant_id ?? xeroStatus?.tenant_id;

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
                            {xeroLoading ? (
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Checking status...</p>
                            ) : xeroConnected ? (
                                <>
                                    <CheckCircle size={20} className="text-[hsl(var(--success))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--success))]">Connected</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {/* ✅ Fix Bug 3 — use unwrapped value */}
                                            Tenant ID: {xeroTenantId?.slice(0, 8)}...
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
                        {xeroConnected ? (
                            <Button variant="danger" size="sm" onClick={handleXeroDisconnect}>
                                Disconnect
                            </Button>
                        ) : (
                            // ✅ Fix Bug 2 — plain button with onClick, not <Link>
                            <Button onClick={handleXeroConnect} disabled={xeroLoading}>
                                <Link2 size={16} /> Connect Xero
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Public Holidays */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar size={20} /> Public Holidays
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-[hsl(var(--muted-foreground))]">
                                <p className="font-medium text-[hsl(var(--foreground))]">Holiday Calendar</p>
                                <p className="text-sm">Manage National, State, and local regional public holidays.</p>
                            </div>
                        </div>
                        <Link href="/owner/settings/holidays">
                            <Button variant="outline">
                                <Calendar size={16} /> Manage Holidays
                            </Button>
                        </Link>
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
        </DashboardLayout>
    );
}