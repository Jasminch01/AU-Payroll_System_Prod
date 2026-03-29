import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse, validateRequiredFields } from '@/lib/api-helpers';
import { checkShiftConflictWithLeave } from '@/lib/leave-logic';
import { notifyShiftPublished } from '@/lib/notifications';

/**
 * GET /api/shift
 * 
 * List shifts based on filters
 * Access: Owner, Manager
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const roster_id = searchParams.get('roster_id');
        const from_date = searchParams.get('from');
        const to_date = searchParams.get('to');

        const supabase = await createClient();

        let query = supabase
            .from('Shift')
            .select('*, Employee:employee_id(employee_id, first_name, last_name, role_title), Roster:roster_id(*)')
            .eq('business_id', authUser.business_id)
            .order('shift_date', { ascending: false });

        if (employee_id) query = query.eq('employee_id', employee_id);
        if (roster_id) query = query.eq('roster_id', roster_id);
        if (from_date) query = query.gte('shift_date', from_date);
        if (to_date) query = query.lte('shift_date', to_date);

        const { data: shifts, error } = await query;

        if (error) return errorResponse(error.message, 400);

        return successResponse(shifts, `Found ${shifts.length} shift(s)`);
    } catch (err) {
        console.error('List shifts error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/shift
 * 
 * Create a new shift
 * Access: Owner, Manager
 * 
 * Body:
 * {
 *   "employee_id": "uuid" (optional),
 *   "roster_id": "uuid" (optional),
 *   "shift_date": "2026-03-10",
 *   "start_time": "ISO_TIMESTAMP",
 *   "end_time": "ISO_TIMESTAMP",
 *   "shift_type": "morning" | "afternoon" | etc
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await requireRole('owner', 'manager');
        if (!authUser) return errorResponse('Unauthorized', 401);

        const body = await request.json();
        const validationError = validateRequiredFields(body, [
            'shift_date',
            'start_time',
            'end_time',
            'shift_type',
        ]);
        if (validationError) return errorResponse(validationError, 400);

        const { employee_id, roster_id, shift_date, start_time, end_time, shift_type, notify } = body;

        // Validate time order and prevent past shifts
        const start = new Date(start_time);
        const end = new Date(end_time);

        // Local-safe today string (YYYY-MM-DD)
        const today = new Date();
        const todayLocalStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (shift_date < todayLocalStr) {
            return errorResponse('Cannot create shifts or rosters for past dates', 400);
        }

        // New shifts cannot start in the past
        if (start < today && !body.id) {
            return errorResponse('Cannot create a shift that starts in the past.', 400);
        }

        if (start >= end) {
            return errorResponse('start_time must be before end_time', 400);
        }

        const supabase = await createClient();

        // If an employee is assigned, check for overlapping shifts for that employee
        if (employee_id) {
            // 1. Check for overlapping shifts
            const { data: overlapping } = await supabase
                .from('Shift')
                .select('shift_id')
                .eq('employee_id', employee_id)
                .eq('business_id', authUser.business_id)
                .lte('start_time', end_time)
                .gte('end_time', start_time)
                .limit(1)
                .single();

            if (overlapping) {
                return errorResponse('This employee already has an overlapping shift.', 409);
            }

            // 2. Check for approved leave
            const leaveConflicts = await checkShiftConflictWithLeave(authUser.business_id, employee_id, shift_date);
            if (leaveConflicts.length > 0) {
                return errorResponse(`This employee has approved leave (${leaveConflicts[0].leave_type}) on this date.`, 409);
            }
        }

        // ====== ROSTER LINKAGE (Flexible) ======
        // Use provided roster dates or calculate week block (Monday to Sunday)
        let start_date_str = body.roster_start;
        let end_date_str = body.roster_end;

        if (!start_date_str || !end_date_str) {
            const dateObj = new Date(shift_date);
            const day = dateObj.getDay();
            const diffToMonday = dateObj.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(dateObj);
            monday.setDate(diffToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);

            start_date_str = start_date_str || monday.toISOString().split('T')[0];
            end_date_str = end_date_str || sunday.toISOString().split('T')[0];
        }

        let target_roster_id = roster_id;

        if (!target_roster_id) {
            // Find ANY overlapping roster for this business in the same view range
            const { data: existingRoster, error: lookupError } = await supabase
                .from('Roster')
                .select('*')
                .eq('business_id', authUser.business_id)
                .lte('start_date', end_date_str)
                .gte('end_date', start_date_str)
                .limit(1)
                .maybeSingle();

            if (lookupError) {
                console.error('Roster lookup error:', lookupError);
            }

            if (existingRoster) {
                target_roster_id = existingRoster.roster_id;
                
                // FIXED Logic: Only expand if the SHIFT DATE is outside existing bounds.
                // Do NOT expand just because the manager's UI view (roster_start/end) is wider.
                const new_start = shift_date < existingRoster.start_date ? start_date_str : existingRoster.start_date;
                const new_end = shift_date > existingRoster.end_date ? end_date_str : existingRoster.end_date;

                const needsUpdate = new_start !== existingRoster.start_date || new_end !== existingRoster.end_date;

                if (needsUpdate) {
                    await supabase
                        .from('Roster')
                        .update({ 
                            start_date: new_start, 
                            end_date: new_end,
                            updated_at: new Date().toISOString() 
                        })
                        .eq('roster_id', target_roster_id);
                }
            } else {
                const { data: newRoster, error: rosterError } = await supabase
                    .from('Roster')
                    .insert({
                        business_id: authUser.business_id,
                        start_date: start_date_str,
                        end_date: end_date_str,
                        status: 'draft',
                        created_by: authUser.user_id,
                    })
                    .select('roster_id')
                    .single();

                if (rosterError) {
                    console.error('New roster error:', rosterError);
                    return errorResponse('Failed to create roster grouping', 400);
                }
                target_roster_id = newRoster.roster_id;
            }
        }

        const { data: shift, error } = await supabase
            .from('Shift')
            .insert({
                business_id: authUser.business_id,
                employee_id: employee_id || null,
                roster_id: target_roster_id,
                shift_date,
                start_time,
                end_time,
                shift_type,
                shift_status: notify ? 'published' : 'draft',
            })
            .select()
            .single();

        if (error) return errorResponse(error.message, 400);

        // If notify is requested, trigger the single shift notification
        if (notify && shift) {
            notifyShiftPublished(shift.shift_id).catch(err => 
                console.error(`[Notify] Single shift publish failed for ${shift.shift_id}:`, err)
            );
        }

        return successResponse(shift, 'Shift created successfully', 201);
    } catch (err) {
        console.error('Create shift error:', err);
        return errorResponse('Internal server error', 500);
    }
}