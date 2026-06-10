import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    console.log('[Stripe Webhook] Received webhook event');

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
        console.log(`[Stripe Webhook] Event verified: ${event.type}`);
    } catch (error: any) {
        console.error('[Stripe Webhook] Signature verification failed:', error.message);
        return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    try {
        switch (event.type) {

            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log(`[Stripe Webhook] checkout.session.completed: ${session.id}`);

                const businessId = session.metadata?.business_id;
                console.log(`[Stripe Webhook] Business ID from metadata: ${businessId}`);

                if (!businessId) {
                    console.warn(`[Stripe Webhook] No business_id in metadata`);
                    break;
                }

                // Save stripe_customer_id to Business table
                if (session.customer) {
                    const { error: customerError } = await supabaseAdmin
                        .from('Business')
                        .update({ stripe_customer_id: session.customer as string })
                        .eq('business_id', businessId);  // ← correct PK

                    if (customerError) {
                        console.error('[Stripe Webhook] Error saving stripe_customer_id:', JSON.stringify(customerError));
                    } else {
                        console.log(`[Stripe Webhook] Saved stripe_customer_id: ${session.customer}`);
                    }
                }

                // Upsert subscription
                if (session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                    await upsertSubscription(supabaseAdmin, businessId, subscription);
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                console.log(`[Stripe Webhook] ${event.type}: ${subscription.id}`);
                console.log(`[Stripe Webhook] Looking up business for customer: ${customerId}`);

                const { data: businessData, error: businessError } = await supabaseAdmin
                    .from('Business')
                    .select('business_id')           // ← correct PK
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (businessError || !businessData) {
                    console.error(`[Stripe Webhook] Business not found for customer ${customerId}:`, businessError?.message);
                    break;
                }

                console.log(`[Stripe Webhook] Found business: ${businessData.business_id}`);
                await upsertSubscription(supabaseAdmin, businessData.business_id, subscription);
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }
    } catch (error: any) {
        console.error('[Stripe Webhook] Unexpected error:', error);
    }

    return NextResponse.json({ received: true });
}

async function upsertSubscription(
    supabaseAdmin: any,
    businessId: string,
    subscription: Stripe.Subscription
) {
    const periodEnd =
        (subscription as any).current_period_end ??
        (subscription as any).items?.data?.[0]?.current_period_end ??
        null;

    console.log(`[Stripe Webhook] current_period_end raw value: ${periodEnd}`);

    const subscriptionData = {
        business_id:            businessId,
        stripe_subscription_id: subscription.id,
        status:                 subscription.status,
        current_period_end:     periodEnd
                                    ? new Date(periodEnd * 1000).toISOString()
                                    : null,
    };

    console.log(`[Stripe Webhook] Upserting:`, JSON.stringify(subscriptionData));

 const { error } = await supabaseAdmin
        .from('Subscriptions')
        .upsert(subscriptionData, { onConflict: 'business_id' });

    if (error) {
        console.error('[Stripe Webhook] Upsert error:', JSON.stringify(error));
        return false;
    }

    console.log(`[Stripe Webhook] ✅ Subscription upserted: ${subscription.id} | status: ${subscription.status}`);
    return true;
}