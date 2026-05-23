import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { verifyKioskToken } from '@/lib/kiosk-auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const kioskToken = cookieStore.get('device_kiosk_token');

        if (!kioskToken) {
            return errorResponse('Device not authorized as a Kiosk.', 403);
        }

        const kioskPayload = await verifyKioskToken(kioskToken.value);
        if (!kioskPayload) {
            return errorResponse('Invalid Kiosk token.', 403);
        }

        const supabase = createAdminClient();
        const { data: business } = await supabase
            .from('Business')
            .select('business_name, timezone')
            .eq('business_id', kioskPayload.business_id)
            .single();

        return successResponse({
            business_name: business?.business_name,
            timezone: business?.timezone || 'Australia/Sydney'
        });

    } catch (err) {
        console.error('Kiosk settings error:', err);
        return errorResponse('Internal server error', 500);
    }
}
