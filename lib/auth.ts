import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';
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

    // Run User table + Employee table lookups in PARALLEL (saves one full round-trip)
    const [{ data: userRecord }, { data: employeeRecord }] = await Promise.all([
        supabase
            .from('User')
            .select('role, business_id, first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle(),
        supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle(),
    ]);

    if (userRecord) {
        return {
            user_id: user.id,
            email: user.email!,
            role: userRecord.role as UserRole,
            business_id: userRecord.business_id,
            first_name: userRecord.first_name,
            last_name: userRecord.last_name,
            // Employee record linked to this user (managers who also clock in)
            employee_id: employeeRecord?.employee_id,
        };
    }

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
 * Cached for 1 hour — business timezone almost never changes.
 * Falls back to 'Australia/Sydney' if none is set.
 */
export const getBusinessTimezone = unstable_cache(
    async (businessId: string): Promise<string> => {
        const supabase = createAdminClient();
        const { data } = await supabase
            .from('Business')
            .select('timezone')
            .eq('business_id', businessId)
            .single();
        return data?.timezone || 'Australia/Sydney';
    },
    ['business-timezone'],
    { revalidate: 3600 } // 1 hour cache
);

