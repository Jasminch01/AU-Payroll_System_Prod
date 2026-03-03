import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/rosters
 * 
 * List all rosters for the business
 * Access: Owner, Manager
 * 
 * Query params:
 *   ?status=draft|published (optional)
 *   ?from=YYYY-MM-DD (optional)
 *   ?to=YYYY-MM-DD (optional)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const supabase = await createClient();

        let query = supabase
            .from('Roster')
            .select('*, Shift(*)')
            .eq('business_id', authUser.business_id)
            .order('start_date', { ascending: false });

        if (status === 'draft' || status === 'published') {
            query = query.eq('status', status);
        }
        if (from) query = query.gte('start_date', from);
        if (to) query = query.lte('end_date', to);

        const { data: rosters, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(rosters, `Found ${rosters.length} roster(s)`);
    } catch (err) {
        console.error('List rosters error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/rosters
 * 
 * Create a new roster (week block)
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "start_date": "2026-03-03",
 *   "end_date": "2026-03-09"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['start_date', 'end_date']);
        if (validationError) return errorResponse(validationError, 400);

        const { start_date, end_date } = body;

        // Validate date order
        if (new Date(start_date) > new Date(end_date)) {
            return errorResponse('start_date must be before end_date', 400);
        }

        const supabase = await createClient();

        // Prevent duplicate overlapping roster for same business
        const { data: existing } = await supabase
            .from('Roster')
            .select('roster_id')
            .eq('business_id', authUser.business_id)
            .lte('start_date', end_date)
            .gte('end_date', start_date)
            .limit(1)
            .single();

        if (existing) {
            return errorResponse('A roster already exists that overlaps with this date range', 409);
        }

        const { data: roster, error } = await supabase
            .from('Roster')
            .insert({
                business_id: authUser.business_id,
                start_date,
                end_date,
                status: 'draft',
                created_by: authUser.user_id,
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(roster, 'Roster created successfully', 201);
    } catch (err) {
        console.error('Create roster error:', err);
        return errorResponse('Internal server error', 500);
    }
}
