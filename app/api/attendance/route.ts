import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { EventType } from '@/types/database';
import { validateAttendanceTransition } from '@/lib/attendance-logic';

/**
 * GET /api/attendance
 * 
 * List attendance logs for the business
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const event_type = searchParams.get('event_type');

        const supabase = await createClient();

        let query = supabase
            .from('AttendanceLog')
            .select('*, Employee:employee_id(first_name, last_name, role_title)')
            .eq('business_id', authUser.business_id)
            .order('timestamp', { ascending: false });

        if (employee_id) query = query.eq('employee_id', employee_id);
        if (event_type) query = query.eq('event_type', event_type);

        if (from) {
            // Assuming from/to are dates YYYY-MM-DD, we filter the ISO timestamp
            query = query.gte('timestamp', `${from}T00:00:00Z`);
        }
        if (to) {
            query = query.lte('timestamp', `${to}T23:59:59Z`);
        }

        const { data: logs, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(logs);
    } catch (err) {
        console.error('List attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/attendance
 * 
 * Manual entry/Correction by Manager
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "uuid",
 *   "event_type": "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",
 *   "timestamp": "ISO_STRING",
 *   "coordinates": { "lat": 0, "lng": 0 } (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { employee_id, event_type } = body;
        const supabase = await createClient();

        // 1. Check current state for validation
        const { data: lastLog } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        const transitionError = validateAttendanceTransition(
            lastLog as { event_type: EventType, timestamp: string } | null,
            event_type as EventType,
            body.timestamp || new Date().toISOString()
        );

        if (transitionError) {
            return errorResponse(`Manual entry error: ${transitionError}`, 400);
        }

        const { data: log, error } = await supabase
            .from('AttendanceLog')
            .insert({
                ...body,
                business_id: authUser.business_id,
                override_by: authUser.user_id, // Track who made the manual entry
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(log, 'Manual attendance entry recorded', 201);
    } catch (err) {
        console.error('Manual attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
