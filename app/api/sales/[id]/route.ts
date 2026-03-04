import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/sales/[id]
 * 
 * Get single sales record
 * Access: Owner
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('SalesData')
            .select('*')
            .eq('Sales_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * PUT /api/sales/[id]
 * 
 * Update sales record
 * Access: Owner
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();

        // Dynamic update object
        const updateData: any = {};
        if (body.sales_date) updateData.sales_date = body.sales_date;
        if (body.total_sales !== undefined) updateData.total_sales = body.total_sales;
        if (body.cogs !== undefined) updateData.cogs = body.cogs;
        if (body.top_skus) updateData.top_skus = body.top_skus;

        // Recalculate gross profit if sales or cogs changed
        if (updateData.total_sales !== undefined || updateData.cogs !== undefined) {
            // We might need to fetch the existing record if only one is provided
            const supabase = await createClient();
            const { data: existing } = await supabase
                .from('SalesData')
                .select('total_sales, cogs')
                .eq('Sales_id', id)
                .single();

            const finalSales = updateData.total_sales ?? existing?.total_sales ?? 0;
            const finalCogs = updateData.cogs ?? existing?.cogs ?? 0;
            updateData.gross_profit = Number(finalSales) - Number(finalCogs);
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('SalesData')
            .update(updateData)
            .eq('Sales_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message);
        return successResponse(data, 'Sales record updated successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}

/**
 * DELETE /api/sales/[id]
 * 
 * Delete sales record
 * Access: Owner
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();
        const { error } = await supabase
            .from('SalesData')
            .delete()
            .eq('Sales_id', id)
            .eq('business_id', authUser.business_id);

        if (error) return errorResponse(error.message);
        return successResponse(null, 'Sales record deleted successfully');
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
