import { NextRequest, NextResponse } from 'next/server';
import { xero, saveXeroTokens } from '@/lib/xero';
import { errorResponse } from '@/lib/api-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/xero/callback
 * 
 * Handle Xero OAuth2 callback and store tokens
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // Current business_id

        if (!code || !state) {
            return errorResponse('Missing code or state from Xero', 400);
        }

        // 1. Exchange code for tokens
        const tokenSet = await xero.apiCallback(request.url);

        // 2. Fetch Xero Tenant ID (needed for subsequent API calls)
        const tenants = await xero.updateTenants();
        if (tenants.length === 0) {
            return errorResponse('No Xero organizations authorized', 403);
        }

        const tenantId = tenants[0].tenantId;

        // 3. Save tokens and tenantId to DB
        await saveXeroTokens(state, tokenSet);

        const supabase = createAdminClient();
        await supabase
            .from('XeroConfig')
            .update({ xero_tenant_id: tenantId })
            .eq('business_id', state);

        // 4. Redirect to owner dashboard
        // In a real app, this should redirect to /owner/xero on success
        return NextResponse.redirect(`${new URL(request.url).origin}/owner/dashboard?xero=connected`);
    } catch (err: any) {
        console.error('Xero callback error:', err);
        return errorResponse(err.message, 500);
    }
}
