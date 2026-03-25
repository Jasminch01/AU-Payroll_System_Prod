'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

function XeroStatusContent() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const msg = searchParams.get('msg');
    
    const isError = status === 'error';

    useEffect(() => {
        // Notify the main window if this was a popup
        if (window.opener) {
            const message = isError ? 'xero-error' : 'xero-connected';
            window.opener.postMessage({ type: message, msg }, window.location.origin);
            
            // Auto close on success
            if (!isError) {
                const timer = setTimeout(() => {
                    window.close();
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [isError, msg]);

    return (
        <div className="flex h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4 font-sans">
            <div className="flex flex-col items-center gap-6 rounded-3xl bg-[hsl(var(--card))] p-10 shadow-2xl text-center max-w-md border border-[hsl(var(--border))]">
                {isError ? (
                    <>
                        <div className="rounded-full bg-red-100 p-4">
                            <XCircle className="h-16 w-16 text-red-600" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-[hsl(var(--foreground))]">Connection Failed</h1>
                        <p className="text-[hsl(var(--muted-foreground))] font-medium leading-relaxed">
                            {msg || 'Something went wrong while connecting to Xero.'}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="rounded-full bg-green-100 p-4">
                            <CheckCircle className="h-16 w-16 text-green-600" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-[hsl(var(--foreground))]">Xero Connected!</h1>
                        <p className="text-[hsl(var(--muted-foreground))] font-medium leading-relaxed">
                            Your Xero account has been successfully linked. You can now sync employees and payroll data.
                        </p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] opacity-70">
                            This window will close automatically.
                        </p>
                    </>
                )}
                
                <button 
                    onClick={() => window.close()}
                    className="mt-4 w-full rounded-xl bg-[hsl(var(--primary))] px-6 py-4 text-[hsl(var(--primary-foreground))] font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                >
                    Close Window
                </button>
            </div>
        </div>
    );
}

export default function XeroSuccessPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <XeroStatusContent />
        </Suspense>
    );
}
