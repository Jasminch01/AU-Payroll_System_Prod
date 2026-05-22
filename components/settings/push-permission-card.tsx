"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, ExternalLink, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Detects the name of the current browser so we can give
 * precise instructions for opening notification settings.
 */
function getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
    return "Chrome"; // Default / most common
}

/**
 * Returns a deep-link URL to the browser's notification settings page.
 * Falls back to a generic page that explains how to reach it.
 */
function getNotificationSettingsUrl(): { url: string; isDeepLink: boolean } {
    const browser = getBrowserName();
    // Deep links only work in Chromium-family browsers
    if (browser === "Chrome" || browser === "Edge" || browser === "Opera") {
        return { url: "chrome://settings/content/notifications", isDeepLink: true };
    }
    // Firefox / Safari don't support chrome:// deep links
    return { url: "https://support.mozilla.org/en-US/kb/push-notifications-firefox", isDeepLink: false };
}

/**
 * Opens the browser's native notification-settings page.
 * chrome:// URLs cannot be opened via window.open from a web page,
 * so we copy the URL to the clipboard and instruct the user instead.
 */
async function openBrowserSettings() {
    const { url, isDeepLink } = getNotificationSettingsUrl();
    if (isDeepLink) {
        // Cannot navigate to chrome:// from JS — copy + instruct
        try {
            await navigator.clipboard.writeText(url);
            toast.info("URL copied to clipboard", {
                description: `Paste "${url}" into your browser address bar to open notification settings.`,
                duration: 8000,
            });
        } catch {
            toast.info("Open your browser settings", {
                description: `Navigate to: ${url}`,
                duration: 8000,
            });
        }
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}

export function PushPermissionCard() {
    const [supported, setSupported] = useState<boolean | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);

    // ── Initialise ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (
            typeof window === "undefined" ||
            !("Notification" in window) ||
            !("serviceWorker" in navigator) ||
            !("PushManager" in window)
        ) {
            setSupported(false);
            return;
        }

        setSupported(true);
        setPermission(Notification.permission);

        // Check whether a push subscription already exists
        navigator.serviceWorker.ready.then((reg) => {
            reg.pushManager.getSubscription().then((sub) => {
                setIsSubscribed(!!sub);
            });
        });
    }, []);

    // ── Subscribe ────────────────────────────────────────────────────────────
    const handleEnable = async () => {
        setLoading(true);
        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result !== "granted") {
                // User dismissed or denied
                toast.error("Notifications not allowed", {
                    description: "You can enable them any time in your browser settings.",
                });
                setLoading(false);
                return;
            }

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                toast.error("Configuration error", { description: "VAPID public key is missing." });
                setLoading(false);
                return;
            }

            const reg = await navigator.serviceWorker.ready;

            // Clean existing sub first
            const existing = await reg.pushManager.getSubscription();
            if (existing) await existing.unsubscribe();

            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });

            const res = await fetch("/api/notifications/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscription }),
            });

            if (!res.ok) throw new Error("Failed to save subscription on server");

            setIsSubscribed(true);
            toast.success("Device notifications enabled", {
                description: "You'll now receive real-time alerts on this device.",
            });
        } catch (err: any) {
            toast.error("Could not enable notifications", {
                description: err.message || "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    // ── Unsubscribe ──────────────────────────────────────────────────────────
    const handleDisable = async () => {
        setLoading(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
            setIsSubscribed(false);
            toast.success("Device notifications disabled");
        } catch (err: any) {
            toast.error("Could not disable notifications", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    // ── Test Push Notification ───────────────────────────────────────────────
    const handleSendTest = async () => {
        setTesting(true);
        try {
            const res = await fetch("/api/notifications/test-push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to trigger test notification");
            }
            toast.success("Test notification sent", {
                description: "You should see a push notification on this device shortly.",
            });
        } catch (err: any) {
            toast.error("Could not send test notification", {
                description: err.message || "Please try again.",
            });
        } finally {
            setTesting(false);
        }
    };

    // ── Render helpers ───────────────────────────────────────────────────────
    if (supported === null) return null; // Still detecting

    if (!supported) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell size={20} /> Device Push Notifications
                    </CardTitle>
                    <CardDescription>Real-time alerts sent directly to this device.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
                        <Info size={18} className="shrink-0" />
                        <p>Your browser doesn&apos;t support push notifications. Try a modern browser like Chrome or Edge.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell size={20} /> Device Push Notifications
                </CardTitle>
                <CardDescription>
                    Allow this device to receive real-time alerts — shifts, roster updates, and important announcements.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* ── DENIED state ── */}
                {permission === "denied" && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                            <div>
                                <p className="font-semibold text-amber-600 dark:text-amber-400">
                                    Notifications are blocked by your browser
                                </p>
                                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                                    Because you previously declined, the browser won&apos;t show the permission prompt again.
                                    You need to manually unblock notifications in your browser&apos;s site settings.
                                </p>
                            </div>
                        </div>

                        {/* Step-by-step guide */}
                        <ol className="ml-7 list-decimal space-y-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                            <li>
                                Click the <strong>🔒 lock icon</strong> (or <strong>ℹ️ info icon</strong>) in your browser&apos;s address bar.
                            </li>
                            <li>
                                Select <strong>Site settings</strong> (or <strong>Permissions</strong>).
                            </li>
                            <li>
                                Find <strong>Notifications</strong> and change it from <em>Block</em> to <strong>Allow</strong>.
                            </li>
                            <li>
                                Reload this page, then click <strong>Enable Notifications</strong> below.
                            </li>
                        </ol>

                        <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                                onClick={openBrowserSettings}
                            >
                                <ExternalLink size={14} />
                                Open Browser Settings
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    // After the user fixes settings and reloads, re-check the current state
                                    setPermission(Notification.permission);
                                    if (Notification.permission === "default") {
                                        handleEnable();
                                    } else if (Notification.permission === "granted") {
                                        toast.success("Notifications are now allowed!", {
                                            description: "Click 'Enable Notifications' to complete setup.",
                                        });
                                    }
                                }}
                            >
                                I&apos;ve updated settings — re-check
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── GRANTED + subscribed ── */}
                {permission === "granted" && isSubscribed && (
                    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={20} className="text-[hsl(var(--success))]" />
                            <div>
                                <p className="font-semibold text-[hsl(var(--success))]">Notifications active</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    This device will receive real-time alerts.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSendTest}
                                disabled={loading || testing}
                            >
                                {testing ? "Sending..." : "Send Test"}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={handleDisable}
                                disabled={loading || testing}
                            >
                                <BellOff size={14} />
                                Disable
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── GRANTED + NOT subscribed (lost subscription) ── */}
                {permission === "granted" && !isSubscribed && (
                    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
                        <div className="flex items-center gap-3">
                            <BellRing size={20} className="text-[hsl(var(--muted-foreground))]" />
                            <div>
                                <p className="font-semibold">Browser permission granted</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    Click Enable to finish subscribing this device.
                                </p>
                            </div>
                        </div>
                        <Button size="sm" className="gap-2" onClick={handleEnable} disabled={loading}>
                            <Bell size={14} />
                            {loading ? "Enabling…" : "Enable Notifications"}
                        </Button>
                    </div>
                )}

                {/* ── DEFAULT state — prompt not yet shown ── */}
                {permission === "default" && (
                    <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
                        <div className="flex items-center gap-3">
                            <BellRing size={20} className="text-[hsl(var(--muted-foreground))]" />
                            <div>
                                <p className="font-semibold">Notifications not enabled</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    Tap Enable — your browser will ask for permission.
                                </p>
                            </div>
                        </div>
                        <Button size="sm" className="gap-2" onClick={handleEnable} disabled={loading}>
                            <Bell size={14} />
                            {loading ? "Requesting…" : "Enable Notifications"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
