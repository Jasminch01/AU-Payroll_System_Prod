import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    console.log('[Stripe Webhook] Received webhook event');
    console.log(`[Stripe Webhook] Signature: ${signature?.substring(0, 20)}...`);

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
        console.log(`[Stripe Webhook] Event verified and constructed: ${event.type}`);
    } catch (error: any) {
        console.error('[Stripe Webhook] Signature verification failed:', error.message);
        console.error('[Stripe Webhook] Webhook Secret:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 20) + '...');
        return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                try {
                    const session = event.data.object as Stripe.Checkout.Session;
                    console.log(`[Stripe Webhook] checkout.session.completed: ${session.id}`);

                    // Retrieve subscription details
                    if (session.subscription) {
                        const subscriptionId = session.subscription as string;
                        console.log(`[Stripe Webhook] Retrieving subscription: ${subscriptionId}`);
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        
                        const businessId = session.metadata?.business_id;
                        console.log(`[Stripe Webhook] Business ID from metadata: ${businessId}`);

                        if (businessId) {
                            await upsertSubscription(supabaseAdmin, businessId, subscription);
                        } else {
                            console.warn(`[Stripe Webhook] No business_id found in checkout session metadata`);
                        }
                    } else {
                        console.warn(`[Stripe Webhook] No subscription found in checkout session`);
                    }
                } catch (caseError: any) {
                    console.error('[Stripe Webhook] Error handling checkout.session.completed:', caseError.message);
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                try {
                    const subscription = event.data.object as Stripe.Subscription;
                    console.log(`[Stripe Webhook] ${event.type}: ${subscription.id}`);
                    
                    // We need to find the business_id associated with this customer
                    const customerId = subscription.customer as string;
                    console.log(`[Stripe Webhook] Looking up business for Stripe customer: ${customerId}`);
                    
                    const { data: businessData, error: businessError } = await supabaseAdmin
                        .from('Business')
                        .select('business_id')
                        .eq('stripe_customer_id', customerId)
                        .single();

                    if (businessError) {
                        console.error(`[Stripe Webhook] Error looking up business: ${businessError.message}`);
                        break;
                    }

                    if (!businessData) {
                        console.error(`[Stripe Webhook] Business not found for Stripe Customer ID: ${customerId}`);
                        break;
                    }

                    console.log(`[Stripe Webhook] Found business: ${businessData.business_id}`);
                    await upsertSubscription(supabaseAdmin, businessData.business_id, subscription);
                } catch (caseError: any) {
                    console.error(`[Stripe Webhook] Error handling ${event.type}:`, caseError.message);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error: any) {
        console.error('[Stripe Webhook] Unexpected error in webhook handler:', error);
    }

    // Always return 200 OK to acknowledge receipt, even if there were errors
    // (Stripe will retry on 5xx errors, but our errors are typically not retryable)
    return NextResponse.json({ received: true });
}

async function upsertSubscription(supabaseAdmin: any, businessId: string, subscription: Stripe.Subscription) {
    const subscriptionData = {
        business_id: businessId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        price_id: (subscription as any).items?.data?.[0]?.price?.id || null,
        current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    };

    console.log(`[Stripe Webhook] Upserting subscription data:`, subscriptionData);

    try {
        const { error } = await supabaseAdmin
            .from('Subscriptions')
            .upsert(subscriptionData, { onConflict: 'stripe_subscription_id' });

        if (error) {
            console.error('[Stripe Webhook] Error upserting subscription:', error);
            return false;
        }

        console.log(`[Stripe Webhook] Successfully upserted subscription ${subscription.id} for business ${businessId}`);
        return true;
    } catch (err: any) {
        console.error('[Stripe Webhook] Exception upserting subscription:', err.message);
        return false;
    }
}
