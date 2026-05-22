import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/payroll/[id]
 * 
 * Get payroll details and lines
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();

        // Run both queries in parallel
        const [payrollResult, linesResult] = await Promise.all([
            supabase
                .from('Payroll')
                .select('*')
                .eq('payroll_id', id)
                .eq('business_id', authUser.business_id)
                .single(),
            supabase
                .from('PayrollLine')
                .select('*, Employee:employee_id(employee_id, first_name, last_name)')
                .eq('payroll_id', id)
        ]);

        const { data: payroll, error: payrollError } = payrollResult;
        const { data: lines, error: linesError } = linesResult;

        if (payrollError || !payroll) return errorResponse('Payroll record not found', 404);

        if (linesError) {
            console.error('Error fetching payroll lines:', linesError);
        }

        return successResponse({
            ...payroll,
            lines: lines || []
        });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * PUT /api/payroll/[id]
 * 
 * Approve or mark payroll as paid
 * Access: Owner
 * 
 * Body:
 * {
 *   "status": "approved" | "paid"
 * }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const { status } = body; // expect 'approved' or 'paid'

        if (!['approved', 'paid'].includes(status)) {
            return errorResponse('Invalid status transition. Use "approved" or "paid".', 400);
        }

        const supabase = await createClient();

        // 1. Fetch current status
        const { data: current, error: fetchErr } = await supabase
            .from('Payroll')
            .select('status')
            .eq('payroll_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (fetchErr || !current) return errorResponse('Payroll not found', 404);

        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        if (status === 'approved') {
            if (current.status !== 'draft') return errorResponse('Only drafts can be approved.', 400);
            updateData.status = 'approved';
            updateData.approved_by = authUser.user_id;
            updateData.approved_at = new Date().toISOString();
        } else if (status === 'paid') {
            if (current.status !== 'approved') return errorResponse('Payroll must be approved before marking as paid.', 400);
            updateData.status = 'paid';
        }

        const { data, error } = await supabase
            .from('Payroll')
            .update(updateData)
            .eq('payroll_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message);

        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Payroll',
            recordId: id,
            action: 'UPDATE',
            changedBy: authUser.user_id,
            beforeValue: current,
            afterValue: data,
            reason: `Payroll marked as ${status}`
        });

        // 2. If marking as paid, also update all lines
        if (status === 'paid') {
            const { error: linesErr } = await supabase
                .from('PayrollLine')
                .update({
                    payment_status: 'paid',
                    payment_date: new Date().toISOString()
                })
                .eq('payroll_id', id);

            if (linesErr) console.error('Error updating lines to paid:', linesErr);
        }

        return successResponse(data, `Payroll marked as ${status}`);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * DELETE /api/payroll/[id]
 * 
 * Rollback/Delete a payroll draft
 * Access: Owner
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();

        // 1. Check if it's still a draft
        const { data: payroll, error: fetchErr } = await supabase
            .from('Payroll')
            .select('status')
            .eq('payroll_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (fetchErr || !payroll) return errorResponse('Payroll not found', 404);
        if (payroll.status !== 'draft') return errorResponse('Cannot delete an approved payroll', 400);

        // 2. Delete lines first (Supabase usually handles this via FK but good to be explicit or if no cascade)
        await supabase
            .from('PayrollLine')
            .delete()
            .eq('payroll_id', id);

        // 3. Delete parent
        const { error } = await supabase
            .from('Payroll')
            .delete()
            .eq('payroll_id', id);

        if (error) return errorResponse(error.message);

        await logAudit({
            businessId: authUser.business_id,
            tableName: 'Payroll',
            recordId: id,
            action: 'DELETE',
            changedBy: authUser.user_id,
            beforeValue: payroll,
            reason: 'Deleted payroll draft'
        });

        return successResponse(null, 'Payroll draft deleted successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
