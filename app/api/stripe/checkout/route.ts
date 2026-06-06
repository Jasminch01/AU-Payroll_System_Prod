import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    try {
        const { price_id } = await request.json();

        if (!price_id) {
            return NextResponse.json({ error: 'Missing price_id' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Find the user's business
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('business_id, first_name, last_name')
            .eq('user_id', user.id)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User business not found' }, { status: 404 });
        }

        const businessId = userData.business_id;

        const supabaseAdmin = createAdminClient();

        // 3. Check if business already has a stripe_customer_id
        const { data: businessData, error: businessError } = await supabaseAdmin
            .from('Business')
            .select('stripe_customer_id, business_name')
            .eq('business_id', businessId)
            .single();

        if (businessError || !businessData) {
            console.error("Admin query failed for Business:", businessError);
            return NextResponse.json({ error: `Business not found. Details: ${businessError?.message || 'No row'}` }, { status: 404 });
        }

        let stripeCustomerId = businessData.stripe_customer_id;

        // 4. Create Stripe Customer if missing
        if (!stripeCustomerId) {
            console.log(`[Stripe Checkout] Creating Stripe customer for business ${businessId}`);
            const customer = await stripe.customers.create({
                email: user.email,
                name: businessData.business_name || `${userData.first_name} ${userData.last_name}`,
                metadata: {
                    business_id: businessId,
                },
            });

            stripeCustomerId = customer.id;
            console.log(`[Stripe Checkout] Created Stripe customer: ${stripeCustomerId}`);

            // Update business record with new Stripe Customer ID using admin client
            const { error: updateError } = await supabaseAdmin
                .from('Business')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('business_id', businessId);
            
            if (updateError) {
                console.error(`[Stripe Checkout] Failed to update Business with stripe_customer_id:`, updateError);
                return NextResponse.json(
                    { error: `Failed to save Stripe customer ID: ${updateError.message}` },
                    { status: 500 }
                );
            }
            console.log(`[Stripe Checkout] Successfully updated Business ${businessId} with stripe_customer_id ${stripeCustomerId}`);
        } else {
            console.log(`[Stripe Checkout] Business ${businessId} already has stripe_customer_id: ${stripeCustomerId}`);
        }

        // 5. Create Stripe Checkout Session
        console.log(`[Stripe Checkout] Creating checkout session for business ${businessId}, price_id ${price_id}, customer ${stripeCustomerId}`);
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {
                    price: price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            allow_promotion_codes: true,
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/owner/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
            metadata: {
                business_id: businessId,
            },
        });

        console.log(`[Stripe Checkout] Successfully created checkout session: ${session.id}, URL: ${session.url}`);
        return NextResponse.json({ checkout_url: session.url });

    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
