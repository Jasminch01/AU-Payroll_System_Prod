import { NotificationType } from '@/lib/notifications';

export type UserRole = 'owner' | 'manager' | 'employee';

/**
 * Determines the route to navigate to based on notification type, entity ID, and user role.
 * Centralizes all notification → route mappings for easy maintenance.
 * 
 * @param type - The notification type
 * @param entityId - The related entity (employee_id, shift_id, etc.)
 * @param userRole - The current user's role
 * @returns The route to navigate to, or null if no specific route defined
 */
export function getNotificationRoute(
  type: NotificationType,
  entityId: string | null,
  userRole: UserRole
): string | null {
  // Attendance notifications
  if (type === 'ATTENDANCE_CLOCK_EVENT') {
    if (!entityId) return null;
    if (userRole === 'owner') {
      return `/owner/attendance?employee_id=${entityId}`;
    }
    if (userRole === 'manager') {
      return `/manager/attendance?employee_id=${entityId}`;
    }
    return null;
  }

  // Shift swap notifications
  if (type === 'SHIFT_SWAP_REQUESTED' || type === 'SHIFT_SWAP_ACCEPTED' || 
      type === 'SHIFT_SWAP_REJECTED' || type === 'SHIFT_SWAP_APPROVED') {
    if (userRole === 'manager' || userRole === 'owner') {
      return '/manager/approvals'; // or owner/approvals
    }
    return '/employee/shifts?tab=swaps';
  }

  // Shift transfer notifications
  if (type === 'SHIFT_TRANSFER_OFFERED' || type === 'SHIFT_TRANSFER_ACCEPTED' || 
      type === 'SHIFT_TRANSFER_APPROVED') {
    if (userRole === 'manager' || userRole === 'owner') {
      return '/manager/approvals';
    }
    return '/employee/shifts?tab=transfers';
  }

  // Timesheet notifications
  if (type === 'TIMESHEET_SUBMITTED' || type === 'TIMESHEET_APPROVED' || 
      type === 'TIMESHEET_REJECTED') {
    if (userRole === 'manager' || userRole === 'owner') {
      return '/manager/timesheets';
    }
    return '/employee/timesheets';
  }

  // Shift published/updated/deleted notifications
  if (type === 'SHIFT_PUBLISHED' || type === 'SHIFT_UPDATED' || type === 'SHIFT_DELETED') {
    if (userRole === 'manager' || userRole === 'owner') {
      return '/manager/shifts';
    }
    return '/employee/shifts';
  }

  // Leave request notifications
  if (type === 'EMPLOYEE_JOINED') {
    if (userRole === 'owner' || userRole === 'manager') {
      return '/manager/team';
    }
    return '/employee/dashboard';
  }

  // Broadcast notifications (links to dashboard)
  if (type === 'BROADCAST') {
    return '/dashboard';
  }

  if (type === 'SHIFT_POOL_AVAILABLE') {
    return '/employee/shifts';
  }

  return null;
}
