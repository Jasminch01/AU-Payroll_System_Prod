import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        // 1. Get current authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Find the user's business
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('business_id')
            .eq('user_id', user.id)
            .single();

        if (userError || !userData) {
            return NextResponse.json({ error: 'User business not found' }, { status: 404 });
        }

        const businessId = userData.business_id;
        console.log(`[Stripe Portal] User ${user.id} requesting portal for business ${businessId}`);

        const supabaseAdmin = createAdminClient();

        // 3. Get the stripe_customer_id from the Business table
        const { data: businessData, error: businessError } = await supabaseAdmin
            .from('Business')
            .select('stripe_customer_id')
            .eq('business_id', businessId)
            .single();

        if (businessError) {
            console.error(`[Stripe Portal] Error fetching business ${businessId}:`, businessError);
            return NextResponse.json({ error: `Error fetching business: ${businessError.message}` }, { status: 404 });
        }

        if (!businessData) {
            console.error(`[Stripe Portal] Business not found: ${businessId}`);
            return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
        }

        if (!businessData.stripe_customer_id) {
            console.error(`[Stripe Portal] Business ${businessId} has no stripe_customer_id (stripe_customer_id is null)`);
            return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 400 });
        }

        console.log(`[Stripe Portal] Business ${businessId} has stripe_customer_id: ${businessData.stripe_customer_id}`);

        // 4. Create Stripe Customer Portal Session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: businessData.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/owner/settings/billing`,
        });

        return NextResponse.json({ portal_url: portalSession.url });

    } catch (error: any) {
        console.error('Stripe Portal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
