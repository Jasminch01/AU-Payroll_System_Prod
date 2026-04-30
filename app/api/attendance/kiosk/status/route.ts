import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse} from '@/lib/api-helpers';
import { verifyKioskToken } from '@/lib/kiosk-auth';
import { getAvailableActions } from '@/lib/attendance-logic';
import { EventType } from '@/types/database';
import { cookies } from 'next/headers';
import { generateBusinessPrefix } from '@/lib/utils/employee-id';

/**
 * GET /api/attendance/kiosk/status?employee_id=EMP001
 * 
 * Fetches current attendance status and available actions for an employee.
 * Access: Restricted (Kiosk Device Token Required)
 */
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

        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');

        if (!employeeId) {
            return errorResponse('Employee ID is required', 400);
        }

        const supabase = createAdminClient();

        // 1. Resolve Employee ID
        let finalEmployeeId = employeeId.toUpperCase();
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

        // 2. Fetch employee
        const { data: employee, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name, status')
            .eq('employee_id', finalEmployeeId)
            .eq('status', 'active')
            .single();

        if (empError || !employee) {
            return errorResponse('Invalid Employee ID.', 404);
        }

        // Security: Ensure employee belongs to this Kiosk's business
        if (employee.business_id !== kioskPayload.business_id) {
            return errorResponse('Employee not authorized for this kiosk.', 403);
        }

        // 2. Get last log
        const { data: lastLog, error: lastLogError } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', employee.employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastLogError) {
            console.error(`[Kiosk Status] Error fetching attendance logs for ${employee.employee_id}:`, lastLogError);
            return errorResponse('Error fetching status', 500);
        }



        // Type guard: ensure lastLog has the correct shape and is on the correct type
        let typedLastLog: { event_type: EventType; timestamp: string } | null = null;
        
        if (lastLog && typeof lastLog === 'object' && !Array.isArray(lastLog)) {
            const obj = lastLog as Record<string, unknown>;
            const eventType = obj.event_type;
            const timestamp = obj.timestamp;
            
            if (eventType && timestamp) {
                typedLastLog = {
                    event_type: eventType as EventType,
                    timestamp: String(timestamp)
                };

            }
        }



        // 3. Determine available actions
        const actions = getAvailableActions(typedLastLog);



        return successResponse({
            employee_name: `${employee.first_name} ${employee.last_name}`,
            last_event: lastLog?.event_type || null,
            available_actions: actions
        });

    } catch (err) {
        console.error('Kiosk Status Error:', err);
        return errorResponse('Internal server error', 500);
    }
}
