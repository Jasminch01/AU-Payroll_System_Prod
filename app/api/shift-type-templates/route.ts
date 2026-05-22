import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/shift-type-templates
 * 
 * List all shift type -> template mappings for the business
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const supabase = await createClient();

        const { data: mappings, error } = await supabase
            .from('ShiftTypeTemplateDefault')
            .select(`
                *,
                template:ChecklistTemplate(name, category)
            `)
            .eq('business_id', authUser.business_id)
            .order('shift_type', { ascending: true });

        if (error) return errorResponse(error.message, 400);

        return successResponse(mappings, `Found ${mappings.length} mapping(s)`);
    } catch (err) {
        console.error('List mappings error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/shift-type-templates
 * 
 * Assign a template as default for a shift type
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['shift_type', 'template_id']);
        if (validationError) return errorResponse(validationError, 400);

        const { shift_type, template_id } = body;
        const supabase = await createClient();

        // Check if mapping already exists
        const { data: existing } = await supabase
            .from('ShiftTypeTemplateDefault')
            .select('mapping_id')
            .eq('business_id', authUser.business_id)
            .eq('shift_type', shift_type.toLowerCase())
            .eq('template_id', template_id)
            .maybeSingle();

        if (existing) {
            return errorResponse('This template is already assigned to this shift type', 409);
        }

        const { data: mapping, error } = await supabase
            .from('ShiftTypeTemplateDefault')
            .insert({
                business_id: authUser.business_id,
                shift_type: shift_type.toLowerCase(),
                template_id,
                created_by: authUser.user_id
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(mapping, 'Mapping created successfully', 201);
    } catch (err) {
        console.error('Create mapping error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/shift-type-templates
 * 
 * Remove a default mapping
 * Access: Owner, Manager
 * 
 * Query params: ?shift_type=morning&template_id=...
 */
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const shift_type = searchParams.get('shift_type');
        const template_id = searchParams.get('template_id');

        if (!shift_type || !template_id) {
            return errorResponse('shift_type and template_id are required', 400);
        }

        const supabase = await createClient();

        const { error } = await supabase
            .from('ShiftTypeTemplateDefault')
            .delete()
            .eq('business_id', authUser.business_id)
            .eq('shift_type', shift_type.toLowerCase())
            .eq('template_id', template_id);

        if (error) return errorResponse(error.message, 400);

        return successResponse(null, 'Mapping removed successfully');
    } catch (err) {
        console.error('Remove mapping error:', err);
        return errorResponse('Internal server error', 500);
    }
}
