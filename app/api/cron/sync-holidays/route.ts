import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin'; // Use admin to bypass RLS for all businesses
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/cron/sync-holidays
 * 
 * Fetches AU Public Holidays for the current and next year and syncs them to our DB
 * Access: System/Cron (CRON_SECRET)
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Authorization check
        const authHeader = request.headers.get('Authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return errorResponse('Unauthorized', 401);
        }

        const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
        const supabase = createAdminClient();

        // 2. Fetch all businesses to know which states to sync for
        const { data: businesses } = await supabase
            .from('Business')
            .select('business_id, state');

        if (!businesses || businesses.length === 0) return successResponse([], 'No businesses found');

        let totalSynced = 0;

        for (const year of years) {
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
            if (!response.ok) continue;

            const holidays = await response.json();

            // The API returns holidays with 'counties' like ["AU-NSW", "AU-VIC"]
            // If counties is null, it's national.

            for (const business of businesses) {
                const bState = business.state.toUpperCase(); // e.g. 'NSW'
                const stateCode = `AU-${bState}`;

                const relevantHolidays = holidays.filter((h: any) => {
                    return !h.counties || h.counties.includes(stateCode);
                });

                if (relevantHolidays.length > 0) {
                    const insertData = relevantHolidays.map((h: any) => ({
                        business_id: business.business_id,
                        name: h.name,
                        date: h.date,
                        state: bState,
                        is_national: !h.counties,
                        year: year,
                        source: 'nager.at'
                    }));

                    const { error } = await supabase
                        .from('PublicHoliday')
                        .upsert(insertData, { onConflict: 'date,state,business_id' as any }); // Adjusted for uniqueness per business

                    if (!error) totalSynced += insertData.length;
                }
            }
        }

        return successResponse({ totalSynced }, 'Public holidays synced successfully');

    } catch (err) {
        console.error('Sync holidays error:', err);
        return errorResponse('Internal server error', 500);
    }
}
