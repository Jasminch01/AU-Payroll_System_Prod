'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';

// const TRIAL_DAYS = 10;

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'active' | 'trial' | 'subscription_expired' | 'trial_expired' | 'unauthorized'>('loading');
    const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
    const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        let isMounted = true;

        async function checkSubscription() {
            // Allow access to billing and pricing pages without checks
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

                const { data: userData, error: userError } = await supabase
                    .from('User')
                    .select('business_id, role')
                    .eq('user_id', user.id)
                    .maybeSingle();

                console.log('[SubscriptionGuard] userData:', userData, 'error:', userError);

                // 1. Verify Role Access First
                if (!userData || (userData.role !== 'owner' && userData.role !== 'manager')) {
                    console.log('[SubscriptionGuard] ❌ Unauthorized role:', userData?.role);
                    if (isMounted) setStatus('unauthorized');
                    return;
                }

                // 2. Verify Business ID exists
                if (!userData.business_id) {
                    console.log('[SubscriptionGuard] ❌ No business_id assigned to user');
                    if (isMounted) setStatus('unauthorized');
                    return;
                }

                // --- SUBSCRIPTION CHECK FUNCTIONALITIES DISABLED INDEFINITELY ---
                // We bypass checking the Subscriptions table and trial expiration checks.
                // Any authenticated user with a valid role (owner/manager) and business_id gets full active access.
                if (isMounted) setStatus('active');
                return;

                /*
                // 3. Check for active subscription (Fixed duplicate rows issue here)
                const { data: subData, error: subError } = await supabase
                    .from('Subscriptions')
                    .select('status, current_period_end, stripe_subscription_id')
                    .eq('business_id', userData.business_id)
                    .order('created_at', { ascending: false }) // 👈 Grab the newest entry
                    .limit(1)                                  // 👈 Enforce 1 row constraint
                    .maybeSingle();

                console.log('[SubscriptionGuard] subData:', subData, 'error:', subError);

                if (subData && subData.stripe_subscription_id) {
                    const periodEndDate = subData.current_period_end ? new Date(subData.current_period_end) : null;
                    const now = new Date();

                    if ((subData.status === 'active' || subData.status === 'trialing') && periodEndDate && periodEndDate > now) {
                        console.log('[SubscriptionGuard] ✅ Active subscription found');
                        if (isMounted) setStatus('active');
                        return;
                    }

                    if (periodEndDate && periodEndDate <= now) {
                        console.log('[SubscriptionGuard] ❌ Subscription expired');
                        if (isMounted) {
                            setSubscriptionEndDate(subData.current_period_end);
                            setStatus('subscription_expired');
                        }
                        return;
                    }
                }

                // 4. Fallback: No valid subscription found — check free trial
                console.log('[SubscriptionGuard] No active subscription found, checking trial...');
                const trialStartDate = user.user_metadata?.trial_expired_at
                    ? new Date(user.user_metadata.trial_expired_at)
                    : new Date(user.created_at);
                const now = new Date();
                const diffMs = now.getTime() - trialStartDate.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const daysLeft = TRIAL_DAYS - diffDays;

                console.log('[SubscriptionGuard] Trial days left:', daysLeft);

                if (daysLeft > 0) {
                    if (isMounted) {
                        setTrialDaysLeft(daysLeft);
                        setStatus('trial');
                    }
                    return;
                }

                if (isMounted) setStatus('trial_expired');
                return;
                */

            } catch (err) {
                console.error('[SubscriptionGuard] Check failed:', err);
                if (isMounted) setStatus('unauthorized'); // Block access if an error breaks the check
            }
        }

        checkSubscription();

        return () => { isMounted = false; };
    }, [pathname, router, supabase]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (status === 'unauthorized') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="text-center bg-white p-8 rounded-lg shadow-sm max-w-md w-full border border-gray-100">
                    <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-6">You do not have the required permissions to access this dashboard.</p>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 font-medium transition-colors w-full"
                    >
                        Sign Out / Switch Account
                    </button>
                </div>
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
                </div>
            </div>
        );
    }

    if (status === 'trial') {
        return (
            <>
                <div className="bg-linear-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 text-center text-sm font-medium">
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
