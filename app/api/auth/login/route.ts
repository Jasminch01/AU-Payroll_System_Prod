import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * POST /api/auth/login
 * 
 * Login for Owner, Manager, or Employee
 * Access: Public
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const validationError = validateRequiredFields(body, ['email', 'password']);
        if (validationError) {
            return errorResponse(validationError, 400);
        }

        const { email, password } = body;

        const supabase = await createClient();

        // Step 1: Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            return errorResponse('Invalid email or password', 401);
        }

        const userId = authData.user.id;

        // Check if email is confirmed
        if (!authData.user.email_confirmed_at && !authData.user.confirmed_at) {
            console.warn(`User ${userId} attempted login before email confirmation.`);
            return errorResponse('Please verify your email address before signing in.', 403);
        }

        // Step 2: Check if user is Owner/Manager (User table)
        const { data: userRecord, error: userError } = await supabase
            .from('User')
            .select('*, Business(*)')
            .eq('user_id', userId)
            .single();

        if (userRecord && !userError) {
            return successResponse({
                user: {
                    user_id: userId,
                    email: authData.user.email,
                    role: userRecord.role,
                    first_name: userRecord.first_name,
                    last_name: userRecord.last_name,
                    business_id: userRecord.business_id,
                    business: userRecord.Business,
                },
                redirect: userRecord.role === 'owner' ? '/owner/dashboard' : '/manager/dashboard',
                session: authData.session,
            }, 'Login successful');
        }

        // Step 3: Check if user is an Employee
        const { data: employeeRecord, error: employeeError } = await supabase
            .from('Employee')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (employeeRecord && !employeeError) {
            if (employeeRecord.status === 'inactive') {
                return errorResponse('Your account is currently inactive. Please contact your manager.', 403);
            }

            return successResponse({
                user: {
                    user_id: userId,
                    email: authData.user.email,
                    role: 'employee',
                    first_name: employeeRecord.first_name,
                    last_name: employeeRecord.last_name,
                    employee_id: employeeRecord.employee_id,
                    business_id: employeeRecord.business_id,
                },
                redirect: '/employee/dashboard',
                session: authData.session,
            }, 'Login successful');
        }

        // User authenticated but no role found
        return errorResponse('Account exists but no role assigned. Contact your administrator.', 403);

    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('Internal server error', 500);
    }
}
