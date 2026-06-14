import { SupabaseClient } from '@supabase/supabase-js';
import { ChecklistTemplateItem, ShiftChecklistItemInsert, ShiftChecklistItemStatus } from '@/types/database';
import { createNotification } from '@/lib/notifications';
import { validateOrderCompletion } from './order-guide-engine';
import { getBusinessTimezone } from '@/lib/auth';
import { getDateInTimezone, getTimeInTimezone } from '@/lib/timezone-utils';

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
    pendingCount: number,
    shiftId?: string
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
        entity_id: shiftId || null,
        entity_type: 'shift',
        link_url: shiftId ? `/shifts?shiftId=${shiftId}` : '/shifts'
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

/**
 * Validates if an employee can clock out based on daily ordering requirements.
 * Delegated to the order guide engine.
 */
export async function validateClockOutOrdering(
    shiftId: string,
    businessId: string,
    date: string,
    supabase: SupabaseClient
) {
    return validateOrderCompletion(businessId, date, shiftId, supabase);
}

/**
 * Synchronize a new template task to all active/modifiable shifts that should have this template.
 */
export async function syncTemplateItemInsert(
    itemId: string,
    businessId: string,
    supabase: SupabaseClient,
    itemData?: ChecklistTemplateItem
) {
    try {
        let item = itemData;
        if (!item) {
            const { data, error } = await supabase
                .from('ChecklistTemplateItem')
                .select('*')
                .eq('item_id', itemId)
                .single();
            if (error || !data) {
                console.error('[ChecklistEngine] Template item not found for sync insert:', itemId);
                return;
            }
            item = data;
        }

        if (!item) return;
        if (!item.is_active) return;

        // Fetch modifiable shifts
        const tz = await getBusinessTimezone(businessId);
        const nowStr = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(nowStr, tz);
        const nowBusinessTime = getTimeInTimezone(nowStr, tz);
        const nowBusinessTimestamp = `${nowBusinessDate}T${nowBusinessTime}:00`;

        const { data: shifts, error: shiftsError } = await supabase
            .from('Shift')
            .select('shift_id, shift_status, start_time, end_time, shift_type')
            .eq('business_id', businessId)
            .or(`shift_status.eq.draft,end_time.gte.${nowBusinessTimestamp}`);

        if (shiftsError || !shifts || shifts.length === 0) return;

        const modifiableShifts = shifts.filter(s => {
            if (s.shift_status === 'draft') return true;
            if (s.shift_status === 'published' && nowBusinessTimestamp < s.start_time) return true;
            return false;
        });

        if (modifiableShifts.length === 0) return;

        const modifiableShiftIds = modifiableShifts.map(s => s.shift_id);

        // Fetch default mapping for this template
        const { data: defaultMappings } = await supabase
            .from('ShiftTypeTemplateDefault')
            .select('shift_type')
            .eq('business_id', businessId)
            .eq('template_id', item.template_id);

        const defaultShiftTypes = new Set((defaultMappings || []).map(m => m.shift_type.toLowerCase()));

        // Fetch manual attachments
        const { data: manualShifts } = await supabase
            .from('ShiftChecklistItem')
            .select('shift_id')
            .eq('source_template_id', item.template_id)
            .in('shift_id', modifiableShiftIds);

        const shiftsWithTemplate = new Set((manualShifts || []).map(ms => ms.shift_id));

        const shiftsToInsert = modifiableShifts.filter(s => {
            return defaultShiftTypes.has(s.shift_type.toLowerCase()) || shiftsWithTemplate.has(s.shift_id);
        });

        if (shiftsToInsert.length > 0) {
            for (const shift of shiftsToInsert) {
                // Double check to prevent duplicate key
                const { data: exists } = await supabase
                    .from('ShiftChecklistItem')
                    .select('checklist_item_id')
                    .eq('shift_id', shift.shift_id)
                    .eq('source_item_id', item.item_id)
                    .maybeSingle();

                if (exists) continue;

                const { data: lastItem } = await supabase
                    .from('ShiftChecklistItem')
                    .select('sort_order')
                    .eq('shift_id', shift.shift_id)
                    .order('sort_order', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

                await supabase
                    .from('ShiftChecklistItem')
                    .insert({
                        shift_id: shift.shift_id,
                        business_id: businessId,
                        task_text: item.task_text,
                        instructions: item.instructions,
                        is_required: item.is_required,
                        sort_order: newSortOrder,
                        status: 'pending',
                        source_template_id: item.template_id,
                        source_item_id: item.item_id
                    });
            }
        }
    } catch (err) {
        console.error('[ChecklistEngine] Error syncing template item insert:', err);
    }
}

/**
 * Synchronize template task updates/deactivation to active/modifiable shifts.
 */
export async function syncTemplateItemUpdate(
    itemId: string,
    businessId: string,
    supabase: SupabaseClient,
    itemData?: ChecklistTemplateItem
) {
    try {
        let item = itemData;
        if (!item) {
            const { data, error } = await supabase
                .from('ChecklistTemplateItem')
                .select('*')
                .eq('item_id', itemId)
                .single();
            if (error || !data) {
                console.error('[ChecklistEngine] Template item not found for sync update:', itemId);
                return;
            }
            item = data;
        }

        if (!item) return;

        // Fetch modifiable shifts
        const tz = await getBusinessTimezone(businessId);
        const nowStr = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(nowStr, tz);
        const nowBusinessTime = getTimeInTimezone(nowStr, tz);
        const nowBusinessTimestamp = `${nowBusinessDate}T${nowBusinessTime}:00`;

        const { data: shifts, error: shiftsError } = await supabase
            .from('Shift')
            .select('shift_id, shift_status, start_time, end_time, shift_type')
            .eq('business_id', businessId)
            .or(`shift_status.eq.draft,end_time.gte.${nowBusinessTimestamp}`);

        if (shiftsError || !shifts || shifts.length === 0) return;

        const modifiableShifts = shifts.filter(s => {
            if (s.shift_status === 'draft') return true;
            if (s.shift_status === 'published' && nowBusinessTimestamp < s.start_time) return true;
            return false;
        });

        if (modifiableShifts.length === 0) return;

        const modifiableShiftIds = modifiableShifts.map(s => s.shift_id);

        if (!item.is_active) {
            // Delete from modifiable shifts if deactivated
            await supabase
                .from('ShiftChecklistItem')
                .delete()
                .eq('source_item_id', itemId)
                .in('shift_id', modifiableShiftIds);
        } else {
            // Update existing checklist items in modifiable shifts
            await supabase
                .from('ShiftChecklistItem')
                .update({
                    task_text: item.task_text,
                    instructions: item.instructions,
                    is_required: item.is_required,
                    sort_order: item.sort_order
                })
                .eq('source_item_id', itemId)
                .in('shift_id', modifiableShiftIds);

            // Reactivate/Add if shift should have template but does not have this item
            const { data: existingItems } = await supabase
                .from('ShiftChecklistItem')
                .select('shift_id')
                .eq('source_item_id', itemId)
                .in('shift_id', modifiableShiftIds);

            const shiftsWithItem = new Set((existingItems || []).map(ei => ei.shift_id));

            // Fetch default mapping
            const { data: defaultMappings } = await supabase
                .from('ShiftTypeTemplateDefault')
                .select('shift_type')
                .eq('business_id', businessId)
                .eq('template_id', item.template_id);

            const defaultShiftTypes = new Set((defaultMappings || []).map(m => m.shift_type.toLowerCase()));

            // Fetch manual attachments
            const { data: manualShifts } = await supabase
                .from('ShiftChecklistItem')
                .select('shift_id')
                .eq('source_template_id', item.template_id)
                .in('shift_id', modifiableShiftIds);

            const shiftsWithTemplate = new Set((manualShifts || []).map(ms => ms.shift_id));

            const shiftsToInsert = modifiableShifts.filter(s => {
                const isMappedDefault = defaultShiftTypes.has(s.shift_type.toLowerCase());
                const isManuallyAttached = shiftsWithTemplate.has(s.shift_id);
                const hasItemAlready = shiftsWithItem.has(s.shift_id);
                return (isMappedDefault || isManuallyAttached) && !hasItemAlready;
            });

            if (shiftsToInsert.length > 0) {
                for (const shift of shiftsToInsert) {
                    const { data: lastItem } = await supabase
                        .from('ShiftChecklistItem')
                        .select('sort_order')
                        .eq('shift_id', shift.shift_id)
                        .order('sort_order', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    const newSortOrder = (lastItem?.sort_order ?? -1) + 1;

                    await supabase
                        .from('ShiftChecklistItem')
                        .insert({
                            shift_id: shift.shift_id,
                            business_id: businessId,
                            task_text: item.task_text,
                            instructions: item.instructions,
                            is_required: item.is_required,
                            sort_order: newSortOrder,
                            status: 'pending',
                            source_template_id: item.template_id,
                            source_item_id: item.item_id
                        });
                }
            }
        }
    } catch (err) {
        console.error('[ChecklistEngine] Error syncing template item update:', err);
    }
}

/**
 * Delete a template item from modifiable shifts, and nullify references for history.
 */
export async function syncTemplateItemDelete(
    itemId: string,
    businessId: string,
    supabase: SupabaseClient
) {
    try {
        // Fetch modifiable shifts
        const tz = await getBusinessTimezone(businessId);
        const nowStr = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(nowStr, tz);
        const nowBusinessTime = getTimeInTimezone(nowStr, tz);
        const nowBusinessTimestamp = `${nowBusinessDate}T${nowBusinessTime}:00`;

        const { data: shifts, error: shiftsError } = await supabase
            .from('Shift')
            .select('shift_id, shift_status, start_time, end_time')
            .eq('business_id', businessId)
            .or(`shift_status.eq.draft,end_time.gte.${nowBusinessTimestamp}`);

        if (shiftsError || !shifts) {
            console.error('[ChecklistEngine] Failed to fetch shifts for delete sync:', shiftsError);
            return;
        }

        const modifiableShifts = shifts.filter(s => {
            if (s.shift_status === 'draft') return true;
            if (s.shift_status === 'published' && nowBusinessTimestamp < s.start_time) return true;
            return false;
        });

        const modifiableShiftIds = modifiableShifts.map(s => s.shift_id);

        if (modifiableShiftIds.length > 0) {
            // Delete from modifiable shifts
            await supabase
                .from('ShiftChecklistItem')
                .delete()
                .eq('source_item_id', itemId)
                .in('shift_id', modifiableShiftIds);
        }

        // Set source_item_id to null for historical shifts to satisfy FK constraints when template item is deleted
        await supabase
                .from('ShiftChecklistItem')
                .update({ source_item_id: null })
                .eq('source_item_id', itemId);
    } catch (err) {
        console.error('[ChecklistEngine] Error syncing template item delete:', err);
    }
}

/**
 * Bulk synchronize template items to modifiable shifts.
 */
export async function syncTemplateItemsBulk(
    items: ChecklistTemplateItem[],
    businessId: string,
    supabase: SupabaseClient
) {
    for (const item of items) {
        await syncTemplateItemUpdate(item.item_id, businessId, supabase, item);
    }
}


