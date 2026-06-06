'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';

const TRIAL_DAYS = 10;

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'active' | 'trial' | 'subscription_expired' | 'trial_expired'>('loading');
    const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        let isMounted = true;

        async function checkSubscription() {
            // Do not block access to billing or pricing pages
            if (pathname === '/owner/settings/billing' || pathname.startsWith('/pricing')) {
                if (isMounted) setStatus('active');
                return;
            }

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (isMounted) setStatus('active');
                    return;
                }

                const { data: userData } = await supabase
                    .from('User')
                    .select('business_id, role')
                    .eq('user_id', user.id)
                    .single();

                if (userData?.role === 'owner' || userData?.role === 'manager') {
                    if (userData.business_id) {
                        // Check for an active subscription first
                        const { data: subData } = await supabase
                            .from('Subscriptions')
                            .select('status, current_period_end, stripe_subscription_id')
                            .eq('business_id', userData.business_id)
                            .single();

                        // If they have a subscription, validate its expiry date
                        if (subData && subData.stripe_subscription_id) {
                            const periodEndDate = subData.current_period_end ? new Date(subData.current_period_end) : null;
                            const now = new Date();

                            // Check if subscription is active AND not expired
                            if ((subData.status === 'active' || subData.status === 'trialing') && periodEndDate && periodEndDate > now) {
                                // Valid subscription — allow access
                                if (isMounted) setStatus('active');
                                return;
                            }

                            // Subscription exists but has expired
                            if (periodEndDate && periodEndDate <= now) {
                                if (isMounted) {
                                    setSubscriptionEndDate(subData.current_period_end);
                                    setStatus('subscription_expired');
                                }
                                return;
                            }
                        }

                        // No active/valid subscription — check free trial based on signup date
                        // Dev override: use trial_expired_at from user_metadata if present
                        const trialStartDate = user.user_metadata?.trial_expired_at
                            ? new Date(user.user_metadata.trial_expired_at)
                            : new Date(user.created_at);
                        const now = new Date();
                        const diffMs = now.getTime() - trialStartDate.getTime();
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const daysLeft = TRIAL_DAYS - diffDays;

                        if (daysLeft > 0) {
                            // Still in free trial
                            if (isMounted) {
                                setTrialDaysLeft(daysLeft);
                                setStatus('trial');
                            }
                            return;
                        }

                        // Trial expired and no subscription — lock out
                        if (isMounted) {
                            setStatus('trial_expired');
                        }
                        return;
                    }
                }
            } catch (err) {
                console.error('Subscription check failed:', err);
            }

            if (isMounted) setStatus('active');
        }

        checkSubscription();

        return () => {
            isMounted = false;
        };
    }, [pathname, router, supabase]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (status === 'subscription_expired') {
        return (
             <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                 <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md w-full border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Expired</h2>
                    <p className="text-gray-600 mb-2">
                        Your subscription ended on <strong>{subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'N/A'}</strong>
                    </p>
                    <p className="text-gray-500 mb-6">Please renew your subscription to continue using the platform.</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push('/pricing?subscription_expired=true')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition-colors"
                        >
                            Renew Subscription
                        </button>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                router.push('/login');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium transition-colors"
                        >
                            Switch Account
                        </button>
                    </div>
                 </div>
             </div>
        );
    }

    if (status === 'trial_expired') {
        return (
             <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                 <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md w-full border border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Free Trial Expired</h2>
                    <p className="text-gray-500 mb-6">Choose a plan below to continue using the platform.</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => router.push('/pricing?trial_expired=true')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition-colors"
                        >
                            Choose a Plan
                        </button>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                router.push('/login');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium transition-colors"
                        >
                            Switch Account
                        </button>
                    </div>
                    <div className="animate-pulse flex justify-center mt-6">
                        <div className="h-2 w-24 bg-indigo-200 rounded"></div>
                    </div>
                 </div>
             </div>
        );
    }

    // If in trial, show a banner above the children
    if (status === 'trial') {
        return (
            <>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 text-center text-sm font-medium">
                    🚀 Free trial: <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> remaining.{' '}
                    <a href="/pricing" className="underline font-semibold hover:text-indigo-200 transition-colors">
                        Upgrade now
                    </a>
                </div>
                {children}
            </>
        );
    }

    return <>{children}</>;
}
