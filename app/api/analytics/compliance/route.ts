import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

        const supabase = await createClient();
        const businessId = authUser.business_id;
        const alerts: string[] = [];
        let score = 100;

        // 1. Check Business Profile (ABN)
        const { data: business } = await supabase
            .from('Business')
            .select('abn')
            .eq('business_id', businessId)
            .single();

        // 2. Check Xero Integration
        const { data: xeroConfig } = await supabase
            .from('XeroConfig')
            .select('tenant_id')
            .eq('business_id', businessId)
            .single();


        if (!business?.abn) {
            score -= 30;
            alerts.push('ABN/ACN missing from business profile.');
        }
        
        if (!xeroConfig?.tenant_id) {
            score -= 10;
            alerts.push('Xero integration not connected.');
        }



        // 2. Check Employee Data
        const { data: employees } = await supabase
            .from('Employee')
            .select('first_name, last_name, award_category, base_rate')
            .eq('business_id', businessId)
            .eq('status', 'active');

        if (employees && employees.length > 0) {
            const missingAward = employees.filter(e => !e.award_category);
            const missingRate = employees.filter(e => !e.base_rate);

            if (missingAward.length > 0) {
                score -= 20;
                alerts.push(`${missingAward.length} employees missing Fair Work Award categories.`);
            }
            if (missingRate.length > 0) {
                score -= 20;
                alerts.push(`${missingRate.length} employees missing base pay rates.`);
            }
        } else {
            score -= 10;
            alerts.push('No active employees found in the system.');
        }

        // 3. Check Operational Health (e.g., stale timesheets)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: overdueTimesheets } = await supabase
            .from('TimeSheet')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('status', 'pending')
            .lt('created_at', sevenDaysAgo.toISOString());

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
