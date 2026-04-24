import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/database';

export interface AuthUser {
    user_id: string;
    email: string;
    role: UserRole | 'employee';
    business_id: string;
    first_name: string;
    last_name: string;
    employee_id?: string;
}

/**
 * Get the currently authenticated user with their role and business_id.
 * Returns null if not authenticated or no role found.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;

    // Check User table (Owner/Manager)
    const { data: userRecord } = await supabase
        .from('User')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (userRecord) {
        // Find if this user also has an Employee record (for managers who clock in)
        const { data: empLinked } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('user_id', user.id)
            .single();

        return {
            user_id: user.id,
            email: user.email!,
            role: userRecord.role as UserRole,
            business_id: userRecord.business_id,
            first_name: userRecord.first_name,
            last_name: userRecord.last_name,
            employee_id: empLinked?.employee_id,
        };
    }

    // Check Employee table
    const { data: employeeRecord } = await supabase
        .from('Employee')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (employeeRecord) {
        return {
            user_id: user.id,
            email: user.email!,
            role: 'employee',
            business_id: employeeRecord.business_id,
            first_name: employeeRecord.first_name ?? '',
            last_name: employeeRecord.last_name ?? '',
            employee_id: employeeRecord.employee_id,
        };
    }

    return null;
}

/**
 * Check if the authenticated user has one of the required roles.
 * Returns the AuthUser if authorized, null otherwise.
 */
export async function requireRole(
    ...allowedRoles: Array<UserRole | 'employee'>
): Promise<AuthUser | null> {
    const authUser = await getAuthUser();
    if (!authUser) return null;
    if (!allowedRoles.includes(authUser.role)) return null;
    return authUser;
}

/**
 * Get the timezone for a given business.
 * Falls back to 'Australia/Sydney' if none is set.
 */
export async function getBusinessTimezone(businessId: string): Promise<string> {
    const supabase = await createClient();
    const { data } = await supabase
        .from('Business')
        .select('timezone')
        .eq('business_id', businessId)
        .single();
    
    return data?.timezone || 'Australia/Sydney';
}

