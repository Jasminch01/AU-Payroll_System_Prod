import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { syncBusinessHolidays } from '@/lib/holiday-sync';
import { getSiteUrl } from '@/lib/utils/url';

/**
 * POST /api/auth/register
 * 
 * Register a new Owner + Business
 * Access: Public
 * 
 * Body:
 * {
 *   "email": "owner@example.com",
 *   "password": "securepassword",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "business_name": "My Restaurant",
 *   "abn": "12345678901",
 *   "state": "NSW"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const validationError = validateRequiredFields(body, [
            'email',
            'password',
            'first_name',
            'last_name',
            'business_name',
            'abn',
            'state',
        ]);

        if (validationError) {
            return errorResponse(validationError, 400);
        }

        const { email, password, first_name, last_name, business_name, abn, state } = body;

        // Validate password length
        if (password.length < 6) {
            return errorResponse('Password must be at least 6 characters', 400);
        }

        // Validate ABN format (11 digits for Australian Business Number)
        const abnClean = abn.replace(/\s/g, '');
        if (!/^\d{11}$/.test(abnClean)) {
            return errorResponse('ABN must be 11 digits', 400);
        }

        const supabase = await createClient();

        // Step 1: Create auth user
        const siteUrl = getSiteUrl(request);
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${siteUrl}/login?confirmed=true`,
            },
        });

        if (authError) {
            return errorResponse(authError.message, 400);
        }

        if (!authData.user) {
            return errorResponse('Failed to create user account', 500);
        }

        const userId = authData.user.id;

        // Step 2: Create Business record
        const { data: businessData, error: businessError } = await supabase
            .from('Business')
            .insert({
                business_name,
                abn: abnClean,
                state,
            })
            .select()
            .single();

        if (businessError) {
            // Cleanup: if business creation fails, we should note this
            // In production, use a transaction or edge function
            return errorResponse(`Failed to create business: ${businessError.message}`, 400);
        }

        // Step 3: Create User record (role = owner)
        const { data: userData, error: userError } = await supabase
            .from('User')
            .insert({
                user_id: userId,
                business_id: businessData.business_id,
                role: 'owner',
                first_name,
                last_name,
            })
            .select()
            .single();

        if (userError) {
            return errorResponse(`Failed to create user profile: ${userError.message}`, 400);
        }

        // Step 4: Sync Public Holidays for the new business
        // We do this in the background/non-blocking if possible, or just await it
        try {
            await syncBusinessHolidays(businessData.business_id, state);
        } catch (syncErr) {
            console.error('Failed to sync holidays during registration:', syncErr);
            // We don't fail the whole registration if this fails, but we log it
        }

        return successResponse(
            {
                user: {
                    user_id: userId,
                    email,
                    role: 'owner',
                    first_name,
                    last_name,
                },
                business: businessData,
                session: authData.session,
            },
            'Registration successful',
            201
        );
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse('Internal server error', 500);
    }
}
