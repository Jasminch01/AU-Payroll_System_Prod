import { errorResponse, successResponse } from '@/lib/api-helpers';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

/**
 * GET /api/checklist-templates/[id]
 * 
 * Get a single template with all its items
 * Access: Owner, Manager
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: template, error } = await supabase
            .from('ChecklistTemplate')
            .select(`
                *,
                items:ChecklistTemplateItem(*)
            `)
            .eq('template_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!template) return errorResponse('Template not found', 404);

        // Sort items by sort_order
        if (template.items) {
            template.items.sort((a: any, b: any) => a.sort_order - b.sort_order);
        }

        return successResponse(template, 'Template retrieved successfully');
    } catch (err) {
        console.error('Get template error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/checklist-templates/[id]
 * 
 * Update template metadata
 * Access: Owner, Manager
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        
        const supabase = await createClient();

        // First get the current template to check if category is changing
        const { data: currentTemplate, error: fetchError } = await supabase
            .from('ChecklistTemplate')
            .select('category, sort_order')
            .eq('template_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (fetchError) return errorResponse(fetchError.message, 400);
        if (!currentTemplate) return errorResponse('Template not found', 404);

        const { data: template, error } = await supabase
            .from('ChecklistTemplate')
            .update({
                name: body.name,
                category: body.category,
                description: body.description,
                is_active: body.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('template_id', id)
            .eq('business_id', authUser.business_id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);
        if (!template) return errorResponse('Template not found', 404);

        // If category changed, recalculate sort_order for both categories
        if (currentTemplate.category !== body.category) {
            // Get all templates in both the old and new categories
            const { data: allTemplates } = await supabase
                .from('ChecklistTemplate')
                .select('template_id, category, sort_order')
                .eq('business_id', authUser.business_id)
                .in('category', [currentTemplate.category, body.category])
                .order('category', { ascending: true })
                .order('sort_order', { ascending: true });

            if (allTemplates) {
                // Group by category and assign new sort_order
                const grouped: Record<string, any[]> = {};
                allTemplates.forEach(t => {
                    if (!grouped[t.category]) grouped[t.category] = [];
                    grouped[t.category].push(t);
                });

                // Build updates for both categories
                const updates: any[] = [];
                Object.entries(grouped).forEach(([category, templates]) => {
                    templates.forEach((t, index) => {
                        updates.push({
                            template_id: t.template_id,
                            sort_order: index
                        });
                    });
                });

                // Batch update sort_order for all affected templates
                for (const update of updates) {
                    await supabase
                        .from('ChecklistTemplate')
                        .update({ sort_order: update.sort_order })
                        .eq('template_id', update.template_id);
                }
            }
        }

        return successResponse(template, 'Template updated successfully');
    } catch (err) {
        console.error('Update template error:', err);
        return errorResponse('Internal server error', 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        // 1. Verify template ownership and existence
        const { data: template, error: findError } = await supabase
            .from('ChecklistTemplate')
            .select('template_id')
            .eq('template_id', id)
            .eq('business_id', authUser.business_id)
            .maybeSingle();

        if (findError) return errorResponse(findError.message, 400);
        if (!template) return errorResponse('Template not found or access denied', 404);

        // 2. Delete any default mappings in ShiftTypeTemplateDefault
        const { error: mappingError } = await supabase
            .from('ShiftTypeTemplateDefault')
            .delete()
            .eq('template_id', id);

        if (mappingError) {
            console.error('Failed to delete template mappings:', mappingError);
            return errorResponse(mappingError.message, 400);
        }

        // 3. Delete all items associated with this template to avoid foreign key violations
        const { error: itemsError } = await supabase
            .from('ChecklistTemplateItem')
            .delete()
            .eq('template_id', id);

        if (itemsError) return errorResponse(itemsError.message, 400);

        // 4. Set source_template_id to null in ShiftChecklistItem if it exists
        // (Prevents foreign key issues on ShiftChecklistItem if it doesn't have ON DELETE SET NULL)
        const { error: shiftItemsError } = await supabase
            .from('ShiftChecklistItem')
            .update({ source_template_id: null })
            .eq('source_template_id', id);

        if (shiftItemsError) {
            console.warn('Could not reset ShiftChecklistItem source_template_id:', shiftItemsError.message);
            // Proceed anyway, as it might not be constrained
        }

        // 5. Delete the template itself
        const { error: deleteError } = await supabase
            .from('ChecklistTemplate')
            .delete()
            .eq('template_id', id)
            .eq('business_id', authUser.business_id);

        if (deleteError) return errorResponse(deleteError.message, 400);

        return successResponse(null, 'Template deleted successfully');
    } catch (err) {
        console.error('Delete template error:', err);
        return errorResponse('Internal server error', 500);
    }
}