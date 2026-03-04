import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { SalesDataInsert } from '@/types/database';

/**
 * GET /api/sales
 * 
 * List sales data
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

        const supabase = await createClient();
        let query = supabase
            .from('SalesData')
            .select('*')
            .eq('business_id', authUser.business_id)
            .order('sales_date', { ascending: false });

        if (from) query = query.gte('sales_date', from);
        if (to) query = query.lte('sales_date', to);

        const { data, error } = await query;

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * POST /api/sales
 * 
 * Record daily sales data
 * Access: Owner
 * 
 * Body:
 * {
 *   "sales_date": "2026-03-04",
 *   "total_sales": 1500.50,
 *   "cogs": 450.00,
 *   "top_skus": { "item1": 10, "item2": 5 }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['sales_date', 'total_sales', 'cogs']);
        if (validationError) return errorResponse(validationError, 400);

        const { sales_date, total_sales, cogs, top_skus } = body;

        // Calculate gross profit
        const gross_profit = Number(total_sales) - Number(cogs);

        const salesData: SalesDataInsert = {
            business_id: authUser.business_id,
            sales_date,
            total_sales,
            cogs,
            gross_profit,
            top_skus: top_skus || {},
        };

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('SalesData')
            .insert(salesData)
            .select()
            .single();

        if (error) return errorResponse(error.message);
        return successResponse(data, 'Sales data recorded successfully', 201);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
