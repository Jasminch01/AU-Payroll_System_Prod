import { SupabaseClient } from '@supabase/supabase-js';
import { ChecklistTemplateItem, ShiftChecklistItemInsert, ShiftChecklistItemStatus } from '@/types/database';
import { createNotification } from '@/lib/notifications';

/**
 * Core engine for the Shift Checklist System
 */

/**
 * Copies all active tasks from default templates assigned to a shift type into a specific shift.
 * This is a "snapshot" — editing these tasks later only affects this shift.
 */
export async function copyTemplateTasksToShift(
    shiftId: string,
    shiftType: string,
    businessId: string,
    supabase: SupabaseClient
) {
    try {
        console.log(`[ChecklistEngine] Copying templates for shift ${shiftId} (${shiftType})`);

        // 1. Find default templates for this shift type
        const { data: mappings, error: mapError } = await supabase
            .from('ShiftTypeTemplateDefault')
            .select('template_id')
            .eq('business_id', businessId)
            .eq('shift_type', shiftType.toLowerCase());

        if (mapError) throw mapError;
        if (!mappings || mappings.length === 0) {
            console.log(`[ChecklistEngine] No default templates for shift type: ${shiftType}`);
            return;
        }

        const templateIds = mappings.map(m => m.template_id);

        // 2. Fetch all active items from these templates
        const { data: templateItems, error: itemsError } = await supabase
            .from('ChecklistTemplateItem')
            .select('*')
            .in('template_id', templateIds)
            .eq('is_active', true);

        if (itemsError) throw itemsError;
        if (!templateItems || templateItems.length === 0) {
            console.log(`[ChecklistEngine] No active tasks found in templates: ${templateIds.join(', ')}`);
            return;
        }

        // 3. Prepare snapshot items
        const shiftItems: ShiftChecklistItemInsert[] = templateItems.map((item: ChecklistTemplateItem) => ({
            shift_id: shiftId,
            business_id: businessId,
            task_text: item.task_text,
            instructions: item.instructions,
            is_required: item.is_required,
            sort_order: item.sort_order,
            status: 'pending',
            reason: null,
            completed_by: null,
            completed_at: null,
            source_template_id: item.template_id,
            source_item_id: item.item_id
        }));

        // 4. Batch insert into ShiftChecklistItem
        const { error: insertError } = await supabase
            .from('ShiftChecklistItem')
            .insert(shiftItems);

        if (insertError) throw insertError;

        console.log(`[ChecklistEngine] Successfully copied ${shiftItems.length} tasks to shift ${shiftId}`);
    } catch (err) {
        console.error('[ChecklistEngine] Failed to copy template tasks:', err);
        throw err;
    }
}

/**
 * Returns task progress for a shift
 */
export async function getShiftChecklistProgress(shiftId: string, supabase: SupabaseClient) {
    const { data: items, error } = await supabase
        .from('ShiftChecklistItem')
        .select('status, is_required')
        .eq('shift_id', shiftId);

    if (error) throw error;
    if (!items) return { total: 0, done: 0, pending: 0, not_done: 0, not_applicable: 0, required_pending: 0 };

    const stats = items.reduce((acc, item) => {
        acc.total++;
        acc[item.status as ShiftChecklistItemStatus]++;
        if (item.is_required && item.status === 'pending') {
            acc.required_pending++;
        }
        return acc;
    }, { total: 0, done: 0, pending: 0, not_done: 0, not_applicable: 0, required_pending: 0 });

    return stats;
}

/**
 * Validates if an employee can clock out.
 * Blocks only if required tasks are incomplete:
 * - Status is 'pending'
 * - Status is 'not_done' and reason is empty/missing
 */
export async function validateClockOutChecklist(shiftId: string, supabase: SupabaseClient) {
    const { data: items, error } = await supabase
        .from('ShiftChecklistItem')
        .select('task_text, status, reason')
        .eq('shift_id', shiftId)
        .eq('is_required', true);

    if (error) throw error;

    const incompleteRequiredTasks = items?.filter(item => 
        item.status === 'pending' || 
        (item.status === 'not_done' && (!item.reason || item.reason.trim() === ''))
    ) || [];

    const pendingCount = incompleteRequiredTasks.length;
    
    return {
        blocked: pendingCount > 0,
        pendingCount,
        pendingTasks: incompleteRequiredTasks.map(i => i.task_text)
    };
}

/**
 * Triggers an in-app + push notification to the employee about their shift checklist.
 * - CLOCK_IN_REMINDER: sent when they clock in and have pending checklist tasks
 * - CLOCK_OUT_BLOCKED: sent when they try to clock out with incomplete required tasks
 */
export async function notifyChecklistStatus(
    userId: string,
    businessId: string,
    type: 'CLOCK_IN_REMINDER' | 'CLOCK_OUT_BLOCKED',
    shiftType: string,
    pendingCount: number
) {
    const title = type === 'CLOCK_IN_REMINDER' ? '📋 Shift Checklist' : '⚠️ Clock-Out Blocked';
    const message = type === 'CLOCK_IN_REMINDER'
        ? `You've clocked in for your ${shiftType} shift. You have ${pendingCount} task${pendingCount !== 1 ? 's' : ''} to complete — open the app to get started.`
        : `Clock-out blocked — you have ${pendingCount} required task${pendingCount !== 1 ? 's' : ''} to complete. Finish your checklist, then try again.`;

    await createNotification({
        business_id: businessId,
        user_ids: [userId],
        type: 'CHECKLIST_REMINDER',
        title,
        message,
        entity_id: null,
        entity_type: 'checklist'
    });
}

/**
 * Duplicates a checklist from one shift to another (used during roster copying).
 * Resets all statuses to 'pending' and clears completion data.
 */
export async function duplicateChecklist(
    sourceShiftId: string, 
    targetShiftId: string, 
    businessId: string, 
    supabase: SupabaseClient
) {
    try {
        const { data: sourceItems, error: fetchError } = await supabase
            .from('ShiftChecklistItem')
            .select('*')
            .eq('shift_id', sourceShiftId);

        if (fetchError) throw fetchError;
        if (!sourceItems || sourceItems.length === 0) return;

        const newItems: ShiftChecklistItemInsert[] = sourceItems.map(item => ({
            shift_id: targetShiftId,
            business_id: businessId,
            task_text: item.task_text,
            instructions: item.instructions,
            is_required: item.is_required,
            sort_order: item.sort_order,
            status: 'pending',
            reason: null,
            completed_by: null,
            completed_at: null,
            source_template_id: item.source_template_id,
            source_item_id: item.source_item_id
        }));

        const { error: insertError } = await supabase
            .from('ShiftChecklistItem')
            .insert(newItems);

        if (insertError) throw insertError;
    } catch (err) {
        console.error(`[ChecklistEngine] Failed to duplicate checklist from ${sourceShiftId} to ${targetShiftId}:`, err);
    }
}
