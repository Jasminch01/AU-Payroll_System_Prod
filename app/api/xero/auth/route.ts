import { NextRequest, NextResponse } from 'next/server';
import { xero } from '@/lib/xero';
import { requireRole } from '@/lib/auth';
import { errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/xero/auth
 * 
 * Initiate Xero OAuth2 flow
 * Access: Owner
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        // Build the consent URL
        const consentUrl = await xero.buildConsentUrl();

        // Pass business_id in the state for the callback to handle
        const statefulConsentUrl = `${consentUrl}&state=${authUser.business_id}`;

        return NextResponse.redirect(statefulConsentUrl);
    } catch (err: any) {
        console.error('Xero auth error:', err);
        return errorResponse(err.message, 500);
    }
}
