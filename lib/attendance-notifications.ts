import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';
import { EventType } from '@/types/database';

/**
 * Sends notifications to owner and all managers when an employee clocks in/out
 * 
 * @param employeeId - The employee who clocked in/out
 * @param eventType - The attendance event (CLOCK_IN, CLOCK_OUT, etc.)
 * @param timestamp - When the event occurred
 * @param businessId - The business this employee belongs to
 * @param deviceInfo - Optional device info (e.g., "Kiosk", "Mobile")
 */
export async function notifyAttendanceEvent(
  employeeId: string,
  eventType: EventType,
  timestamp: string,
  businessId: string,
  deviceInfo?: string | null
) {
  // Only notify for CLOCK_IN and CLOCK_OUT events
  if (eventType !== 'CLOCK_IN' && eventType !== 'CLOCK_OUT') {
    return;
  }

  try {
    const supabase = await createClient();

    // 1. Fetch employee details
    const { data: employee, error: empError } = await supabase
      .from('Employee')
      .select('employee_id, first_name, last_name, role_title, business_id')
      .eq('employee_id', employeeId)
      .single();

    if (empError || !employee) {
      console.error(`[Attendance Notifications] Employee not found: ${employeeId}`, empError);
      return;
    }

    // 2. Fetch owner and all managers for this business
    const { data: recipients, error: recipError } = await supabase
      .from('User')
      .select('user_id')
      .eq('business_id', businessId)
      .or('role.eq.owner,role.eq.manager');

    if (recipError) {
      console.error(`[Attendance Notifications] Failed to fetch recipients`, recipError);
      return;
    }

    if (!recipients || recipients.length === 0) {
      console.warn(`[Attendance Notifications] No owner/managers found for business ${businessId}`);
      return;
    }

    const recipientUserIds = recipients.map(r => r.user_id);

    // 3. Format the event type for display
    const eventLabel = eventType === 'CLOCK_IN' ? 'clocked in' : 'clocked out';

    // 4. Format timestamp
    const eventDate = new Date(timestamp);
    const timeStr = eventDate.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const dateStr = eventDate.toLocaleDateString('en-AU');

    // 5. Build detailed message
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    const roleInfo = employee.role_title ? ` | ${employee.role_title}` : '';
    const deviceMsg = deviceInfo ? ` (${deviceInfo})` : '';

    const title = `Employee ${eventLabel.toUpperCase()}`;
    const message = `${employee.employee_id} | ${employeeName}${roleInfo} ${eventLabel} at ${timeStr} on ${dateStr}${deviceMsg}`;

    // 6. Create notification with entity tracking for navigation
    await createNotification({
      business_id: businessId,
      user_ids: recipientUserIds,
      actor_id: null,
      type: 'ATTENDANCE_CLOCK_EVENT',
      title,
      message,
      entity_id: employeeId, // For navigation in notification-bell
      entity_type: 'attendance'
    });


  } catch (err) {
    console.error('[Attendance Notifications] Unexpected error:', err);
  }
}
