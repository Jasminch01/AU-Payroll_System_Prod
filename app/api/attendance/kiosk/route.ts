import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin'; // Use admin to verify PIN/Employee across business
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { EventType } from '@/types/database';
import { getNextAttendanceEvent, validateAttendanceTransition } from '@/lib/attendance-logic';

/**
 * POST /api/attendance/kiosk
 * 
 * Handle PIN-based clock in/out from a common device (Kiosk)
 * 
 * Body:
 * {
 *   "pin": "1234",
 *   "event_type": "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",
 *   "device_info": "Front Desk Tablet" (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validationError = validateRequiredFields(body, ['pin']);
        if (validationError) return errorResponse(validationError, 400);

        const { pin, device_info } = body;
        let { event_type } = body; // event_type is optional for Auto-Toggle

        // 1. Find employee by PIN
        // We use admin client because the Kiosk might not have an active user session 
        // (it's a shared device). In a real app, you'd protect this with a Kiosk-specific token.
        const supabase = createAdminClient();
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name, status')
            .eq('kiosk_pin', pin)
            .eq('status', 'active')
            .single();

        if (empError || !employee) {
            return errorResponse('Invalid PIN or inactive employee.', 401);
        }

        // 2. Check current state (the latest log for this employee)
        const { data: lastLog, error: lastLogError } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', employee.employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastLogError) return errorResponse('Error checking current status.', 500);

        // Simple Approach (Auto-Toggle):
        // If event_type is not provided, the system automatically 
        // decides: IN if last was OUT/Empty, OUT if last was IN.
        if (!event_type) {
            event_type = getNextAttendanceEvent(
                lastLog as { event_type: EventType, timestamp: string } | null,
                body.timestamp || new Date().toISOString()
            );
        } else {
            // If they DID provide an event_type, we still validate it loosely
            const transitionError = validateAttendanceTransition(
                lastLog as { event_type: EventType, timestamp: string } | null,
                event_type as EventType,
                body.timestamp || new Date().toISOString()
            );
            if (transitionError) return errorResponse(transitionError, 400);
        }

        // 3. Log the event
        const { data: log, error: logError } = await supabase
            .from('AttendanceLog')
            .insert({
                business_id: employee.business_id,
                employee_id: employee.employee_id,
                event_type: event_type as EventType,
                device_info: device_info || 'Kiosk',
                timestamp: body.timestamp || new Date().toISOString()
            })
            .select()
            .single();

        if (logError) return errorResponse(logError.message, 400);

        return successResponse({
            log,
            employee_name: `${employee.first_name} ${employee.last_name}`
        }, `Successfully ${event_type.replace('_', ' ')} for ${employee.first_name}`);

    } catch (err) {
        console.error('Kiosk attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}
