import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/employees/[id]/rates
 * 
 * Get pay rate history for an employee
 * Access: Owner
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const supabase = await createClient();

        const { data: rates, error } = await supabase
            .from('EmployeeRateHistory')
            .select('*')
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .order('effective_from', { ascending: false });

        if (error) {
            return errorResponse(error.message, 400);
        }

        return successResponse(rates, `Found ${rates.length} rate record(s)`);
    } catch (error) {
        console.error('Get rate history error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/employees/[id]/rates
 * 
 * Add a new pay rate for an employee (effective from a date)
 * Access: Owner
 * 
 * Body:
 * {
 *   "weekday_rate": 30.00,
 *   "effective_from": "2026-04-01",
 *   "saturday_multiplier": 1.25,
 *   "sunday_multiplier": 1.50,
 *   "public_holiday_multiplier": 2.50,
 *   "evening_rate": 35.00,
 *   "evening_start_time": 18,
 *   "evening_end_time": 23
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const body = await request.json();

        const validationError = validateRequiredFields(body, [
            'weekday_rate',
            'effective_from',
        ]);
        if (validationError) {
            return errorResponse(validationError, 400);
        }

        const supabase = await createClient();

        // Verify employee belongs to this business
        const { data: employee } = await supabase
            .from('Employee')
            .select('employee_id')
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (!employee) {
            return errorResponse('Employee not found', 404);
        }

        // Close out the previous rate (set effective_to to day before new rate starts)
        const effectiveFrom = new Date(body.effective_from);
        const previousEffectiveTo = new Date(effectiveFrom);
        previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);

        await supabase
            .from('EmployeeRateHistory')
            .update({
                effective_to: previousEffectiveTo.toISOString().split('T')[0],
            })
            .eq('employee_id', id)
            .is('effective_to', null);

        // Create new rate record
        const { data: newRate, error: rateError } = await supabase
            .from('EmployeeRateHistory')
            .insert({
                employee_id: id,
                business_id: authUser.business_id,
                weekday_rate: body.weekday_rate,
                saturday_multiplier: body.saturday_multiplier ?? 1.25,
                sunday_multiplier: body.sunday_multiplier ?? 1.50,
                public_holiday_multiplier: body.public_holiday_multiplier ?? 2.50,
                evening_rate: body.evening_rate ?? null,
                evening_start_time: body.evening_start_time ?? null,
                evening_end_time: body.evening_end_time ?? null,
                effective_from: body.effective_from,
                created_bv: authUser.user_id,
            })
            .select()
            .single();

        if (rateError) {
            return errorResponse(`Failed to create rate: ${rateError.message}`, 400);
        }

        return successResponse(newRate, 'Pay rate added successfully', 201);
    } catch (error) {
        console.error('Create rate error:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PATCH /api/employees/[id]/rates
 * 
 * Update an existing pay rate record
 * Access: Owner
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) {
            return errorResponse('Unauthorized. Owner access required.', 401);
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.rate_history_id) {
            return errorResponse('Rate history ID is required', 400);
        }

        const supabase = await createClient();

        // Verify record belongs to this employee and business
        const { data: existingRate } = await supabase
            .from('EmployeeRateHistory')
            .select('rate_history_id')
            .eq('rate_history_id', body.rate_history_id)
            .eq('employee_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (!existingRate) {
            return errorResponse('Rate record not found', 404);
        }

        // Update rate record
        const { data: updatedRate, error: updateError } = await supabase
            .from('EmployeeRateHistory')
            .update({
                weekday_rate: body.weekday_rate,
                saturday_multiplier: body.saturday_multiplier,
                sunday_multiplier: body.sunday_multiplier,
                public_holiday_multiplier: body.public_holiday_multiplier,
                evening_rate: body.evening_rate,
                evening_start_time: body.evening_start_time,
                evening_end_time: body.evening_end_time,
                effective_from: body.effective_from,
                effective_to: body.effective_to,
            })
            .eq('rate_history_id', body.rate_history_id)
            .select()
            .single();

        if (updateError) {
            return errorResponse(`Failed to update rate: ${updateError.message}`, 400);
        }

        return successResponse(updatedRate, 'Pay rate updated successfully');
    } catch (error) {
        console.error('Update rate error:', error);
        return errorResponse('Internal server error', 500);
    }
}
