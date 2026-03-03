import { createClient } from '@/lib/supabase/server';

/**
 * Checks if an employee has any rostered shifts during the requested leave period.
 * 
 * @param businessId The ID of the business
 * @param employeeId The ID of the employee
 * @param startDate The start date of the leave (YYYY-MM-DD)
 * @param endDate The end date of the leave (YYYY-MM-DD)
 * @returns An array of conflicting shifts, or empty if none.
 */
export async function checkLeaveConflicts(
    businessId: string,
    employeeId: string,
    startDate: string,
    endDate: string
) {
    const supabase = await createClient();

    const { data: conflicts, error } = await supabase
        .from('Shift')
        .select('*')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

    if (error) {
        console.error('Error checking leave conflicts:', error);
        return [];
    }

    return conflicts || [];
}

/**
 * Checks if an employee has approved leave on a specific shift date.
 */
export async function checkShiftConflictWithLeave(
    businessId: string,
    employeeId: string,
    shiftDate: string // YYYY-MM-DD
) {
    const supabase = await createClient();

    const { data: conflicts, error } = await supabase
        .from('LeaveRequest')
        .select('*')
        .eq('business_id', businessId)
        .eq('employee_id', employeeId)
        .eq('status', 'approved')
        .lte('start_date', shiftDate)
        .gte('end_date', shiftDate);

    if (error) {
        console.error('Error checking shift-leave conflicts:', error);
        return [];
    }

    return conflicts || [];
}
