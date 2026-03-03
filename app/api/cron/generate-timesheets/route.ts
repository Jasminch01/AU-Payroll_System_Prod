import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { generateTimesheets } from '@/lib/timesheet-engine';

/**
 * GET /api/cron/generate-timesheets
 * 
 * Scheduled task to automatically generate timesheets for "Yesterday"
 * Access: System/Cron (CRON_SECRET)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authorization check (Example: check for CRON_SECRET header)
        const authHeader = request.headers.get('Authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return errorResponse('Unauthorized', 401);
        }

        const supabase = await createClient();

        // 2. Fetch all active businesses
        const { data: businesses } = await supabase
            .from('Business')
            .select('business_id');

        if (!businesses) return successResponse([], 'No businesses found');

        // 3. Determine "Yesterday" range
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        let totalGenerated = 0;

        // 4. Process each business
        // Note: In production, you'd likely use a queue or parallelize this
        for (const business of businesses) {
            const timesheets = await generateTimesheets(
                business.business_id,
                dateStr,
                dateStr
            );

            if (timesheets.length > 0) {
                const { error } = await supabase
                    .from('TimeSheet')
                    .upsert(timesheets, { onConflict: 'employee_id,date' });

                if (!error) totalGenerated += timesheets.length;
            }
        }

        return successResponse({ totalGenerated, date: dateStr }, 'Cron job completed successfully');

    } catch (err) {
        console.error('Cron timesheets error:', err);
        return errorResponse('Internal server error', 500);
    }
}
