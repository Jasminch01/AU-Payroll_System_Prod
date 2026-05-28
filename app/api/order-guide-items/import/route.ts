import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import * as XLSX from 'xlsx';

/**
 * POST /api/order-guide-items/import
 *
 * Accepts either:
 *   A) A multipart form with an .xlsx file (field: "file")
 *   B) A JSON body with { google_sheets_url: string }
 *      → Fetches the public sheet as xlsx via Google export URL
 *
 * Each spreadsheet TAB is treated as a product category.
 * Required columns per tab: product_name, min_stock_qty, max_stock_qty, unit
 * Optional: default_order_qty, supplier_name, order_days, ordering_method,
 *           ordering_instruction, comment, is_active
 *
 * Access: Owner, Manager
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const contentType = request.headers.get('content-type') ?? '';
        let workbook: XLSX.WorkBook;

        // ── A: xlsx file upload ─────────────────────────────────
        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) return errorResponse('No file provided', 400);
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                return errorResponse('Only .xlsx or .xls files are supported', 400);
            }
            const buffer = await file.arrayBuffer();
            workbook = XLSX.read(buffer, { type: 'buffer' });
        }
        // ── B: Google Sheets public URL ─────────────────────────
        else {
            const body = await request.json();
            if (!body.google_sheets_url) {
                return errorResponse('Provide a file upload or google_sheets_url', 400);
            }

            // Convert share URL to xlsx export URL
            const exportUrl = toGoogleSheetsExportUrl(body.google_sheets_url);
            if (!exportUrl) {
                return errorResponse(
                    'Invalid Google Sheets URL. Make sure the sheet is shared publicly.',
                    400
                );
            }

            const res = await fetch(exportUrl);
            if (!res.ok) {
                return errorResponse(
                    'Could not fetch the Google Sheet. Make sure it is shared as "Anyone with the link can view".',
                    400
                );
            }
            const buffer = await res.arrayBuffer();
            workbook = XLSX.read(buffer, { type: 'buffer' });
        }

        const supabase   = await createClient();
        const sheetNames = workbook.SheetNames;

        const results: {
            category: string;
            created: number;
            skipped: number;
            errors: string[];
        }[] = [];

        for (const sheetName of sheetNames) {
            const sheet   = workbook.Sheets[sheetName];
            const rows    = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
            const catName = sheetName.trim();
            const errors: string[] = [];
            let created = 0;
            let skipped = 0;

            if (rows.length === 0) {
                results.push({ category: catName, created: 0, skipped: 0, errors: ['Sheet is empty'] });
                continue;
            }

            // Upsert category (create if not exists)
            const { data: category, error: catError } = await supabase
                .from('OrderCategory')
                .upsert(
                    {
                        business_id:   authUser.business_id,
                        category_name: catName,
                        is_active:     true,
                    },
                    { onConflict: 'business_id,category_name', ignoreDuplicates: false }
                )
                .select('category_id')
                .single();

            if (catError || !category) {
                results.push({ category: catName, created: 0, skipped: 0, errors: [`Failed to create category: ${catError?.message}`] });
                continue;
            }

            const categoryId = category.category_id;

            for (let i = 0; i < rows.length; i++) {
                const row     = rows[i];
                const rowNum  = i + 2; // row 1 = header

                const productName = String(row['product_name'] ?? row['Product Name'] ?? '').trim();
                const unit        = String(row['unit']         ?? row['Unit']         ?? '').trim();
                const minQty      = parseNumeric(row['min_stock_qty'] ?? row['Min Stock Qty'] ?? row['Min Qty']);
                const maxQty      = parseNumeric(row['max_stock_qty'] ?? row['Max Stock Qty'] ?? row['Max Qty']);

                // Validate required fields
                const rowErrors: string[] = [];
                if (!productName)         rowErrors.push('product_name is required');
                if (!unit)                rowErrors.push('unit is required');
                if (minQty === null)      rowErrors.push('min_stock_qty is required');
                if (maxQty === null)      rowErrors.push('max_stock_qty is required');
                if (maxQty !== null && minQty !== null && maxQty < minQty) {
                    rowErrors.push('max_stock_qty must be >= min_stock_qty');
                }

                if (rowErrors.length > 0) {
                    errors.push(`Row ${rowNum} (${productName || 'unnamed'}): ${rowErrors.join(', ')}`);
                    skipped++;
                    continue;
                }

                // Resolve optional supplier by name
                let supplierId: string | null = null;
                const supplierName = String(row['supplier'] ?? row['Supplier'] ?? '').trim();
                if (supplierName) {
                    const { data: supplier } = await supabase
                        .from('OrderSupplier')
                        .select('supplier_id')
                        .eq('business_id', authUser.business_id)
                        .ilike('supplier_name', supplierName)
                        .maybeSingle();
                    supplierId = supplier?.supplier_id ?? null;
                }

                // Parse order_days e.g. "Mon,Wed,Fri"
                const orderDaysRaw = String(row['order_days'] ?? row['Order Days'] ?? '').trim();
                const orderDays    = orderDaysRaw
                    ? orderDaysRaw.split(/[,;/]+/).map(d => d.trim()).filter(Boolean)
                    : null;

                const isActiveRaw = String(row['is_active'] ?? row['Active'] ?? 'true').trim().toLowerCase();
                const isActive    = isActiveRaw !== 'false' && isActiveRaw !== 'no' && isActiveRaw !== '0';

                const { error: insertError } = await supabase
                    .from('OrderGuideItem')
                    .upsert(
                        {
                            business_id:          authUser.business_id,
                            category_id:          categoryId,
                            supplier_id:          supplierId,
                            product_name:         productName,
                            min_stock_qty:        minQty!,
                            max_stock_qty:        maxQty!,
                            default_order_qty:    parseNumeric(row['default_order_qty'] ?? row['Default Order Qty']),
                            unit,
                            order_frequency:      (String(row['order_frequency'] ?? row['Order Frequency'] ?? 'daily').trim().toLowerCase() as any) || 'daily',
                            order_days:           orderDays,
                            ordering_method:      String(row['ordering_method'] ?? row['Ordering Method'] ?? '').trim() || null,
                            ordering_instruction: String(row['ordering_instruction'] ?? row['Ordering Instruction'] ?? '').trim() || null,
                            comment:              String(row['comment'] ?? row['Comment'] ?? '').trim() || null,
                            is_active:            isActive,
                            sort_order:           i,
                        },
                        { onConflict: 'business_id,category_id,product_name' as any, ignoreDuplicates: false }
                    );

                if (insertError) {
                    errors.push(`Row ${rowNum} (${productName}): ${insertError.message}`);
                    skipped++;
                } else {
                    created++;
                }
            }

            results.push({ category: catName, created, skipped, errors });
        }

        const totalCreated = results.reduce((s, r) => s + r.created, 0);
        const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

        return successResponse(
            { results, totalCreated, totalSkipped },
            `Import complete: ${totalCreated} item(s) imported across ${sheetNames.length} category(ies)`
        );
    } catch (err) {
        console.error('[order-guide-items/import POST]', err);
        return errorResponse('Internal server error', 500);
    }
}

// ── Helpers ───────────────────────────────────────────────────

function parseNumeric(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
}

function toGoogleSheetsExportUrl(url: string): string | null {
    // Match: https://docs.google.com/spreadsheets/d/{id}/...
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const sheetId = match[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}
