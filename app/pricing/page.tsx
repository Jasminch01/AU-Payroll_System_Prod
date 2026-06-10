'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PricingPage() {
    const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const trialExpired = searchParams.get('trial_expired') === 'true';
    const subscriptionExpired = searchParams.get('subscription_expired') === 'true';
    const supabase = createClient();

    const handleSubscribe = async (priceId: string) => {
        setLoadingPriceId(priceId);
        setError(null);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price_id: priceId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (err: any) {
            console.error('Subscribe Error:', err);
            setError(err.message);
            setLoadingPriceId(null);
        }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await supabase.auth.signOut();
            router.push('/login');
        } catch (err: any) {
            console.error('Logout Error:', err);
            setError('Failed to logout');
            setLoggingOut(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-xl text-gray-600">
                        Everything you need to manage your business.
                    </p>
                </div>

                {trialExpired && (
                    <div className="mt-8 max-w-2xl mx-auto bg-amber-50 border border-amber-300 text-amber-800 px-6 py-4 rounded-lg">
                        <div className="text-center">
                            <p className="text-lg font-semibold">⏰ Your 10-day free trial has expired</p>
                            <p className="mt-1 text-sm">Choose a plan below to continue using the platform, or switch to another account.</p>
                        </div>
                        <div className="mt-4 flex justify-center gap-3">
                            <button
                                onClick={handleLogout}
                                disabled={loggingOut}
                                className="px-4 py-2 bg-amber-700 text-white rounded hover:bg-amber-800 disabled:opacity-50 font-medium transition-colors"
                            >
                                {loggingOut ? 'Logging out...' : 'Logout & Switch Account'}
                            </button>
                        </div>
                    </div>
                )}

                {subscriptionExpired && (
                    <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-300 text-red-800 px-6 py-4 rounded-lg">
                        <div className="text-center">
                            <p className="text-lg font-semibold">❌ Your subscription has expired</p>
                            <p className="mt-1 text-sm">Renew your subscription below to continue using the platform, or switch to another account.</p>
                        </div>
                        <div className="mt-4 flex justify-center gap-3">
                            <button
                                onClick={handleLogout}
                                disabled={loggingOut}
                                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50 font-medium transition-colors"
                            >
                                {loggingOut ? 'Logging out...' : 'Logout & Switch Account'}
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-8 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Basic Plan */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-8 flex-1">
                            <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">Basic Plan</h3>
                            <p className="mt-6 text-base text-gray-500 flex-1">
                                Perfect for small businesses just getting started with scheduling and timesheets.
                            </p>
                            <div className="mt-8">
                                <div className="flex items-center">
                                    <h4 className="flex-shrink-0 pr-4 bg-white text-sm tracking-wider font-semibold uppercase text-indigo-600">
                                        What's included
                                    </h4>
                                    <div className="flex-1 border-t-2 border-gray-200" />
                                </div>
                                <ul role="list" className="mt-8 space-y-5">
                                    {[
                                        'Up to 15 Employees',
                                        'Basic Scheduling',
                                        'Time & Attendance',
                                    ].map((feature) => (
                                        <li key={feature} className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <p className="ml-3 text-sm text-gray-700">{feature}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="py-8 px-6 text-center bg-gray-50">
                            <p className="text-lg leading-6 font-medium text-gray-900">
                                Pay monthly, cancel anytime
                            </p>
                            <div className="mt-4 flex items-center justify-center text-5xl font-extrabold text-gray-900">
                                <span>$4</span>
                                <span className="ml-3 text-xl font-medium text-gray-500">
                                    /mo
                                </span>
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || 'price_1TfAJoE7vS1S5s2nDRn6XEDq')}
                                    disabled={loadingPriceId !== null}
                                    className="w-full flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {loadingPriceId === (process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || 'price_1TfAJoE7vS1S5s2nDRn6XEDq') ? 'Redirecting...' : 'Subscribe Basic'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col border-2 border-indigo-500 relative">
                        <div className="absolute top-0 right-0 bg-indigo-500 text-white px-3 py-1 rounded-bl-lg text-sm font-medium">
                            Recommended
                        </div>
                        <div className="px-6 py-8 flex-1">
                            <h3 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">Pro Plan</h3>
                            <p className="mt-6 text-base text-gray-500 flex-1">
                                Get full access to all features, including employee management, scheduling, timesheets, and Xero payroll integration.
                            </p>
                            <div className="mt-8">
                                <div className="flex items-center">
                                    <h4 className="flex-shrink-0 pr-4 bg-white text-sm tracking-wider font-semibold uppercase text-indigo-600">
                                        What's included
                                    </h4>
                                    <div className="flex-1 border-t-2 border-gray-200" />
                                </div>
                                <ul role="list" className="mt-8 space-y-5">
                                    {[
                                        'Unlimited Employees',
                                        'Advanced Scheduling',
                                        'Time & Attendance',
                                        'Xero Payroll Sync',
                                        'Compliance Checking'
                                    ].map((feature) => (
                                        <li key={feature} className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <p className="ml-3 text-sm text-gray-700">{feature}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="py-8 px-6 text-center bg-gray-50">
                            <p className="text-lg leading-6 font-medium text-gray-900">
                                Pay monthly, cancel anytime
                            </p>
                            <div className="mt-4 flex items-center justify-center text-5xl font-extrabold text-gray-900">
                                <span>$8</span>
                                <span className="ml-3 text-xl font-medium text-gray-500">
                                    /mo
                                </span>
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_1TfAKIE7vS1S5s2nCbzmkX8E')}
                                    disabled={loadingPriceId !== null}
                                    className="w-full flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md"
                                >
                                    {loadingPriceId === (process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_1TfAKIE7vS1S5s2nCbzmkX8E') ? 'Redirecting...' : 'Subscribe Pro'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
