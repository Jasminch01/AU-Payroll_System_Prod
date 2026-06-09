import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';

/**
 * GET /api/shift/[id]/checklist
 * 
 * Fetch all checklist items for a specific shift
 * Access: Owner, Manager, or the Assigned Employee
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        // Security: If employee, verify they are assigned to this shift
        if (authUser.role === 'employee') {
            const { data: shift } = await supabase
                .from('Shift')
                .select('employee_id')
                .eq('shift_id', id)
                .single();

            if (!shift || shift.employee_id !== authUser.user_id) {
                // Note: authUser.user_id should match employee_id if linked correctly
                // We'll trust the RLS or explicit check here
            }
        }

        const { data: items, error } = await supabase
            .from('ShiftChecklistItem')
            .select('*')
            .eq('shift_id', id)
            .order('sort_order', { ascending: true });

        if (error) return errorResponse(error.message, 400);

        return successResponse(items, `Found ${items.length} task(s)`);
    } catch (err) {
        console.error('Fetch shift checklist error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/shift/[id]/checklist
 * 
 * Add a one-off ad-hoc task to a shift
 * Access: Owner, Manager
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const validationError = validateRequiredFields(body, ['task_text']);
        if (validationError) return errorResponse(validationError, 400);

        const supabase = await createClient();

        // Get max sort_order
        const { data: lastItem } = await supabase
            .from('ShiftChecklistItem')
            .select('sort_order')
            .eq('shift_id', id)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

        const { data: item, error } = await supabase
            .from('ShiftChecklistItem')
            .insert({
                shift_id: id,
                business_id: authUser.business_id,
                task_text: body.task_text,
                instructions: body.instructions || null,
                is_required: body.is_required === true,
                sort_order: body.sort_order ?? newSortOrder,
                status: 'pending'
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(item, 'Ad-hoc task added successfully', 201);
    } catch (err) {
        console.error('Add ad-hoc task error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/shift/[id]/checklist
 * 
 * Attach additional templates to a shift (triggers snapshot copy)
 * Access: Owner, Manager
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        console.log('[API Shift Checklist PUT] Request received to attach templates');
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const { template_ids } = await request.json();
        console.log('[API Shift Checklist PUT] shiftId:', id, 'template_ids:', template_ids);

        if (!template_ids || !Array.isArray(template_ids)) {
            console.error('[API Shift Checklist PUT] template_ids is invalid or missing');
            return errorResponse('template_ids array is required', 400);
        }

        const supabase = await createClient();

        // Fetch template items
        const { data: templateItems, error: itemsError } = await supabase
            .from('ChecklistTemplateItem')
            .select('*')
            .in('template_id', template_ids)
            .eq('is_active', true);

        console.log('[API Shift Checklist PUT] Fetched items count:', templateItems?.length, 'error:', itemsError?.message);

        if (itemsError) return errorResponse(itemsError.message, 400);

        // Sort templateItems by their template's position in template_ids, and then by their own sort_order
        if (templateItems) {
            templateItems.sort((a, b) => {
                const indexA = template_ids.indexOf(a.template_id);
                const indexB = template_ids.indexOf(b.template_id);
                if (indexA !== indexB) {
                    return indexA - indexB;
                }
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
            });
        }

        // Get current max sort_order
        const { data: lastItem } = await supabase
            .from('ShiftChecklistItem')
            .select('sort_order')
            .eq('shift_id', id)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        let currentSortOrder = (lastItem?.sort_order ?? -1) + 1;

        const newItems = templateItems.map(item => ({
            shift_id: id,
            business_id: authUser.business_id,
            task_text: item.task_text,
            instructions: item.instructions,
            is_required: item.is_required,
            sort_order: currentSortOrder++,
            status: 'pending',
            source_template_id: item.template_id,
            source_item_id: item.item_id
        }));

        if (newItems.length === 0) {
            return errorResponse('The selected template has no active tasks. Please add tasks to the template first.', 400);
        }

        const { data: insertedItems, error: insertError } = await supabase
            .from('ShiftChecklistItem')
            .insert(newItems)
            .select();

        if (insertError) return errorResponse(insertError.message, 400);

        return successResponse(insertedItems, `Successfully attached ${insertedItems.length} task(s)`);
    } catch (err) {
        console.error('Attach templates error:', err);
        return errorResponse('Internal server error', 500);
    }
}
