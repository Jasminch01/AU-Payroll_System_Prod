import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

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
            .order('name', { ascending: true });

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

        const { data: template, error } = await supabase
            .from('ChecklistTemplate')
            .insert({
                business_id: authUser.business_id,
                name,
                category,
                description: description || null,
                is_active: is_active !== false,
                created_by: authUser.user_id // Note: authUser.user_id comes from auth.users.id reference in User table
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
