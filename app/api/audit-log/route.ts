import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/audit-log
 * 
 * List audit entries with filters
 * Access: Owner
 * 
 * Query params: table_name, record_id, action, changed_by, from, to
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const tableName = searchParams.get('table_name');
        const recordId = searchParams.get('record_id');
        const action = searchParams.get('action');
        const changedBy = searchParams.get('changed_by');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const supabase = await createClient();
        let query = supabase
            .from('AuditLog')
            .select('*')
            .eq('business_id', authUser.business_id)
            .order('changed_at', { ascending: false });

        if (tableName) query = query.eq('table_name', tableName);
        if (recordId) query = query.eq('record_id', recordId);
        if (action) query = query.eq('action', action);
        if (changedBy) query = query.eq('changed_by', changedBy);
        if (from) query = query.gte('changed_at', from);
        if (to) query = query.lte('changed_at', to);

        const { data, error } = await query.limit(100);

        if (error) return errorResponse(error.message);
        return successResponse(data);
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
