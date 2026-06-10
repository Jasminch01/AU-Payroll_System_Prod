import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole, getBusinessTimezone } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getDateInTimezone, getTimeInTimezone } from '@/lib/timezone-utils';
import { checkShiftConflictWithLeave } from '@/lib/leave-logic';
import { notifyShiftUpdated, notifyShiftDeleted, notifyShiftPublished } from '@/lib/notifications';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/shift/[id]
 * 
 * Get a specific shift
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: shift, error } = await supabase
            .from('Shift')
            .select('*, Employee:employee_id(employee_id, first_name, last_name, role_title), Roster:roster_id(*)')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (error || !shift) return errorResponse('Shift not found', 404);

        return successResponse(shift);
    } catch (err) {
        console.error('Get shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * PUT /api/shift/[id]
 * 
 * Update a shift
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "uuid",
 *   "start_time": "ISO_TIMESTAMP",
 *   "end_time": "ISO_TIMESTAMP",
 *   "shift_type": "morning"
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const body = await request.json();
        const supabase = await createClient();

        // Check shift exists and belongs to this business
        const { data: existing, error: findError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !existing) return errorResponse('Shift not found', 404);

        // Check if shift has already started
        const now = new Date();
        const startTime = new Date(existing.start_time);
        if (existing.shift_status !== 'draft' && now >= startTime) {
            return errorResponse('Cannot update a shift that has already started.', 400);
        }


        const updateData: Record<string, unknown> = {};
        const allowedFields = [
            'employee_id',
            'roster_id',
            'shift_date',
            'start_time',
            'end_time',
            'shift_type',
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return errorResponse('No valid fields to update', 400);
        }

        // If time is updated, re-check overlap
        const newStart = updateData.start_time || existing.start_time;
        const newEnd = updateData.end_time || existing.end_time;
        const newEmployee = updateData.employee_id || existing.employee_id;
        const force = body.force === true;

        if (newEmployee && !force) {
            // 1. Check for overlapping shifts
            const { data: overlapping } = await supabase
                .from('Shift')
                .select('shift_id, shift_date, start_time, end_time, shift_type')
                .eq('employee_id', newEmployee)
                .eq('business_id', authUser.business_id)
                .neq('shift_id', id)
                .lte('start_time', newEnd)
                .gte('end_time', newStart)
                .limit(1)
                .maybeSingle();

            if (overlapping) {
                return successResponse({
                    status: 'conflict',
                    message: 'This update creates an overlapping shift for the employee.',
                    conflict: {
                        shift_id: overlapping.shift_id,
                        shift_date: overlapping.shift_date,
                        start_time: overlapping.start_time,
                        end_time: overlapping.end_time,
                        shift_type: overlapping.shift_type
                    }
                }, 'Conflict detected');
            }

            // 2. Check for approved leave
            const newShiftDate = updateData.shift_date as string || (existing.shift_date as string);
            const leaveConflicts = await checkShiftConflictWithLeave(authUser.business_id, newEmployee, newShiftDate);
            if (leaveConflicts.length > 0) {
                return errorResponse(`This employee has approved leave (${leaveConflicts[0].leave_type}) on this date.`, 409);
            }
        }

        updateData.updated_at = new Date().toISOString();

        if (body.notify) {
            updateData.shift_status = 'published';
        }

        const { data: updated, error } = await supabase
            .from('Shift')
            .update(updateData)
            .eq('shift_id', id)
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        // If shift is published, ensure the roster is also published
        if (updated.shift_status === 'published' && existing.roster_id) {
            const { data: roster } = await supabase
                .from('Roster')
                .select('status, published_at', { count: 'exact' })
                .eq('roster_id', existing.roster_id)
                .single();

            if (roster && roster.status === 'draft' && !roster.published_at) {
                await supabase
                    .from('Roster')
                    .update({
                        status: 'published',
                        published_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('roster_id', existing.roster_id);
            }
        }

        // If shift was already published, keep it published (Deputy-style: edits are live)
        // Also notify the employee of the change
        if (existing.roster_id) {
            const { data: roster } = await supabase
                .from('Roster')
                .select('status, business_id, start_date, end_date')
                .eq('roster_id', existing.roster_id)
                .single();

            const rosterStart = body.roster_start;
            const rosterEnd = body.roster_end;

            if (roster) {
                const newShiftDate = updateData.shift_date as string || (existing.shift_date as string);
                const new_start = newShiftDate < roster.start_date ? rosterStart : roster.start_date;
                const new_end = newShiftDate > roster.end_date ? rosterEnd : roster.end_date;

                const needsExpansion = new_start !== roster.start_date || new_end !== roster.end_date;

                if (needsExpansion) {
                    await supabase
                        .from('Roster')
                        .update({
                            start_date: new_start,
                            end_date: new_end,
                            updated_at: new Date().toISOString()
                        })
                        .eq('roster_id', existing.roster_id);
                }
            }
        }

        // Deputy-style: if the shift was published or explicitly notified, notify the appropriate employees
        const isNowPublished = updated.shift_status === 'published';
        const wasAlreadyPublished = existing.shift_status === 'published';

        if (isNowPublished) {
            const oldEmpId = existing.employee_id;
            const newEmpId = updateData.employee_id || oldEmpId;

            if (!wasAlreadyPublished || newEmpId !== oldEmpId) {
                // ... same logic but handle New vs Update ...
                if (!wasAlreadyPublished) {
                    // NEW PUBLISH
                    if (newEmpId) {
                        notifyShiftPublished(id).catch((err: Error) =>
                            console.error(`[Notify] new shift assigned email failed for ${id}:`, err)
                        );
                    }
                } else if (newEmpId !== oldEmpId) {
                    // REASSIGNMENT of already published shift
                    // 1. Notify OLD about removal
                    if (oldEmpId) {
                        const { data: oldEmp } = await supabase.from('Employee').select('email, first_name, user_id, business_id').eq('employee_id', oldEmpId).single();
                        if (oldEmp) {
                            const shiftTime = `${existing.start_time.split('T')[1]?.substring(0, 5)} - ${existing.end_time.split('T')[1]?.substring(0, 5)}`;
                            notifyShiftDeleted(oldEmp.email, oldEmp.first_name, existing.shift_date, shiftTime, oldEmp.business_id, oldEmp.user_id).catch(err =>
                                console.error(`[Notify] old shift removed email failed for ${id}:`, err)
                            );
                        }
                    }
                    // 2. Notify NEW about assignment
                    if (newEmpId) {
                        notifyShiftPublished(id).catch((err: Error) =>
                            console.error(`[Notify] new shift assigned email failed for ${id}:`, err)
                        );
                    }
                }
            } else if (oldEmpId) {
                // Same employee, just notify update
                const { data: currentEmp } = await supabase.from('Employee').select('user_id, business_id').eq('employee_id', oldEmpId).single();
                if (currentEmp) {
                    notifyShiftUpdated(id, existing.start_time, existing.end_time, currentEmp.business_id, currentEmp.user_id).catch((err: Error) =>
                        console.error(`[Notify] shift update email failed for ${id}:`, err)
                    );
                }
            }
        }

        return successResponse(updated, 'Shift updated successfully');
    } catch (err) {
        console.error('Update shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * DELETE /api/shift/[id]
 * 
 * Delete a shift
 * Access: Owner, Manager
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { id } = await params;
        const supabase = await createClient();

        const { data: shift, error: findError } = await supabase
            .from('Shift')
            .select('*')
            .eq('shift_id', id)
            .eq('business_id', authUser.business_id)
            .single();

        if (findError || !shift) return errorResponse('Shift not found', 404);

        // Check if shift has already started using business timezone comparison
        const tz = await getBusinessTimezone(authUser.business_id);
        const now = new Date().toISOString();
        const nowBusinessDate = getDateInTimezone(now, tz);
        const nowBusinessTime = getTimeInTimezone(now, tz);
        const nowBusinessStr = `${nowBusinessDate}T${nowBusinessTime}:00`;

        if (shift.shift_status !== 'draft' && nowBusinessStr >= shift.start_time) {
            return errorResponse('Cannot delete a shift that has already started.', 400);
        }


        const { error: deleteError } = await supabase
            .from('Shift')
            .delete()
            .eq('shift_id', id);

        if (deleteError) return errorResponse(deleteError.message, 400);

        // (Refined Delete Logic): 
        // If this was the LAST shift in a published roster, revert it to draft.
        // Otherwise, keep it published (for real-time editing).
        if (shift.roster_id) {
            const { count, error: countError } = await supabase
                .from('Shift')
                .select('shift_id', { count: 'exact', head: true })
                .eq('roster_id', shift.roster_id);

            if (!countError && count === 0) {
                await supabase
                    .from('Roster')
                    .update({
                        status: 'draft',
                        updated_at: new Date().toISOString()
                    })
                    .eq('roster_id', shift.roster_id);
            }
        }

        // Deputy-style: if the shift was published, notify the employee it was removed (non-blocking)
        if (shift.shift_status === 'published' && shift.employee_id) {
            const supabaseClient = await createClient();
            const { data: emp } = await supabaseClient
                .from('Employee')
                .select('email, first_name, user_id, business_id')
                .eq('employee_id', shift.employee_id)
                .single();

            if (emp) {
                const shiftTime = `${shift.start_time.split('T')[1]?.substring(0, 5)} - ${shift.end_time.split('T')[1]?.substring(0, 5)}`;
                notifyShiftDeleted(emp.email, emp.first_name, shift.shift_date, shiftTime, emp.business_id, emp.user_id).catch(err =>
                    console.error(`[Notify] shift delete email failed:`, err)
                );
            }
        }

        return successResponse(null, 'Shift deleted successfully');
    } catch (err) {
        console.error('Delete shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}
