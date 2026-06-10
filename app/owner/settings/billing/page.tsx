'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileText, Calendar, ArrowUpRight, Download, RefreshCw, Shield } from 'lucide-react';

interface BillingData {
    status: string;
    plan: {
        name: string;
        amount: number;
        interval: string;
        price_id: string;
    } | null;
    card: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
    } | null;
    current_period_end: string | null;
    current_period_start: string | null;
    cancel_at_period_end: boolean;
    invoices: {
        id: string;
        number: string;
        amount_paid: number;
        currency: string;
        status: string;
        created: string;
        invoice_pdf: string | null;
        hosted_invoice_url: string | null;
    }[];
    trial_start?: string;
}

export default function BillingSettingsPage() {
    const [billing, setBilling] = useState<BillingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        async function fetchBilling() {
            try {
                const res = await fetch('/api/stripe/billing-details');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                setBilling(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchBilling();
    }, []);

    const handleManageSubscription = async () => {
        setPortalLoading(true);
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.portal_url) window.location.href = data.portal_url;
        } catch (err: any) {
            setError(err.message);
            setPortalLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number, currency: string = 'usd') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            trialing: 'bg-blue-50 text-blue-700 border-blue-200',
            past_due: 'bg-amber-50 text-amber-700 border-amber-200',
            canceled: 'bg-red-50 text-red-700 border-red-200',
            trial: 'bg-violet-50 text-violet-700 border-violet-200',
            paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            open: 'bg-amber-50 text-amber-700 border-amber-200',
            draft: 'bg-gray-50 text-gray-700 border-gray-200',
        };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </span>
        );
    };

    const getCardBrandIcon = (brand: string) => {
        const icons: Record<string, string> = {
            visa: '💳 Visa',
            mastercard: '💳 Mastercard',
            amex: '💳 Amex',
        };
        return icons[brand.toLowerCase()] || `💳 ${brand}`;
    };

    if (loading) {
        return (
            <DashboardLayout role="owner" pageTitle="Billing" pageDescription="Manage your subscription and payments">
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    const isActive = billing?.status === 'active' || billing?.status === 'trialing';
    const isTrial = billing?.status === 'trial';

    return (
        <DashboardLayout role="owner" pageTitle="Billing" pageDescription="Manage your subscription and payments">
            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <strong className="font-bold">Error: </strong>{error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Current Plan Card */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Shield size={20} className="text-indigo-600" />
                            Current Plan
                        </CardTitle>
                        {billing?.status && getStatusBadge(billing.status)}
                    </CardHeader>
                    <CardContent>
                        {isTrial ? (
                            <div className="py-4">
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">Free Trial</h3>
                                <p className="text-gray-500 text-sm mb-6">
                                    You're currently on a free 10-day trial. Upgrade to keep access to all features.
                                </p>
                                <Button onClick={() => router.push('/pricing')}>
                                    <ArrowUpRight size={16} /> View Plans & Upgrade
                                </Button>
                            </div>
                        ) : billing?.plan ? (
                            <div className="py-4">
                                <div className="flex items-baseline gap-3 mb-1">
                                    <h3 className="text-2xl font-bold text-gray-900">{billing.plan.name}</h3>
                                </div>
                                <p className="text-3xl font-extrabold text-indigo-600 mb-1">
                                    {formatCurrency(billing.plan.amount)}
                                    <span className="text-base font-medium text-gray-400 ml-1">/{billing.plan.interval}</span>
                                </p>

                                {billing.cancel_at_period_end && (
                                    <p className="text-sm text-amber-600 font-medium mt-2">
                                        ⚠️ Your subscription will cancel at the end of the current billing period.
                                    </p>
                                )}

                                <div className="mt-6 flex flex-wrap gap-3">
                                    <Button onClick={handleManageSubscription} disabled={portalLoading}>
                                        <CreditCard size={16} />
                                        {portalLoading ? 'Redirecting...' : 'Manage Subscription'}
                                    </Button>
                                    <Button variant="outline" onClick={() => router.push('/pricing')}>
                                        <ArrowUpRight size={16} /> Change Plan
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-4">
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">No Active Subscription</h3>
                                <p className="text-gray-500 text-sm mb-6">Choose a plan to get started.</p>
                                <Button onClick={() => router.push('/pricing')}>
                                    <ArrowUpRight size={16} /> View Plans
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Billing Info Sidebar */}
                <div className="space-y-6">
                    {/* Next Renewal */}
                    {billing?.current_period_end && isActive && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                    <Calendar size={16} />
                                    {billing.cancel_at_period_end ? 'Access Until' : 'Next Renewal'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xl font-bold text-gray-900">
                                    {formatDate(billing.current_period_end)}
                                </p>
                                {billing.current_period_start && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Billing period started {formatDate(billing.current_period_start)}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment Method */}
                    {billing?.card && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                    <CreditCard size={16} />
                                    Payment Method
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-semibold text-gray-900">
                                    {getCardBrandIcon(billing.card.brand)} •••• {billing.card.last4}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Expires {String(billing.card.exp_month).padStart(2, '0')}/{billing.card.exp_year}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Invoice History */}
            {billing?.invoices && billing.invoices.length > 0 && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <FileText size={20} className="text-indigo-600" />
                            Invoice History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="text-left py-3 px-6 font-medium text-gray-500">Invoice</th>
                                        <th className="text-left py-3 px-6 font-medium text-gray-500">Date</th>
                                        <th className="text-left py-3 px-6 font-medium text-gray-500">Amount</th>
                                        <th className="text-left py-3 px-6 font-medium text-gray-500">Status</th>
                                        <th className="text-right py-3 px-6 font-medium text-gray-500">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {billing.invoices.map((inv) => (
                                        <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="py-3 px-6 font-medium text-gray-900">
                                                {inv.number || inv.id.slice(0, 12)}
                                            </td>
                                            <td className="py-3 px-6 text-gray-500">
                                                {formatDate(inv.created)}
                                            </td>
                                            <td className="py-3 px-6 font-semibold text-gray-900">
                                                {formatCurrency(inv.amount_paid, inv.currency)}
                                            </td>
                                            <td className="py-3 px-6">
                                                {getStatusBadge(inv.status || 'unknown')}
                                            </td>
                                            <td className="py-3 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {inv.hosted_invoice_url && (
                                                        <a
                                                            href={inv.hosted_invoice_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-indigo-600 hover:text-indigo-800 transition-colors text-xs font-medium"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                    {inv.invoice_pdf && (
                                                        <a
                                                            href={inv.invoice_pdf}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                                                            title="Download PDF"
                                                        >
                                                            <Download size={14} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </DashboardLayout>
    );
}
