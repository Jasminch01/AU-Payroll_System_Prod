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

        // 2. Update Roster Status
        const updateData: any = { 
            status: 'published',
            updated_at: new Date().toISOString()
        };

        // Only set published_at if it was draft
        if (roster.status === 'draft') {
            updateData.published_at = new Date().toISOString();
        }

        const { error: rosterUpdateError } = await supabase
            .from('Roster')
            .update(updateData)
            .eq('roster_id', id);

        if (rosterUpdateError) return errorResponse(rosterUpdateError.message, 400);

        // 3. Update all associated shifts to 'published'
        const { error: shiftUpdateError } = await supabase
            .from('Shift')
            .update({ shift_status: 'published' })
            .eq('roster_id', id);

        if (shiftUpdateError) return errorResponse(shiftUpdateError.message, 400);

        // 4. Send Notifications
        const previousPublishTime = roster.published_at;
        await notifyRosterPublished(id, authUser.business_id, authUser.user_id, previousPublishTime);

        return successResponse({ message: 'Roster and all shifts published successfully' });
    } catch (error: any) {
        console.error('Error publishing roster:', error);
        return errorResponse(error.message || 'Internal Server Error', 500);
    }
}
