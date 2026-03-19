import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();
        const { data: shift, error } = await supabase.from('Shift').select('*').limit(1).single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(Object.keys(shift), 'Retrieved Shift table columns');
    } catch (err) {
        return errorResponse('Internal server error', 500);
    }
}
