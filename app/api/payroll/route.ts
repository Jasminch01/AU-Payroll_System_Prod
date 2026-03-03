import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { generatePayroll } from '@/lib/payroll-engine';

/**
 * GET /api/payroll
 * 
 * List payroll cycles
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('Payroll')
            .select('*')
            .eq('business_id', authUser.business_id)
            .order('period_start', { ascending: false });

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/payroll
 * 
 * Manually trigger payroll generation
 * Access: Owner
 * 
 * Body:
 * {
 *   "period_start": "2026-03-01",
 *   "period_end": "2026-03-14"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['period_start', 'period_end']);
        if (validationError) return errorResponse(validationError, 400);

        const { period_start, period_end } = body;

        const result = await generatePayroll(authUser.business_id, period_start, period_end);

        if (!result) {
            return errorResponse('No approved timesheets found for this period.', 404);
        }

        return successResponse(result, 'Payroll draft generated successfully', 201);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
