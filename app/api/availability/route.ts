import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/availability
 * 
 * Fetch employee availability
 * Access: Owner, Manager, Employee (own only)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Employees can only fetch their own availability
        if (authUser.role === 'employee' && employee_id !== authUser.employee_id) {
            return errorResponse('Forbidden', 403);
        }

        const supabase = await createClient();

        let query = supabase
            .from('employee_availability')
            .select('*')
            .eq('business_id', authUser.business_id);

        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        } else if (authUser.role === 'employee') {
            query = query.eq('employee_id', authUser.employee_id);
        }

        if (from) {
            query = query.gte('date', from);
        }
        if (to) {
            query = query.lte('date', to);
        }

        const { data: availability, error } = await query;

        if (error) return errorResponse(error.message, 400);
        return successResponse(availability);
    } catch (err) {
        console.error('List availability error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/availability
 * 
 * Create or update availability for a date
 * Access: Employee (own), Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { employee_id, date, is_available, reason, available_from, available_to } = body;

        if (!employee_id || !date || is_available === undefined) {
            return errorResponse('Missing required fields', 400);
        }

        // Employees can only update their own availability
        if (authUser.role === 'employee' && employee_id !== authUser.employee_id) {
            return errorResponse('Forbidden', 403);
        }

        const supabase = await createClient();

        // Check if record exists manually to avoid unique constraint errors if not set up in DB
        const { data: existingRecord } = await supabase
            .from('employee_availability')
            .select('availability_id')
            .eq('employee_id', employee_id)
            .eq('date', date)
            .single();

        let record, error;

        if (existingRecord) {
            // Update existing
            const { data: updatedData, error: updateError } = await supabase
                .from('employee_availability')
                .update({
                    is_available,
                    reason: reason || null,
                    available_from: available_from || null,
                    available_to: available_to || null,
                    updated_at: new Date().toISOString()
                })
                .eq('availability_id', existingRecord.availability_id)
                .select()
                .single();

            record = updatedData;
            error = updateError;
        } else {
            // Insert new
            const insertData = {
                business_id: authUser.business_id,
                employee_id,
                date,
                is_available,
                reason: reason || null,
                available_from: available_from || null,
                available_to: available_to || null,
                updated_at: new Date().toISOString()
            };

            const { data: insertedData, error: insertError } = await supabase
                .from('employee_availability')
                .insert(insertData)
                .select()
                .single();

            record = insertedData;
            error = insertError;
        }

        if (error) {
            console.error('Failed to upsert availability:', error);
            return errorResponse(error.message, 400);
        }

        return successResponse(record, 'Availability updated', 200);
    } catch (err) {
        console.error('Upsert availability error:', err);
        return errorResponse('Internal server error', 500);
    }
}
