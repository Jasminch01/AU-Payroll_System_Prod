import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { generateDailyOrderTasks } from '@/lib/order-guide-engine';
import { calculateSuggestedQty } from '@/lib/order-guide-utils';
import { format } from 'date-fns';

/**
 * GET /api/daily-orders
 * Returns today's (or a given date's) order tasks grouped by category.
 * Access: Owner, Manager
 *
 * Query params:
 *   date        — 'YYYY-MM-DD' (defaults to today)
 *   category_id — filter to one category
 *   status      — filter by order_status
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager', 'employee');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const date       = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd');
        const categoryId = searchParams.get('category_id');
        const status     = searchParams.get('status');

        const supabase = await createClient();

        let query = supabase
            .from('DailyOrderTask')
            .select(`
                *,
                category:OrderCategory(category_id, category_name, cutoff_time, sort_order),
                item:OrderGuideItem(
                    item_id, product_name, unit,
                    min_stock_qty, max_stock_qty, default_order_qty,
                    ordering_method, ordering_instruction, comment
                ),
                supplier:OrderSupplier(supplier_id, supplier_name, phone, portal_url, ordering_method),
                ordered_by_user:ordered_by(user_id, first_name, last_name)
            `)
            .eq('business_id', authUser.business_id)
            .eq('order_date', date)
            .order('category_id', { ascending: true });

        if (categoryId) query = query.eq('category_id', categoryId);
        if (status)     query = query.eq('order_status', status);

        const { data: tasks, error } = await query;
        if (error) return errorResponse(error.message, 400);

        // Filter Liquor tasks for managers without permission
        const filteredTasks = (tasks ?? []).filter(t => {
            const catName = (t.category as any)?.category_name ?? '';
            if (!catName.toLowerCase().includes('liquor')) return true;
            return authUser.role === 'owner' || authUser.can_order_liquor;
        });

        // Group by category for the UI
        const grouped = groupByCategory(filteredTasks);

        return successResponse({ date, tasks: filteredTasks, grouped });
    } catch (err) {
        console.error('[daily-orders GET]', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/daily-orders
 * Generate today's order tasks for the business.
 * Can be triggered by a manager manually or by the clock-in handler.
 * Idempotent — safe to call multiple times.
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json().catch(() => ({}));
        const date    = body.date    ?? format(new Date(), 'yyyy-MM-dd');
        const shiftId = body.shift_id ?? undefined;

        const supabase = await createClient();
        const result   = await generateDailyOrderTasks(
            authUser.business_id,
            date,
            supabase,
            shiftId
        );

        return successResponse(result, `Generated ${result.created} task(s) for ${date}`);
    } catch (err) {
        console.error('[daily-orders POST]', err);
        return errorResponse('Internal server error', 500);
    }
}

// ── Helper ────────────────────────────────────────────────────

function groupByCategory(tasks: any[]) {
    const map: Record<string, {
        category_id: string;
        category_name: string;
        cutoff_time: string | null;
        sort_order: number;
        tasks: any[];
        stats: { pending: number; ordered: number; not_required: number; issue: number };
    }> = {};

    for (const task of tasks) {
        const cat     = task.category ?? {};
        const catId   = cat.category_id ?? task.category_id;
        const catName = cat.category_name ?? 'Unknown';

        if (!map[catId]) {
            map[catId] = {
                category_id:   catId,
                category_name: catName,
                cutoff_time:   cat.cutoff_time ?? null,
                sort_order:    cat.sort_order  ?? 0,
                tasks:         [],
                stats:         { pending: 0, ordered: 0, not_required: 0, issue: 0 },
            };
        }
        map[catId].tasks.push(task);
        const s = task.order_status as string;
        if (s in map[catId].stats) (map[catId].stats as any)[s]++;
    }

    return Object.values(map).sort((a, b) => a.sort_order - b.sort_order);
}
