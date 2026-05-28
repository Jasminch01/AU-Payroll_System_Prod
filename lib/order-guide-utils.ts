import { OrderGuideItem, StockStatus } from '@/types/database';

export interface SuggestedOrderResult {
    suggestedQty: number | null;
    stockStatus: StockStatus;
    orderRecommended: boolean;
}

/**
 * Calculate suggested order quantity using min/max logic.
 *
 *   Suggested Qty      = max_stock_qty - current_stock_qty
 *   Order recommended  = current_stock_qty <= min_stock_qty
 *
 * Returns null for suggestedQty if currentStock is null (not checked yet).
 */
export function calculateSuggestedQty(
    item: Pick<OrderGuideItem, 'min_stock_qty' | 'max_stock_qty' | 'default_order_qty'>,
    currentStock: number | null
): SuggestedOrderResult {
    if (currentStock === null) {
        return { suggestedQty: null, stockStatus: 'not_checked', orderRecommended: false };
    }

    const min = Number(item.min_stock_qty);
    const max = Number(item.max_stock_qty);

    const orderRecommended = currentStock <= min;
    const suggestedQty     = orderRecommended
        ? Math.max(0, max - currentStock)
        : item.default_order_qty ?? null;

    let stockStatus: StockStatus;
    if (currentStock <= 0)    stockStatus = 'out_of_stock';
    else if (currentStock <= min) stockStatus = 'low';
    else                      stockStatus = 'enough';

    return { suggestedQty, stockStatus, orderRecommended };
}
