/**
 * Debug script to verify subscription and customer ID flow
 * Run this to check current state of Business and Subscriptions tables
 * 
 * Usage: npx ts-node debug_subscription_flow.ts
 */

import { createAdminClient } from './lib/supabase/admin';

async function debugSubscriptionFlow() {
    const supabase = createAdminClient();
    
    console.log('\n========== SUBSCRIPTION DEBUG FLOW ==========\n');

    try {
        // 1. Fetch all businesses with their stripe_customer_id
        console.log('📋 FETCHING ALL BUSINESSES...\n');
        const { data: businesses, error: businessesError } = await supabase
            .from('Business')
            .select('business_id, business_name, stripe_customer_id, created_at');

        if (businessesError) {
            console.error('❌ Error fetching businesses:', businessesError.message);
            return;
        }

        if (!businesses || businesses.length === 0) {
            console.log('⚠️  No businesses found in database.');
            return;
        }

        console.log(`✅ Found ${businesses.length} business(es):\n`);
        businesses.forEach((biz: any) => {
            console.log(`  ID: ${biz.business_id}`);
            console.log(`  Name: ${biz.business_name}`);
            console.log(`  Stripe Customer ID: ${biz.stripe_customer_id || '❌ NULL (NOT SET)'}`);
            console.log(`  Created: ${biz.created_at}`);
            console.log('');
        });

        // 2. Fetch all subscriptions
        console.log('📋 FETCHING ALL SUBSCRIPTIONS...\n');
        const { data: subscriptions, error: subsError } = await supabase
            .from('Subscriptions')
            .select('id, business_id, stripe_subscription_id, status, price_id, current_period_end, created_at');

        if (subsError) {
            console.error('❌ Error fetching subscriptions:', subsError.message);
            return;
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('⚠️  No subscriptions found in database.');
        } else {
            console.log(`✅ Found ${subscriptions.length} subscription(s):\n`);
            subscriptions.forEach((sub: any) => {
                console.log(`  ID: ${sub.id}`);
                console.log(`  Business ID: ${sub.business_id}`);
                console.log(`  Stripe Subscription ID: ${sub.stripe_subscription_id}`);
                console.log(`  Status: ${sub.status}`);
                console.log(`  Price ID: ${sub.price_id}`);
                console.log(`  Current Period End: ${sub.current_period_end}`);
                console.log(`  Created: ${sub.created_at}`);
                console.log('');
            });
        }

        // 3. Cross-check: match businesses with subscriptions
        console.log('🔍 CROSS-CHECK: MATCHING BUSINESSES WITH SUBSCRIPTIONS\n');
        businesses.forEach((biz: any) => {
            const hasCustId = !!biz.stripe_customer_id;
            const matchingSubs = subscriptions?.filter((sub: any) => sub.business_id === biz.business_id) || [];
            
            console.log(`📌 Business: ${biz.business_name} (${biz.business_id})`);
            console.log(`   - Has Stripe Customer ID: ${hasCustId ? '✅ YES' : '❌ NO'}`);
            console.log(`   - Subscriptions: ${matchingSubs.length > 0 ? '✅ ' + matchingSubs.length + ' found' : '❌ NONE'}`);
            
            if (!hasCustId && matchingSubs.length === 0) {
                console.log(`   ⚠️  ISSUE: No customer ID AND no subscriptions!`);
            } else if (!hasCustId && matchingSubs.length > 0) {
                console.log(`   ⚠️  ISSUE: Has subscriptions but no customer ID!`);
            } else if (hasCustId && matchingSubs.length === 0) {
                console.log(`   ⚠️  WARNING: Has customer ID but no active subscriptions.`);
            } else {
                console.log(`   ✅ OK: Customer ID and subscriptions present.`);
            }
            console.log('');
        });

        // 4. Summary
        console.log('📊 SUMMARY:\n');
        const withCustId = businesses.filter((b: any) => b.stripe_customer_id).length;
        const withSubs = subscriptions?.length || 0;
        
        console.log(`  Total Businesses: ${businesses.length}`);
        console.log(`  With Stripe Customer ID: ${withCustId} (${Math.round(withCustId / businesses.length * 100)}%)`);
        console.log(`  Total Subscriptions: ${withSubs}`);
        
        if (withCustId === 0) {
            console.log('\n❌ NO BUSINESSES HAVE STRIPE CUSTOMER IDs!');
            console.log('   → Checkout route may not be completing successfully');
            console.log('   → Check server logs for "[Stripe Checkout]" messages');
        }
        
        if (withSubs === 0) {
            console.log('\n❌ NO SUBSCRIPTIONS IN DATABASE!');
            console.log('   → Webhook may not be receiving events from Stripe');
            console.log('   → Check Stripe Dashboard → Webhooks → Event delivery logs');
        }

        console.log('\n========================================\n');

    } catch (err: any) {
        console.error('❌ Fatal error:', err.message);
        process.exit(1);
    }
}

debugSubscriptionFlow();
