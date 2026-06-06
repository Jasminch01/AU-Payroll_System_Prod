import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        // Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { priceId } = await request.json();

        if (!priceId) {
            return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
        }

        // Get user's business
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('business_id')
            .eq('user_id', user.id)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User business not found' }, { status: 404 });
        }

        const businessId = userData.business_id;

        // Get or create Stripe customer
        const supabaseAdmin = createAdminClient();
        const { data: businessData, error: businessError } = await supabaseAdmin
            .from('Business')
            .select('stripe_customer_id')
            .eq('business_id', businessId)
            .single();

        if (businessError) {
            return NextResponse.json({ error: 'Error fetching business' }, { status: 404 });
        }

        let customerId = businessData?.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                metadata: {
                    business_id: businessId,
                },
            });
            customerId = customer.id;

            // Update business with Stripe customer ID
            await supabaseAdmin
                .from('Business')
                .update({ stripe_customer_id: customerId })
                .eq('business_id', businessId);
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
        });

        return NextResponse.json({ session_id: session.id, url: session.url });

    } catch (error: any) {
        console.error('Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
