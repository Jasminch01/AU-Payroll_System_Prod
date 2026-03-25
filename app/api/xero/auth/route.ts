import { NextRequest, NextResponse } from 'next/server';
import { getXero } from '@/lib/xero';
import { requireRole } from '@/lib/auth';
import { errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
            return errorResponse('Xero configuration missing on server', 500);
        }

        const xero = getXero();
        const consentUrl = await xero.buildConsentUrl();

        if (!consentUrl) {
            return errorResponse('Failed to generate Xero consent URL', 500);
        }

        // Store business_id in a secure cookie for the callback to use
        const response = NextResponse.redirect(consentUrl);

        response.cookies.set('xero_business_id', authUser.business_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10, // 10 minutes
            path: '/',
        });

        return response;
    } catch (err: any) {
        console.error('Xero auth error:', err);
        return errorResponse(err.message || 'Xero Authentication Failed', 500);
    }
}