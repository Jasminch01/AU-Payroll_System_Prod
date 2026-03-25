import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Syncs public holidays for a specific business from the 3rd party API.
 */
export async function syncBusinessHolidays(businessId: string, state: string) {
    const years = [new Date().getFullYear(), new Date().getFullYear() + 1];
    const supabase = createAdminClient();
    const bState = state.toUpperCase();
    const stateCode = `AU-${bState}`;

    let totalSynced = 0;

    for (const year of years) {
        try {
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`);
            if (!response.ok) continue;

            const holidays = await response.json();

            const relevantHolidays = holidays.filter((h: any) => {
                return !h.counties || h.counties.includes(stateCode);
            });

            if (relevantHolidays.length > 0) {
                const insertData = relevantHolidays.map((h: any) => ({
                    business_id: businessId,
                    name: h.name,
                    date: h.date,
                    state: bState,
                    is_national: !h.counties,
                    year: year,
                    source: 'nager.at'
                }));

                const { error } = await supabase
                    .from('PublicHoliday')
                    .upsert(insertData, { onConflict: 'date,state,business_id' as any });

                if (!error) totalSynced += insertData.length;
            }
        } catch (err) {
            console.error(`Error syncing holidays for year ${year}:`, err);
        }
    }

    return totalSynced;
}
