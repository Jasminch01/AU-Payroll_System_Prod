import React from 'react';
import { SubscriptionGuard } from './SubscriptionGuard';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <SubscriptionGuard>
            {children}
        </SubscriptionGuard>
    );
}
