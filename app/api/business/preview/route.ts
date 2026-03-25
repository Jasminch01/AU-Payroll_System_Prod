import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/business/preview?code=...
 * 
 * Fetches basic business info for display on the join/onboarding page.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) return errorResponse('Missing join code', 400);

        const supabase = await createClient();

        // In MVP, we just return the first business or match by ID if code is an ID
        // For now, let's just grab the business name of the first business
        // In prod, this would be: .from('Business').select('business_name').eq('invite_code', code).single();
        
        const { data: business, error } = await supabase
            .from('Business')
            .select('business_name')
            .limit(1)
            .single();

        if (error || !business) {
            return errorResponse('Business not found', 404);
        }

        return successResponse(business);
    } catch (error: any) {
        return errorResponse(error.message, 500);
    }
}
