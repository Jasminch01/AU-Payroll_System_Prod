import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, getBusinessTimezone } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getNextAttendanceEvent, validateAttendanceTransition } from '@/lib/attendance-logic';
import { EventType } from '@/types/database';
import { notifyAttendanceEvent } from '@/lib/attendance-notifications';

import { getTodayRangeInTimezone } from '@/lib/timezone-utils';

/**
 * GET /api/attendance/me
 * 
 * Get today's logs for the authenticated employee
 * Access: Employee, Manager, Owner
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required.', 401);
        }

        const supabase = await createClient();

        // Get today's date range in the business timezone
        const timezone = await getBusinessTimezone(authUser.business_id);
        const { start, end } = getTodayRangeInTimezone(timezone);

        const { data: logs, error } = await supabase
            .from('AttendanceLog')
            .select('*')
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id)
            .gte('timestamp', start)
            .lte('timestamp', end)
            .order('timestamp', { ascending: false });

        if (error) return errorResponse(error.message, 400);

        // Also get the most recent log to determine current status
        const currentStatus = logs.length > 0 ? logs[0].event_type : null;



        return successResponse({
            logs,
            current_status: currentStatus,
        });
    } catch (err) {
        console.error('My attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/attendance/me
 * 
 * Employee self-service clock in/out (no kiosk device required)
 * Auto-determines next event type (CLOCK_IN → CLOCK_OUT → BREAK_START, etc.)
 * Access: Employee only
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required.', 401);
        }

        if (authUser.role !== 'employee') {
            return errorResponse('Only employees can use self-service clock in/out.', 403);
        }

        const supabase = await createClient();

        // Get the most recent log to determine next event
        const { data: lastLog } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', authUser.employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Auto-determine next event type
        const now = new Date().toISOString();
        const nextEventType = getNextAttendanceEvent(
            lastLog as { event_type: EventType; timestamp: string } | null,
            now
        );



        // Validate the transition
        const transitionError = validateAttendanceTransition(
            lastLog as { event_type: EventType; timestamp: string } | null,
            nextEventType,
            now
        );

        if (transitionError) {
            console.error('[CLOCK ME] Transition error:', transitionError);
            return errorResponse(`Cannot clock: ${transitionError}`, 400);
        }

        // Create the attendance log
        const { data: log, error: logError } = await supabase
            .from('AttendanceLog')
            .insert({
                business_id: authUser.business_id,
                employee_id: authUser.employee_id,
                event_type: nextEventType,
                device_info: 'Employee App',
                timestamp: now,
            })
            .select()
            .single();

        if (logError) {
            return errorResponse(logError.message, 400);
        }

        // Notify managers/owners of the clock event (async, no await)
        notifyAttendanceEvent(
            authUser.employee_id,
            nextEventType,
            now,
            authUser.business_id,
            'Employee App'
        ).catch(err => console.error('Failed to send attendance notification:', err));

        return successResponse(
            { log, event_type: nextEventType },
            `Successfully ${nextEventType.replace('_', ' ').toLowerCase()}!`
        );
    } catch (err) {
        console.error('Employee clock error:', err);
        return errorResponse('Internal server error', 500);
    }
}
