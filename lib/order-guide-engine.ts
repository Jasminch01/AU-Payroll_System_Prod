import { SupabaseClient } from '@supabase/supabase-js';
import { DailyOrderTaskInsert, OrderGuideItem, StockStatus } from '@/types/database';
import { createNotification } from '@/lib/notifications';

/**
 * Core engine for the Product Order Guide module.
 * Follows the same pattern as checklist-engine.ts.
 */

// ─────────────────────────────────────────────────────────────
// 1. Min/Max calculation logic (moved to order-guide-utils.ts)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 2. Auto-detect if a shift has ordering responsibility
// ─────────────────────────────────────────────────────────────

/**
 * Checks if a rostered shift has an ordering task by looking at its
 * checklist items and their source template categories.
 *
 * Auto-detect rule: if any source template has category = 'ordering'
 * (case-insensitive), the shift is considered to have ordering responsibility.
 *
 * No flag needed on Shift — this is derived from the template data.
 */
export async function detectShiftHasOrdering(
    shiftId: string,
    supabase: SupabaseClient
): Promise<boolean> {
    try {
        // Get all distinct source_template_ids used on this shift
        const { data: shiftItems, error } = await supabase
            .from('ShiftChecklistItem')
            .select('source_template_id')
            .eq('shift_id', shiftId)
            .not('source_template_id', 'is', null);

        if (error || !shiftItems || shiftItems.length === 0) return false;

        const templateIds = [...new Set(
            shiftItems
                .map(i => i.source_template_id)
                .filter(Boolean)
        )];

        if (templateIds.length === 0) return false;

        // Check if any of those templates has category = 'ordering'
        const { data: templates, error: tplError } = await supabase
            .from('ChecklistTemplate')
            .select('template_id, category')
            .in('template_id', templateIds);

        if (tplError || !templates) return false;

        return templates.some(t =>
            typeof t.category === 'string' &&
            t.category.toLowerCase() === 'ordering'
        );
    } catch (err) {
        console.error('[OrderGuideEngine] detectShiftHasOrdering error:', err);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// 3. Generate daily order tasks (idempotent)
// ─────────────────────────────────────────────────────────────

/**
 * Generates DailyOrderTask rows for a given date and business.
 * Only creates tasks for:
 *   - Active categories
 *   - Active products
 *   - Products whose order_days includes today (or order_frequency = 'daily')
 *
 * Idempotent: skips products that already have a task for today
 * (enforced by UNIQUE constraint on business_id + item_id + order_date).
 *
 * Optionally links tasks to a specific shift_id.
 */
export async function generateDailyOrderTasks(
    businessId: string,
    date: string,          // 'YYYY-MM-DD'
    supabase: SupabaseClient,
    shiftId?: string
): Promise<{ created: number; skipped: number }> {
    try {
        const dayName = getDayAbbreviation(new Date(date));

        // Load all active categories with their active products
        const { data: categories, error: catError } = await supabase
            .from('OrderCategory')
            .select(`
                category_id,
                order_days,
                default_supplier_id,
                items:OrderGuideItem(
                    item_id,
                    supplier_id,
                    order_frequency,
                    order_days,
                    min_stock_qty,
                    max_stock_qty,
                    default_order_qty,
                    is_active
                )
            `)
            .eq('business_id', businessId)
            .eq('is_active', true);

        if (catError) throw catError;
        if (!categories || categories.length === 0) {
            return { created: 0, skipped: 0 };
        }

        const tasksToInsert: DailyOrderTaskInsert[] = [];

        for (const cat of categories) {
            const items = (cat.items as any[]) || [];

            for (const item of items) {
                if (!item.is_active) continue;
                if (!shouldOrderToday(item, cat, dayName)) continue;

                // We set supplier_id to null because the database constraint DailyOrderTask_supplier_id_fkey
                // references the empty/unused Supplier table instead of OrderSupplier.
                // The API route resolves the supplier dynamically from the item or category.
                tasksToInsert.push({
                    business_id:       businessId,
                    order_date:        date,
                    category_id:       cat.category_id,
                    item_id:           item.item_id,
                    supplier_id:       null,
                    suggested_qty:     null,   // Calculated when manager enters stock qty
                    current_stock_qty: null,
                    final_qty:         null,
                    stock_status:      'not_checked',
                    order_status:      'pending',
                    ordered_by:        null,
                    ordered_at:        null,
                    comment_reason:    null,
                    order_reference:   null,
                    shift_id:          shiftId ?? null,
                });
            }
        }

        if (tasksToInsert.length === 0) {
            return { created: 0, skipped: 0 };
        }

        // Check which tasks already exist for this business and date
        const { data: existingTasks, error: existError } = await supabase
            .from('DailyOrderTask')
            .select('item_id')
            .eq('business_id', businessId)
            .eq('order_date', date);

        if (existError) throw existError;

        const existingItemIds = new Set((existingTasks || []).map(t => t.item_id));

        // Filter out items that already have a task
        const newTasks = tasksToInsert.filter(task => !existingItemIds.has(task.item_id));

        let created = 0;
        if (newTasks.length > 0) {
            const { data: inserted, error: insertError } = await supabase
                .from('DailyOrderTask')
                .insert(newTasks)
                .select('order_task_id');

            if (insertError) throw insertError;
            created = inserted?.length ?? 0;
        }

        const skipped = tasksToInsert.length - newTasks.length;

        console.log(`[OrderGuideEngine] Generated ${created} tasks for ${date} (${skipped} already existed)`);
        return { created, skipped };
    } catch (err) {
        console.error('[OrderGuideEngine] generateDailyOrderTasks error:', err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────
// 4. Validate order completion before clock-out
// ─────────────────────────────────────────────────────────────

export interface OrderCompletionResult {
    hasOrderingTasks: boolean;  // False if shift has no ordering responsibility
    blocked: boolean;           // True if required tasks are still pending
    pendingCount: number;
    pendingCategories: string[];
}

/**
 * Checks if all DailyOrderTask rows for a given shift/date are in a
 * terminal state (ordered, not_required, or issue with reason).
 *
 * Returns blocked = false if the shift has no ordering tasks at all.
 * Non-blocking: returns the count so the UI can warn without hard-blocking.
 */
export async function validateOrderCompletion(
    businessId: string,
    date: string,
    shiftId: string,
    supabase: SupabaseClient
): Promise<OrderCompletionResult> {
    try {
        const hasOrdering = await detectShiftHasOrdering(shiftId, supabase);
        if (!hasOrdering) {
            return { hasOrderingTasks: false, blocked: false, pendingCount: 0, pendingCategories: [] };
        }

        const { data: tasks, error } = await supabase
            .from('DailyOrderTask')
            .select(`
                order_status,
                comment_reason,
                category:OrderCategory(category_name)
            `)
            .eq('business_id', businessId)
            .eq('order_date', date)
            .eq('shift_id', shiftId);

        if (error) throw error;
        if (!tasks || tasks.length === 0) {
            return { hasOrderingTasks: true, blocked: false, pendingCount: 0, pendingCategories: [] };
        }

        const pendingTasks = tasks.filter(t => {
            if (t.order_status === 'pending') return true;
            // Issue without a reason counts as still pending
            if (t.order_status === 'issue' && (!t.comment_reason || t.comment_reason.trim() === '')) return true;
            return false;
        });

        const pendingCategories = [...new Set(
            pendingTasks
                .map(t => (t.category as any)?.category_name)
                .filter(Boolean)
        )];

        return {
            hasOrderingTasks: true,
            blocked: pendingTasks.length > 0,
            pendingCount: pendingTasks.length,
            pendingCategories,
        };
    } catch (err) {
        console.error('[OrderGuideEngine] validateOrderCompletion error:', err);
        return { hasOrderingTasks: false, blocked: false, pendingCount: 0, pendingCategories: [] };
    }
}

// ─────────────────────────────────────────────────────────────
// 5. Notifications
// ─────────────────────────────────────────────────────────────

/**
 * Sends an ORDER_REMINDER or ORDER_CUTOFF_REMINDER notification
 * to a user (manager/owner).
 */
export async function notifyOrderStatus(
    userId: string,
    businessId: string,
    type: 'clock_in' | 'clock_out' | 'cutoff',
    context?: { pendingCount?: number; categories?: string[] }
) {
    const pending = context?.pendingCount ?? 0;
    const cats    = context?.categories?.join(', ') ?? '';

    const configs = {
        clock_in: {
            notifType: 'ORDER_REMINDER' as const,
            title:   '📦 Ordering Tasks',
            message: `You have ordering tasks to complete today. Open Today\'s Orders to get started.`,
        },
        clock_out: {
            notifType: 'ORDER_REMINDER' as const,
            title:   '⚠️ Orders Incomplete',
            message: `You have ${pending} pending order${pending !== 1 ? 's' : ''} (${cats}). Please mark each as Ordered, Not Required, or Issue before clocking out.`,
        },
        cutoff: {
            notifType: 'ORDER_CUTOFF_REMINDER' as const,
            title:   '⏰ Supplier Cut-Off Soon',
            message: `Reminder: Some orders are still pending before cut-off time${cats ? ` — ${cats}` : ''}.`,
        },
    };

    const { notifType, title, message } = configs[type];

    await createNotification({
        business_id:  businessId,
        user_ids:     [userId],
        type:         notifType,
        title,
        message,
        entity_type:  'order',
        entity_id:    null,
        link_url:     '/manager/order-guide',
    });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Returns 3-letter day abbreviation: Mon, Tue, Wed, Thu, Fri, Sat, Sun */
function getDayAbbreviation(date: Date): string {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];
}

/**
 * Determines if a product should be ordered today based on its frequency
 * and the category's order_days fallback.
 */
function shouldOrderToday(
    item: Pick<OrderGuideItem, 'order_frequency' | 'order_days'>,
    category: { order_days: string[] | null },
    todayAbbr: string
): boolean {
    switch (item.order_frequency) {
        case 'daily':
            return true;
        case 'manual':
            return false;
        case 'specific_days': {
            const days = item.order_days ?? category.order_days ?? [];
            return days.includes(todayAbbr);
        }
        case 'weekly': {
            // For weekly items, respect the product's or category's order_days
            const days = item.order_days ?? category.order_days ?? [];
            return days.length > 0 ? days.includes(todayAbbr) : true;
        }
        default:
            return false;
    }
}
