import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/analytics/labour-vs-revenue
 * 
 * Calculate labour cost % against total sales
 * Access: Owner
 * 
 * Query params: from, to (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Default to current month if not specified
        const now = new Date();
        const defaultFrom = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const defaultTo = to || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const supabase = await createClient();

        // 1. Fetch Business thresholds
        const { data: business } = await supabase
            .from('Business')
            .select('labour_threshold_min, labour_theshold_max')
            .eq('business_id', authUser.business_id)
            .single();

        // 2. Fetch total wages from PayrollLine for the period
        // We join with Payroll to filter by dates
        const { data: payrollLines, error: pError } = await supabase
            .from('PayrollLine')
            .select('gross_wages, Payroll!inner(period_start, period_end)')
            .eq('business_id', authUser.business_id) // Assuming business_id is on PayrollLine or join correctly
            .filter('Payroll.period_start', 'gte', defaultFrom)
            .filter('Payroll.period_end', 'lte', defaultTo);

        // Refined query with proper business_id filtering
        const { data: lines, error: lineError } = await supabase
            .from('PayrollLine')
            .select('gross_wages, Payroll!inner(*)')
            .eq('Payroll.business_id', authUser.business_id)
            .gte('Payroll.period_start', defaultFrom)
            .lte('Payroll.period_end', defaultTo);

        if (lineError) return errorResponse(lineError.message);

        const totalLabourCost = lines.reduce((sum, l) => sum + Number(l.gross_wages), 0);

        // 3. Fetch total sales from SalesData
        const { data: sales, error: sError } = await supabase
            .from('SalesData')
            .select('total_sales')
            .eq('business_id', authUser.business_id)
            .gte('sales_date', defaultFrom)
            .lte('sales_date', defaultTo);

        if (sError) return errorResponse(sError.message);

        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_sales), 0);

        // 4. Calculate Percentage
        const labourPercentage = totalRevenue > 0
            ? (totalLabourCost / totalRevenue) * 100
            : 0;

        // 5. Determine Alert Status
        let status = 'normal';
        if (business) {
            if (labourPercentage > (business.labour_theshold_max ?? 50)) status = 'critical_high';
            else if (labourPercentage < (business.labour_threshold_min ?? 10)) status = 'critical_low';
        }

        return successResponse({
            total_labour: Number(totalLabourCost.toFixed(2)),
            total_revenue: Number(totalRevenue.toFixed(2)),
            labour_percentage: Number(labourPercentage.toFixed(2)),
            threshold_min: business?.labour_threshold_min ?? 10,
            threshold_max: business?.labour_theshold_max ?? 50,
            alert_status: status,
        });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
