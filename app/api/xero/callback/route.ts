import { NextRequest, NextResponse } from 'next/server';
import { getXero, saveXeroTokens, resetXeroInstance } from '@/lib/xero';
import { errorResponse } from '@/lib/api-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;

    try {
        // Read business_id from cookie (set during /auth)
        const businessId = request.cookies.get('xero_business_id')?.value;

        if (!businessId) {
            return NextResponse.redirect(
                `${origin}/owner/dashboard?xero=error&msg=Session+expired.+Please+try+again.`
            );
        }

        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        // If Xero returned an error (e.g. user denied access)
        if (errorParam) {
            const errorDesc = searchParams.get('error_description') || errorParam;
            resetXeroInstance(); // Clean up since auth failed
            return NextResponse.redirect(
                `${origin}/owner/dashboard?xero=error&msg=${encodeURIComponent(errorDesc)}`
            );
        }

        if (!code) {
            resetXeroInstance();
            return NextResponse.redirect(
                `${origin}/owner/dashboard?xero=error&msg=Missing+authorization+code+from+Xero`
            );
        }

        // Use the SAME singleton that built the consent URL
        const xero = getXero();

        // Exchange the authorization code for tokens
        const tokenSet = await xero.apiCallback(request.url);

        // Fetch connected tenants (organizations)
        const tenants = await xero.updateTenants();

        if (!tenants || tenants.length === 0) {
            resetXeroInstance();
            return NextResponse.redirect(
                `${origin}/owner/dashboard?xero=error&msg=No+Xero+organization+authorized.+Please+reconnect+and+select+an+organization.`
            );
        }

        const tenantId = tenants[0].tenantId;

        // Save tokens and tenant ID to database in one go
        await saveXeroTokens(businessId, tokenSet, tenantId);


        // Auth cycle complete — reset for next time
        resetXeroInstance();

        // ✅ Redirect to the success page inside the popup
        const response = NextResponse.redirect(`${origin}/api/xero/success`);
        response.cookies.delete('xero_business_id');
        return response;

    } catch (err: any) {
        console.error('Xero callback error:', err?.message || err);
        resetXeroInstance();
        // Redirect to success page with error status to handle inside popup
        return NextResponse.redirect(
            `${origin}/api/xero/success?status=error&msg=${encodeURIComponent(err?.message || 'Xero connection failed')}`
        );
    }
}