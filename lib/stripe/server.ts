import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2024-04-10' as any, // Bypass TS version mismatch
    appInfo: {
        name: 'Australia Payroll System',
        version: '0.1.0',
    },
});
