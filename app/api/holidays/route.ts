import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { PublicHolidayInsert } from '@/types/database';

/**
 * GET /api/holidays
 * 
 * List public holidays for the business
 * Access: Authenticated
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');

        // Get business_id
        const { data: userData } = await supabase.from('User').select('business_id').eq('user_id', user.id).single();
        let bId = userData?.business_id;
        if (!bId) {
            const { data: empData } = await supabase.from('Employee').select('business_id').eq('user_id', user.id).single();
            bId = empData?.business_id;
        }
        if (!bId) return errorResponse('Business not found', 404);

        let query = supabase.from('PublicHoliday').select('*').eq('business_id', bId);
        if (year) query = query.eq('year', parseInt(year));

        const { data, error } = await query.order('date', { ascending: true });
        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/holidays
 * 
 * Manually add a public holiday
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "name": "Christmas Day",
 *   "date": "2026-12-25",
 *   "state": "NSW",
 *   "is_national": true (optional, default false),
 *   "source": "manual" (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['name', 'date', 'state']);
        if (validationError) return errorResponse(validationError, 400);

        const { name, date, state, is_national, source } = body;
        const year = new Date(date).getFullYear();

        const supabase = await createClient();
        const insertData: PublicHolidayInsert = {
            business_id: authUser.business_id,
            name,
            date,
            state,
            is_national: is_national ?? false,
            year,
            source: source || 'manual'
        };

        const { data, error } = await supabase.from('PublicHoliday').insert(insertData).select().single();
        if (error) return errorResponse(error.message);
        return successResponse(data, 'Public holiday added', 201);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
