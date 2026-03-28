import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { notifyRosterPublished } from '@/lib/notifications';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/rosters/[id]/publish
 * Publishes all draft shifts within a roster and updates roster status.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        // 1. Check roster exists
        const { data: roster, error: findError } = await supabase
            .from('Roster')
            .select('*')
            .eq('roster_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !roster) return errorResponse('Roster not found', 404);

        // 2. Fetch ONLY the draft shifts BEFORE updating status.
        //    These are the shifts being published for the first time.
        //    We capture them now so the notification logic knows exactly who to notify.
        const { data: draftShifts } = await supabase
            .from('Shift')
            .select('*, Employee:employee_id(email, first_name, user_id)')
            .eq('roster_id', id)
            .eq('shift_status', 'draft');

        // 3. Update Roster Status
        const updateData: any = { 
            status: 'published',
            updated_at: new Date().toISOString()
        };

        // Only set published_at if it was draft (first publish)
        if (roster.status === 'draft') {
            updateData.published_at = new Date().toISOString();
        }

        const { error: rosterUpdateError } = await supabase
            .from('Roster')
            .update(updateData)
            .eq('roster_id', id);

        if (rosterUpdateError) return errorResponse(rosterUpdateError.message, 400);

        // 4. Update only the draft shifts to 'published'
        if (draftShifts && draftShifts.length > 0) {
            const draftIds = draftShifts.map((s: any) => s.shift_id);
            const { error: shiftUpdateError } = await supabase
                .from('Shift')
                .update({ shift_status: 'published' })
                .in('shift_id', draftIds);

            if (shiftUpdateError) return errorResponse(shiftUpdateError.message, 400);

            // 5. Send notifications only for the newly published (previously draft) shifts
            await notifyRosterPublished(id, authUser.business_id, authUser.user_id, draftShifts);
        }

        return successResponse({ message: 'Roster and all shifts published successfully' });
    } catch (error: any) {
        console.error('Error publishing roster:', error);
        return errorResponse(error.message || 'Internal Server Error', 500);
    }
}
