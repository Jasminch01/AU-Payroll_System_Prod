import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { disconnectXero } from '@/lib/xero';

/**
 * GET /api/xero/status
 * 
 * Check if the business has a connected Xero account
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = createAdminClient();
        const { data: config, error } = await supabase
            .from('XeroConfig')
            .select('connected_at, updated_at')
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !config) {
            return successResponse({ connected: false });
        }

        return successResponse({
            connected: true,
            connected_at: config.connected_at,
            updated_at: config.updated_at
        });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/xero/disconnect
 * 
 * Disconnect Xero for the business
 * Access: Owner
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        await disconnectXero(authUser.business_id);

        return successResponse(null, 'Xero disconnected successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
