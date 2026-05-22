import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getBusinessTimezone } from '@/lib/auth';
import { createBusinessTimestamp } from '@/lib/timezone-utils';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { EventType } from '@/types/database';
import { validateAttendanceTransition } from '@/lib/attendance-logic';
import { notifyAttendanceEvent } from '@/lib/attendance-notifications';

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

        if (from || to) {
            // Expand date range by ±1 day to capture cross-midnight work sessions
            // E.g. if querying 2026-03-31, include logs from 2026-03-30 onwards
            // This ensures we get CLOCK_OUT that happens on 2026-04-01 if CLOCK_IN is 2026-03-31

            const timezone = await getBusinessTimezone(authUser.business_id);
            let startDate = from;
            let endDate = to;

            if (from) {
                const fromDate = new Date(from);
                fromDate.setDate(fromDate.getDate() - 1);
                startDate = fromDate.toISOString().split('T')[0];
                query = query.gte('timestamp', createBusinessTimestamp(startDate, '00:00', timezone));
            }

            if (to) {
                const toDate = new Date(to);
                toDate.setDate(toDate.getDate() + 1);
                endDate = toDate.toISOString().split('T')[0];
                query = query.lte('timestamp', createBusinessTimestamp(endDate, '23:59', timezone).replace(':00.000Z', ':59.999Z'));
            }
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
        const supabase = await createClient();

        // Support both single object and array of objects
        const entries = Array.isArray(body) ? body : [body];
        const createdLogs = [];

        // --- PRE-FETCH all employees in ONE query (eliminates N+1) ---
        const uniqueEmployeeIds = [...new Set(entries.map((e: { employee_id: string }) => e.employee_id))];
        const { data: employeeList, error: empFetchError } = await supabase
            .from('Employee')
            .select('employee_id, business_id')
            .in('employee_id', uniqueEmployeeIds)
            .eq('business_id', authUser.business_id);

        if (empFetchError) return errorResponse('Failed to validate employees', 500);

        const employeeMap = new Map(
            (employeeList || []).map(e => [e.employee_id, e])
        );

        for (const entryData of entries) {
            const { employee_id, event_type, timestamp } = entryData;

            // Validate employee exists and belongs to the same business (from pre-fetched map)
            const employee = employeeMap.get(employee_id);
            if (!employee) {
                return errorResponse(`Employee ${employee_id} not found or unauthorized`, 404);
            }

            // 1. Check current state for validation (relative to this entry)
            const newTimestamp = timestamp || new Date().toISOString();
            const { data: lastLog } = await supabase
                .from('AttendanceLog')
                .select('event_type, timestamp')
                .eq('employee_id', employee_id)
                .lte('timestamp', newTimestamp)
                .order('timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();

            const transitionError = validateAttendanceTransition(
                lastLog as { event_type: EventType, timestamp: string } | null,
                event_type as EventType,
                newTimestamp
            );

            if (transitionError) {
                return errorResponse(`Manual entry error: ${transitionError}`, 400);
            }

            // Build insert object
            const insertData: Record<string, unknown> = {
                ...entryData,
                timestamp: newTimestamp,
                business_id: authUser.business_id,
                override_by: authUser.user_id,
            };

            const { data: log, error } = await supabase
                .from('AttendanceLog')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Failed to insert manual attendance:', error);
                return errorResponse(error.message, 400);
            }

            createdLogs.push(log);

            // Notify owner and managers of attendance event (async)
            notifyAttendanceEvent(
                employee_id,
                event_type as EventType,
                newTimestamp,
                authUser.business_id
            ).catch(err => console.error('Failed to send attendance notification:', err));
        }

        return successResponse(
            createdLogs.length === 1 ? createdLogs[0] : createdLogs,
            `${createdLogs.length} attendance record(s) recorded`,
            201
        );
    } catch (err) {
        console.error('Manual attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
