import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { EventType } from '@/types/database';
import { getNextAttendanceEvent, validateAttendanceTransition } from '@/lib/attendance-logic';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyKioskToken } from '@/lib/kiosk-auth';
import { generateBusinessPrefix } from '@/lib/utils/employee-id';

/**
 * POST /api/attendance/kiosk
 * 
 * Handle PIN-based clock in/out from a common device (Kiosk)
 * Access: Restricted (Kiosk Device Token Required)
 * 
 * Body:
 * {
 *   "employee_id": "EMP001",
 *   "pin": "1234",
 *   "event_type": "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END",
 *   "device_info": "Front Desk Tablet" (optional)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const kioskToken = cookieStore.get('device_kiosk_token');

        if (!kioskToken) {
            return errorResponse('Device not authorized as a Kiosk. Contact Administrator.', 403);
        }

        const kioskPayload = await verifyKioskToken(kioskToken.value);
        if (!kioskPayload) {
            return errorResponse('Invalid Kiosk token. Please re-authorize this device.', 403);
        }

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['employee_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { employee_id, device_info } = body;
        let { event_type } = body;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const localTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

        // 1. Resolve Employee ID
        let finalEmployeeId = employee_id.toUpperCase();
        const supabase = createAdminClient();

        if (/^\d{4}$/.test(finalEmployeeId)) {
            // Resolve business for prefix
            const { data: business } = await supabase
                .from('Business')
                .select('business_name')
                .eq('business_id', kioskPayload.business_id)
                .single();

            const prefix = business?.business_name ? generateBusinessPrefix(business.business_name) : 'EMP';
            finalEmployeeId = `${prefix}${finalEmployeeId}`;
        }

        // 2. Find employee
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name, status')
            .eq('employee_id', finalEmployeeId)
            .eq('status', 'active')
            .single();

        if (empError || !employee) {
            return errorResponse('Invalid Employee ID or inactive employee.', 401);
        }

        // Security Check: Make sure the employee belongs to this Authorized Kiosk's Business!
        if (employee.business_id !== kioskPayload.business_id) {
            return errorResponse('Invalid Employee ID for this location.', 403);
        }

        // 3. Check current state (the latest log for this employee)
        const { data: lastLog, error: lastLogError } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', employee.employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastLogError) return errorResponse('Error checking current status.', 500);

        if (!event_type) {
            event_type = getNextAttendanceEvent(
                lastLog as { event_type: EventType, timestamp: string } | null,
                body.timestamp || localTimestamp
            );
        } else {
            const transitionError = validateAttendanceTransition(
                lastLog as { event_type: EventType, timestamp: string } | null,
                event_type as EventType,
                body.timestamp || localTimestamp
            );
            if (transitionError) return errorResponse(transitionError, 400);
        }

        // 4. Log the event
        const { data: log, error: logError } = await supabase
            .from('AttendanceLog')
            .insert({
                business_id: employee.business_id,
                employee_id: employee.employee_id,
                event_type: event_type as EventType,
                device_info: device_info || 'Kiosk',
                timestamp: body.timestamp || localTimestamp
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
