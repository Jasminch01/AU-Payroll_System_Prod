import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * DELETE /api/shift/[id]/checklist/template/[templateId]
 * 
 * Remove all tasks associated with a specific template from a shift
 * Access: Owner, Manager
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; templateId: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id, templateId } = await params;
        const supabase = await createClient();

        const { error } = await supabase
            .from('ShiftChecklistItem')
            .delete()
            .eq('source_template_id', templateId)
            .eq('shift_id', id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Template tasks removed successfully');
    } catch (err) {
        console.error('Remove template tasks error:', err);
        return errorResponse('Internal server error', 500);
    }
}
