import { errorResponse, successResponse, validateRequiredFields } from '@/lib/api-helpers';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

/**
 * GET /api/checklist-templates
 * 
 * List all reusable checklist templates for the business
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const isActive = searchParams.get('is_active');

        const supabase = await createClient();

        let query = supabase
            .from('ChecklistTemplate')
            .select(`
                *,
                item_count:ChecklistTemplateItem(count)
            `)
            .eq('business_id', authUser.business_id)
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true });

        if (category) {
            query = query.eq('category', category);
        }
        if (isActive !== null && isActive !== undefined) {
            query = query.eq('is_active', isActive === 'true');
        }

        const { data: templates, error } = await query;

        if (error) return errorResponse(error.message, 400);

        // Format item_count properly
        const formattedTemplates = templates.map(t => ({
            ...t,
            item_count: (t.item_count as any)?.[0]?.count || 0
        }));

        return successResponse(formattedTemplates, `Found ${formattedTemplates.length} template(s)`);
    } catch (err) {
        console.error('List templates error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/checklist-templates
 * 
 * Create a new reusable checklist template
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, ['name', 'category']);
        if (validationError) return errorResponse(validationError, 400);

        const { name, category, description, is_active } = body;

        const supabase = await createClient();

        // Get the highest sort_order in this category to assign the next one
        const { data: maxOrderData } = await supabase
            .from('ChecklistTemplate')
            .select('sort_order')
            .eq('business_id', authUser.business_id)
            .eq('category', category)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const nextSortOrder = (maxOrderData?.sort_order ?? -1) + 1;

        const { data: template, error } = await supabase
            .from('ChecklistTemplate')
            .insert({
                business_id: authUser.business_id,
                name,
                category,
                description: description || null,
                is_active: is_active !== false,
                sort_order: nextSortOrder,
                created_by: authUser.user_id
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(template, 'Template created successfully', 201);
    } catch (err) {
        console.error('Create template error:', err);
        return errorResponse('Internal server error', 500);
    }
}
