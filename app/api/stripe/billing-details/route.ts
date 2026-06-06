import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/server';

/**
 * GET /api/stripe/billing-details
 * Returns the current subscription details + recent invoices from Stripe.
 */
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's business
        const { data: userData } = await supabase
            .from('User')
            .select('business_id')
            .eq('user_id', user.id)
            .single();

        if (!userData?.business_id) {
            return NextResponse.json({ error: 'No business found' }, { status: 404 });
        }

        // Get business stripe_customer_id using admin client (bypass RLS)
        const supabaseAdmin = createAdminClient();
        const { data: businessData } = await supabaseAdmin
            .from('Business')
            .select('stripe_customer_id, business_name')
            .eq('business_id', userData.business_id)
            .single();

        if (!businessData?.stripe_customer_id) {
            // No Stripe customer yet — return trial info
            return NextResponse.json({
                status: 'trial',
                plan: null,
                invoices: [],
                next_renewal: null,
                trial_start: user.created_at,
            });
        }

        const customerId = businessData.stripe_customer_id;

        // Fetch active subscriptions from Stripe
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 1,
            expand: ['data.default_payment_method', 'data.items.data.price'],
        });

        // Fetch recent invoices
        const invoices = await stripe.invoices.list({
            customer: customerId,
            limit: 5,
        });

        const activeSub = subscriptions.data[0] || null;

        let planName = 'Unknown Plan';
        let planAmount = 0;
        let planInterval = 'month';

        if (activeSub) {
            const priceItem = activeSub.items.data[0];
            // Use price ID as plan name since product expansion would exceed 4 levels
            planName = priceItem?.price?.id || 'Unknown Plan';
            planAmount = priceItem?.price?.unit_amount || 0;
            planInterval = priceItem?.price?.recurring?.interval || 'month';
        }

        const paymentMethod = activeSub?.default_payment_method;
        let cardInfo = null;
        if (paymentMethod && typeof paymentMethod === 'object' && 'card' in paymentMethod) {
            const card = (paymentMethod as any).card;
            cardInfo = {
                brand: card.brand,
                last4: card.last4,
                exp_month: card.exp_month,
                exp_year: card.exp_year,
            };
        }

        return NextResponse.json({
            status: activeSub?.status || 'none',
            plan: {
                name: planName,
                amount: planAmount / 100, // Convert cents to dollars
                interval: planInterval,
                price_id: activeSub?.items?.data?.[0]?.price?.id || null,
            },
            card: cardInfo,
            current_period_end: activeSub ? new Date((activeSub as any).current_period_end * 1000).toISOString() : null,
            current_period_start: activeSub ? new Date((activeSub as any).current_period_start * 1000).toISOString() : null,
            cancel_at_period_end: activeSub?.cancel_at_period_end || false,
            invoices: invoices.data.map((inv) => ({
                id: inv.id,
                number: inv.number,
                amount_paid: (inv.amount_paid || 0) / 100,
                currency: inv.currency,
                status: inv.status,
                created: new Date(inv.created * 1000).toISOString(),
                invoice_pdf: inv.invoice_pdf,
                hosted_invoice_url: inv.hosted_invoice_url,
            })),
        });

    } catch (error: any) {
        console.error('Billing Details Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
