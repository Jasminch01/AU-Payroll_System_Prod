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

        const dailyBreakdown: Array<{ date: string; labour: number; revenue: number }> = [];
        
        // 5. Generate Daily Breakdown for the last 7 days (including today)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const chartStart = sevenDaysAgo.toISOString().split('T')[0];
        const chartEnd = new Date().toISOString().split('T')[0];

        const { data: dailySales } = await supabase
            .from('SalesData')
            .select('sales_date, total_sales')
            .eq('business_id', authUser.business_id)
            .gte('sales_date', chartStart)
            .lte('sales_date', chartEnd);

        const { data: dailySheets } = await supabase
            .from('TimeSheet')
            .select('date, gross_pay')
            .eq('business_id', authUser.business_id)
            .gte('date', chartStart)
            .lte('date', chartEnd);

        // Group by date
        const salesByDate = (dailySales || []).reduce((acc: any, s) => {
            acc[s.sales_date] = (acc[s.sales_date] || 0) + Number(s.total_sales);
            return acc;
        }, {});

        const labourByDate = (dailySheets || []).reduce((acc: any, s) => {
            acc[s.date] = (acc[s.date] || 0) + Number(s.gross_pay);
            return acc;
        }, {});

        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('en-AU', { weekday: 'short' });
            
            dailyBreakdown.push({
                date: displayDate,
                revenue: salesByDate[dateStr] || 0,
                labour: labourByDate[dateStr] || 0
            });
        }

        return successResponse({
            total_labour: Number(totalLabourCost.toFixed(2)),
            total_revenue: Number(totalRevenue.toFixed(2)),
            labour_percentage: Number(labourPercentage.toFixed(2)),
            threshold_min: business?.labour_threshold_min ?? 10,
            threshold_max: business?.labour_theshold_max ?? 50,
            alert_status: status,
            chart_data: dailyBreakdown
        });

    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
