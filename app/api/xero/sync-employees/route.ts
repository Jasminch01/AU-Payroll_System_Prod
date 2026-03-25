import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getXeroClient } from '@/lib/xero';
import { Contacts } from 'xero-node';

/**
 * POST /api/xero/sync-employees
 * 
 * Create/Update Xero contacts for all active employees
 * Access: Owner
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const xero = await getXeroClient(authUser.business_id).catch(() => null);
        if (!xero) return errorResponse('Xero not connected', 400);

        const supabase = createAdminClient();

        // 1. Fetch active employees
        const { data: employees, error } = await supabase
            .from('Employee')
            .select('*')
            .eq('business_id', authUser.business_id)
            .eq('status', 'active');

        if (error) return errorResponse(error.message);
        if (!employees || employees.length === 0) {
            return successResponse([], 'No active employees to sync');
        }

        const tenants = await xero.updateTenants();
        const tenantId = tenants[0].tenantId;

        const results = {
            synced: 0,
            failed: 0,
            errors: [] as string[]
        };

        // 2. Sync each employee to Xero
        for (const emp of employees) {
            try {
                if (!emp.email) continue;

                const contact: Contacts = {
                    contacts: [{
                        name: `${emp.first_name} ${emp.last_name}`,
                        firstName: emp.first_name ?? undefined,
                        lastName: emp.last_name ?? undefined,
                        emailAddress: emp.email,
                        phones: emp.phone ? [{
                            phoneNumber: emp.phone,
                            phoneType: 'MOBILE' as any
                        }] : undefined,
                        accountNumber: emp.employee_id, // Map our internal ID
                    }]
                };

                // Create or update contact by email
                await xero.accountingApi.createContacts(tenantId, contact);
                results.synced++;
            } catch (err: any) {
                console.error(`Failed to sync employee ${emp.employee_id}:`, err);
                results.failed++;
                results.errors.push(`${emp.first_name} ${emp.last_name}: ${err.message}`);
            }
        }

        return successResponse(results, `Employee sync complete: ${results.synced} synced, ${results.failed} failed`);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
