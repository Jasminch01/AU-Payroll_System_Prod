import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

import { notifyRosterPublished } from '@/lib/notifications';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/rosters/[id]
 * 
 * Get a specific roster with shifts
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: roster, error } = await supabase
            .from('Roster')
            .select(`
        *,
        Shift (
          *,
          Employee:employee_id ( employee_id, first_name, last_name, role_title )
        )
      `)
            .eq('roster_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !roster) return errorResponse('Roster not found', 404);

        return successResponse(roster);
    } catch (err) {
        console.error('Get roster error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/rosters/[id]
 * 
 * Update roster dates or publish it
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "start_date": "2026-03-03",
 *   "end_date": "2026-03-09",
 *   "status": "published"
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Check roster exists and belongs to this business
        const { data: existing, error: findError } = await supabase
            .from('Roster')
            .select('*')
            .eq('roster_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !existing) return errorResponse('Roster not found', 404);

        const updateData: Record<string, unknown> = {};

        if (body.start_date) updateData.start_date = body.start_date;
        if (body.end_date) updateData.end_date = body.end_date;

        if (Object.keys(updateData).length === 0) {
            return errorResponse('No valid fields to update', 400);
        }

        updateData.updated_at = new Date().toISOString();

        const { data: updated, error } = await supabase
            .from('Roster')
            .update(updateData)
            .eq('roster_id', id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        return successResponse(updated);
    } catch (err) {
        console.error('Update roster error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/rosters/[id]
 * 
 * Delete a roster (draft only)
 * Access: Owner, Manager
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: roster, error: findError } = await supabase
            .from('Roster')
            .select('*')
            .eq('roster_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !roster) return errorResponse('Roster not found', 404);

        if (roster.status === 'published') {
            return errorResponse('Cannot delete a published roster. Unpublish it first.', 409);
        }

        // Delete all shifts belonging to this roster first
        await supabase.from('Shift').delete().eq('roster_id', id);

        // Delete roster
        await supabase.from('Roster').delete().eq('roster_id', id);

        return successResponse(null, 'Roster and all associated shifts deleted');
    } catch (err) {
        console.error('Delete roster error:', err);
        return errorResponse('Internal server error', 500);
    }
}
