import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/analytics/compliance
 * 
 * Performs a health check on the business setup and employee records
 * to determine payroll compliance readiness.
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        // Use admin client to bypass RLS for server-side data reads
        // (auth is already verified above via requireRole)
        const supabase = createAdminClient();
        const businessId = authUser.business_id;
        const alerts: string[] = [];
        let score = 100;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Run all queries in parallel to minimize roundtrip database latencies
        const [
            businessRes,
            xeroConfigRes,
            employeesRes,
            overdueTimesheetsRes
        ] = await Promise.all([
            supabase.from('Business').select('abn').eq('business_id', businessId).maybeSingle(),
            supabase.from('XeroConfig').select('tenant_id').eq('business_id', businessId).maybeSingle(),
            supabase.from('Employee').select('employee_id, first_name, last_name').eq('business_id', businessId).eq('status', 'active'),
            supabase.from('TimeSheet').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'pending').lt('created_at', sevenDaysAgo.toISOString())
        ]);

        const business = businessRes.data;
        const xeroConfig = xeroConfigRes.data;
        const employees = employeesRes.data;
        const empError = employeesRes.error;
        const overdueTimesheets = overdueTimesheetsRes.count;

        if (!business?.abn) {
            score -= 30;
            alerts.push('ABN/ACN missing from business profile.');
        }

        if (!xeroConfig?.tenant_id) {
            score -= 10;
            alerts.push('Xero integration not connected.');
        }

        // 2. Check Employee Data
        if (empError) {
            console.error('Compliance employee check error:', empError.message);
        }

        if (employees && employees.length > 0) {
            // Check if these employees have an entry in EmployeeRateHistory
            const { data: rates } = await supabase
                .from('EmployeeRateHistory')
                .select('employee_id')
                .in('employee_id', employees.map(e => e.employee_id))
                .eq('business_id', businessId);
            
            const rateMap = new Set(rates?.map(r => r.employee_id) || []);
            const missingRate = employees.filter(e => !rateMap.has(e.employee_id));

            if (missingRate.length > 0) {
                score -= 20;
                alerts.push(`${missingRate.length} employees missing base pay rates.`);
            }
        } else {
            score -= 10;
            alerts.push('No active employees found in the system.');
        }

        // 3. Check Operational Health (e.g., stale timesheets)
        if (overdueTimesheets && overdueTimesheets > 0) {
            score -= 10;
            alerts.push(`${overdueTimesheets} timesheets are pending approval for more than 7 days.`);
        }

        // Ensure score doesn't go below 0
        score = Math.max(0, score);

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (score < 60) status = 'critical';
        else if (score < 90) status = 'warning';

        return successResponse({
            score,
            status,
            alerts,
            last_checked: new Date().toISOString()
        });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
