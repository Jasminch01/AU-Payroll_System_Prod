import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { EventType } from '@/types/database';
import { getNextAttendanceEvent, validateAttendanceTransition } from '@/lib/attendance-logic';
import { notifyAttendanceEvent } from '@/lib/attendance-notifications';
import { cookies } from 'next/headers';
import { verifyKioskToken } from '@/lib/kiosk-auth';
import { getBusinessTimezone } from '@/lib/auth';
import { getDateInTimezone } from '@/lib/timezone-utils';
import { generateBusinessPrefix } from '@/lib/utils/employee-id';
import { getShiftChecklistProgress, validateClockOutChecklist, notifyChecklistStatus, validateClockOutOrdering } from '@/lib/checklist-engine';
import { detectShiftHasOrdering, generateDailyOrderTasks, notifyOrderStatus } from '@/lib/order-guide-engine';

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
    let event_type: any;
    let employee: any;
    const supabase = createAdminClient();

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
        event_type = body.event_type;

        const localTimestamp = new Date().toISOString();

        // 1. Resolve Employee ID
        let finalEmployeeId = employee_id.toUpperCase();

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
        const { data: empData, error: empError } = await supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name, status, user_id')
            .eq('employee_id', finalEmployeeId)
            .eq('status', 'active')
            .single();
        
        employee = empData;

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

        // --- CHECKLIST LOGIC FOR CLOCK_OUT ---
        let rosteredShift = null;
        if (event_type === 'CLOCK_OUT') {
            const tz = await getBusinessTimezone(employee.business_id);
            const today = getDateInTimezone(body.timestamp || localTimestamp, tz);
            const { data: shift } = await supabase
                .from('Shift')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .eq('shift_date', today)
                .eq('shift_status', 'published')
                .limit(1)
                .maybeSingle();
            
            if (shift) {
                rosteredShift = shift;
                // 1. Regular checklist
                const { blocked, pendingCount } = await validateClockOutChecklist(shift.shift_id, supabase);
                if (blocked) {
                    // Send blocked notification
                    if (employee.user_id) {
                        notifyChecklistStatus(
                            employee.user_id,
                            employee.business_id,
                            'CLOCK_OUT_BLOCKED',
                            shift.shift_type,
                            pendingCount,
                            shift.shift_id
                        ).catch(err => console.error('Failed to send checklist blocked notification:', err));
                    }

                    return errorResponse(
                        `Incomplete Checklist: Please complete your shift checklist before clocking out. You have ${pendingCount} pending task(s).`,
                        422,
                        { blocked: true, pending_count: pendingCount }
                    );
                }

                // 2. Ordering checklist
                const { blocked: orderBlocked, pendingCount: orderPendingCount, pendingCategories } = await validateClockOutOrdering(shift.shift_id, employee.business_id, today, supabase);
                if (orderBlocked) {
                    if (employee.user_id) {
                        notifyOrderStatus(
                            employee.user_id,
                            employee.business_id,
                            'clock_out',
                            { pendingCount: orderPendingCount, categories: pendingCategories }
                        ).catch(err => console.error('Failed to send order clock out notification:', err));
                    }

                    return errorResponse(
                        `Incomplete Orders Checklist: Please complete your ordering tasks for today before clocking out. You have ${orderPendingCount} pending item(s) in category: ${pendingCategories.join(', ')}.`,
                        422,
                        { blocked: true, pending_count: orderPendingCount }
                    );
                }
            }
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

        // Notify owner and managers of attendance event
        await notifyAttendanceEvent(
            employee.employee_id,
            event_type as EventType,
            body.timestamp || localTimestamp,
            employee.business_id,
            device_info || 'Kiosk'
        ).catch(err => console.error('Failed to send attendance notification:', err));

        return successResponse({
            log,
            employee_name: `${employee.first_name} ${employee.last_name}`
        }, `Successfully ${event_type.replace('_', ' ')} for ${employee.first_name}`);

    } catch (err) {
        console.error('Kiosk attendance error:', err);
        return errorResponse('Internal server error', 500);
    } finally {
        // Note: We MUST await this so the Next.js runtime doesn't kill it early.
        if (event_type === 'CLOCK_IN' && employee?.user_id) {
            await (async () => {
                const tz = await getBusinessTimezone(employee.business_id);
                const today = getDateInTimezone(new Date().toISOString(), tz);
                const { data: shift } = await supabase
                    .from('Shift')
                    .select('*')
                    .eq('employee_id', employee.employee_id)
                    .eq('shift_date', today)
                    .eq('shift_status', 'published')
                    .limit(1)
                    .maybeSingle();

                if (shift) {
                    // 1. Regular checklist reminder
                    const { total } = await getShiftChecklistProgress(shift.shift_id, supabase);
                    if (total > 0) {
                        await notifyChecklistStatus(
                            employee.user_id!,
                            employee.business_id,
                            'CLOCK_IN_REMINDER',
                            shift.shift_type,
                            total,
                            shift.shift_id
                        );
                    }

                    // 2. Ordering checklist generation & notification
                    const hasOrdering = await detectShiftHasOrdering(shift.shift_id, supabase);
                    if (hasOrdering) {
                        // Generate tasks for today (idempotent)
                        await generateDailyOrderTasks(employee.business_id, today, supabase, shift.shift_id);
                        // Notify employee
                        await notifyOrderStatus(
                            employee.user_id!,
                            employee.business_id,
                            'clock_in'
                        );
                    }
                }
            })().catch(err => console.error('Failed to send checklist reminder:', err));
        }
    }
}