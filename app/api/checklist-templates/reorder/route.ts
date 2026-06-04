import { errorResponse, successResponse, validateRequiredFields } from '@/lib/api-helpers';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

/**
 * PUT /api/checklist-templates/reorder
 * 
 * Batch update the sort order of checklist templates within a category
 * Access: Owner, Manager
 * 
 * Body: {
 *   reorders: [
 *     { template_id: "xxx", sort_order: 0 },
 *     { template_id: "yyy", sort_order: 1 },
 *     ...
 *   ]
 * }
 */
export async function PUT(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['reorders']);
        if (validationError) return errorResponse(validationError, 400);

        if (!Array.isArray(body.reorders) || body.reorders.length === 0) {
            return errorResponse('reorders must be a non-empty array', 400);
        }

        const supabase = await createClient();

        // Verify all templates belong to this business first
        const templateIds = body.reorders.map((r: any) => r.template_id);
        const { data: templates, error: fetchError } = await supabase
            .from('ChecklistTemplate')
            .select('template_id, business_id')
            .in('template_id', templateIds);

        if (fetchError) return errorResponse(fetchError.message, 400);

        // Verify all templates belong to the user's business
        if (templates.some((t: any) => t.business_id !== authUser.business_id)) {
            return errorResponse('Cannot reorder templates from other businesses', 403);
        }

        // Update all templates safely using individual updates to avoid nullifying other columns
        const updatePromises = body.reorders.map((r: any) =>
            supabase
                .from('ChecklistTemplate')
                .update({ 
                    sort_order: r.sort_order, 
                    updated_at: new Date().toISOString() 
                })
                .eq('template_id', r.template_id)
                .eq('business_id', authUser.business_id)
        );

        await Promise.all(updatePromises);

        return successResponse(null, 'Templates reordered successfully');
    } catch (err) {
        console.error('Reorder templates error:', err);
        return errorResponse('Internal server error', 500);
    }
}
