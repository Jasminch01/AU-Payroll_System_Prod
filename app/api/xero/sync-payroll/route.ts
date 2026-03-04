import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getXeroClient } from '@/lib/xero';
import { Invoices, Invoice, LineItem } from 'xero-node';

/**
 * POST /api/xero/sync-payroll
 * 
 * Sync an approved payroll to Xero as invoices/bills
 * Access: Owner
 * 
 * Body:
 * {
 *   "payroll_id": "uuid-of-payroll"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['payroll_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { payroll_id } = body;

        const xero = await getXeroClient(authUser.business_id).catch(() => null);
        if (!xero) return errorResponse('Xero not connected', 400);

        const supabase = createAdminClient();

        // 1. Fetch Payroll header
        const { data: payroll, error: pError } = await supabase
            .from('Payroll')
            .select('*')
            .eq('payroll_id', payroll_id)
            .eq('business_id', authUser.business_id)
            .single();

        if (pError || !payroll) return errorResponse('Payroll not found or unauthorized');
        if (payroll.status !== 'approved') return errorResponse('Only approved payroll can be synced to Xero');

        // 2. Fetch Payroll Lines with Employee info
        const { data: lines, error: lError } = await supabase
            .from('PayrollLine')
            .select('*, Employee(first_name, last_name, email)')
            .eq('payroll_id', payroll_id);

        if (lError || !lines || lines.length === 0) return errorResponse('No payroll lines found');

        const tenants = await xero.updateTenants();
        const tenantId = tenants[0].tenantId;

        // 3. Create XeroSync record (pending)
        const { data: syncEntry } = await supabase
            .from('XeroSync')
            .insert({
                business_id: authUser.business_id,
                payroll_id: payroll_id,
                status: 'pending'
            })
            .select()
            .single();

        // 4. Build Xero Invoices (Accounts Payable)
        // We'll group them into one Xero batch call if possible, or create individually
        const invoices: Invoices = {
            invoices: lines.map(line => {
                const emp = line.Employee as any;
                const contactName = emp ? `${emp.first_name} ${emp.last_name}` : `Employee ${line.employee_id}`;

                return {
                    type: Invoice.TypeEnum.ACCPAY,
                    contact: { name: contactName },
                    date: new Date().toISOString().split('T')[0],
                    dueDate: new Date().toISOString().split('T')[0],
                    lineItems: [{
                        description: `Wages for period ${payroll.period_start} to ${payroll.period_end}`,
                        quantity: 1,
                        unitAmount: line.gross_wages,
                        accountCode: '477', // Default wages account code in Xero demo
                    }],
                    status: Invoice.StatusEnum.DRAFT,
                    reference: `Payroll ${payroll.period_start}_${payroll.period_end}`,
                };
            })
        };

        try {
            // 5. Push to Xero
            const response = await xero.accountingApi.createInvoices(tenantId, invoices);

            // 6. Update Sync Record
            await supabase
                .from('XeroSync')
                .update({
                    status: 'synced',
                    synced_at: new Date().toISOString(),
                    xero_invoice_id: response.body.invoices?.[0]?.invoiceID // Using first one as reference
                })
                .eq('sync_id', syncEntry.sync_id);

            return successResponse(response.body, 'Payroll synced to Xero successfully');
        } catch (err: any) {
            console.error('Xero sync error:', err);

            // Log failure
            await supabase
                .from('XeroSync')
                .update({
                    status: 'failed',
                    error_message: err.message
                })
                .eq('sync_id', syncEntry.sync_id);

            return errorResponse(`Xero API Error: ${err.message}`, 500);
        }
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
