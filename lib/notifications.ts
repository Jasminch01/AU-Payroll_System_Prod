import { createClient } from './supabase/server';
import { logAudit } from './audit';
import { sendEmail } from './email';
import { sendPushNotification } from './push-notifications';

// --- NEW APP NOTIFICATION TYPES ---
export type NotificationType =
    | 'ATTENDANCE_CLOCK_EVENT'
    | 'SHIFT_SWAP_REQUESTED'
    | 'SHIFT_SWAP_ACCEPTED'
    | 'SHIFT_SWAP_REJECTED'
    | 'SHIFT_SWAP_APPROVED'
    | 'SHIFT_TRANSFER_OFFERED'
    | 'SHIFT_TRANSFER_ACCEPTED'
    | 'SHIFT_TRANSFER_APPROVED'
    | 'TIMESHEET_SUBMITTED'
    | 'TIMESHEET_APPROVED'
    | 'TIMESHEET_REJECTED'
    | 'EMPLOYEE_JOINED'
    | 'SHIFT_PUBLISHED'
    | 'SHIFT_UPDATED'
    | 'SHIFT_DELETED'
    | 'SHIFT_POOL_AVAILABLE'
    | 'BROADCAST'
    | 'ATTENDANCE_REQUESTED'
    | 'CHECKLIST_REMINDER';

export interface CreateNotificationParams {
    business_id: string;
    user_ids: string[];
    actor_id?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    entity_id?: string | null;
    entity_type?: string | null;
    link_url?: string | null;
}

export async function createNotification(params: CreateNotificationParams) {
    const { business_id, user_ids, actor_id, type, title, message, entity_id, entity_type, link_url } = params;

    if (!user_ids || user_ids.length === 0) {
        return { success: false, error: 'No recipients provided' };
    }

    try {
        const supabase = await createClient();

        // Check user preferences if it's not a broadcast
        let filteredUserIds = [...user_ids];
        if (type !== 'BROADCAST') {
            const { data: disabledPrefs } = await supabase
                .from('UserNotificationPreference')
                .select('user_id')
                .in('user_id', user_ids)
                .eq('type', type)
                .eq('is_enabled', false);

            if (disabledPrefs && disabledPrefs.length > 0) {
                const disabledUserIds = new Set(disabledPrefs.map(p => p.user_id));
                filteredUserIds = user_ids.filter(uid => !disabledUserIds.has(uid));
            }
        }

        if (filteredUserIds.length === 0) {
            return { success: true, message: 'All recipients have disabled this notification type' };
        }

        const insertData = filteredUserIds.map((user_id) => ({
            business_id,
            user_id,
            actor_id: actor_id || null,
            type,
            title,
            message,
            entity_id: entity_id || null,
            entity_type: entity_type || null,
            link_url: link_url || null,
            is_read: false
        }));

        const { error } = await supabase.from('notifications').insert(insertData);
        if (error) {
            console.error('Failed to insert bulk notifications into DB:', error);
            return { success: false, error: error.message };
        }

        // Trigger mobile push notifications asynchronously
        Promise.allSettled(
            filteredUserIds.map(user_id =>
                sendPushNotification(
                    user_id,
                    title,
                    message,
                    '/employee/shifts' // Default destination when notification is clicked
                )
            )
        ).catch(err => console.error('Background push error:', err));

        return { success: true };
    } catch (err) {
        console.error('Unexpected error creating notifications:', err);
        return { success: false, error: 'Internal server error while creating notifications' };
    }
}
// --- END APP NOTIFICATIONS ---

/**
 * Notify employees that a roster has been published or updated.
 * Currently logs to audit log and console.
 * Can be extended to send real emails via Resend/SendGrid.
 */
export async function notifyRosterPublished(rosterId: string, businessId: string, updatedBy: string, since?: string) {
    const supabase = await createClient();

    // 1. Get roster details
    const { data: roster } = await supabase
        .from('Roster')
        .select('roster_id, start_date, end_date, status')
        .eq('roster_id', rosterId)
        .single();

    if (!roster) return;

    // Get all shifts in this roster
    const { data: shifts } = await supabase
        .from('Shift')
        .select('shift_id, shift_date, start_time, end_time, created_at, updated_at, business_id, Employee:employee_id(email, first_name, user_id)')
        .eq('roster_id', rosterId);

    if (!shifts || shifts.length === 0) return;

    // Determine which shifts are new or updated since last publish
    // FIX: Using 'since' directly to identify changes relative to the previous state.
    // If 'since' is null/missing, it's a first-time publish, so all shifts are 'new'.
    const lastPublish = since;
    interface UserChangeGroup {
        employee: { email: string; first_name: string; user_id: string };
        newShifts: Record<string, unknown>[];
        updatedShifts: Record<string, unknown>[];
    }
    const userChanges: Record<string, UserChangeGroup> = {};

    for (const shift of shifts) {
        if (!shift.Employee) continue;

        const employee = Array.isArray(shift.Employee) ? shift.Employee[0] : shift.Employee;
        if (!employee) continue;

        const userId = employee.user_id;
        const email = employee.email;
        if (!userId && !email) continue;

        let type: 'new' | 'updated' | 'unchanged' = 'unchanged';
        const updatedAt = new Date(shift.updated_at);

        if (!lastPublish) {
            // First time publish: everything is new
            type = 'new';
        } else {
            const createdAt = new Date(shift.created_at);
            const pubAt = new Date(lastPublish);

            // Use a small buffer (1 second) to avoid race conditions with same-second updates
            const isNew = createdAt.getTime() > pubAt.getTime() + 1000;
            const isUpdated = updatedAt.getTime() > pubAt.getTime() + 1000;

            if (isNew) {
                type = 'new';
            } else if (isUpdated) {
                type = 'updated';
            }
        }

        if (type !== 'unchanged') {
            const key = userId || email;
            if (!userChanges[key]) {
                userChanges[key] = {
                    employee: employee as any,
                    newShifts: [],
                    updatedShifts: []
                };
            }
            if (type === 'new') userChanges[key].newShifts.push(shift);
            else userChanges[key].updatedShifts.push(shift);
        }
    }

    const notifiedUserKeys = Object.keys(userChanges);
    if (notifiedUserKeys.length === 0) return;



    // 4. Log the notification event summary (for audit)
    await logAudit({
        businessId,
        tableName: 'Roster',
        recordId: rosterId,
        action: 'UPDATE',
        changedBy: updatedBy,
        afterValue: {
            notifiedEmployeeCount: notifiedUserKeys.length,
            startDate: roster.start_date,
            endDate: roster.end_date
        },
        reason: 'Grouped roster publish notifications triggered'
    });

    // 5. Send actual notifications and emails
    for (const key of notifiedUserKeys) {
        const { employee, newShifts, updatedShifts } = userChanges[key];
        const { email, first_name, user_id } = employee;

        // Build summary message
        let summaryMessage = '';
        if (newShifts.length > 0 && updatedShifts.length > 0) {
            summaryMessage = `You have ${newShifts.length} new and ${updatedShifts.length} updated shifts in the latest roster.`;
        } else if (newShifts.length > 0) {
            summaryMessage = `You have ${newShifts.length} new shift${newShifts.length > 1 ? 's' : ''} in the latest roster.`;
        } else {
            summaryMessage = `Your shift${updatedShifts.length > 1 ? 's have' : ' has'} been updated in the latest roster.`;
        }

        // Send ONE in-app notification
        if (user_id) {
            createNotification({
                business_id: businessId,
                user_ids: [user_id],
                type: newShifts.length > 0 ? 'SHIFT_PUBLISHED' : 'SHIFT_UPDATED',
                title: newShifts.length > 0 ? 'New Shifts Assigned' : 'Shifts Updated',
                message: summaryMessage,
                entity_id: rosterId,
                entity_type: 'roster'
            }).catch(err => console.error('[Notify] Grouped in-app notification failed:', err));
        }

        // Send ONE email
        const shiftListHtml = [...newShifts, ...updatedShifts].map(s => {
            const startTime = String(s.start_time);
            const endTime = String(s.end_time);
            const shiftDate = String(s.shift_date);
            const time = `${new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            const statusLabel = newShifts.includes(s) ? '<span style="color: #059669; font-weight: bold;">(New)</span>' : '<span style="color: #d97706; font-weight: bold;">(Updated)</span>';
            return `<div style="padding: 10px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${newShifts.includes(s) ? '#059669' : '#d97706'};">
                <p style="margin: 0;"><strong>Date:</strong> ${shiftDate} ${statusLabel}</p>
                <p style="margin: 3px 0 0 0;"><strong>Time:</strong> ${time}</p>
            </div>`;
        }).join('');

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">AU Payroll System</h2>
                <p>Hi ${first_name},</p>
                <p>${summaryMessage} Details:</p>
                <div style="margin: 20px 0;">
                    ${shiftListHtml}
                </div>
                <p>Please log in to your dashboard to view your full schedule.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Full Roster</a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">This is an automated notification. Please do not reply.</p>
            </div>
        `;

        const text = `Hi ${first_name}, ${summaryMessage} View your schedule: ${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts`;

        await sendEmail({
            to: email,
            subject: newShifts.length > 0 ? 'New Shifts Assigned' : 'Shifts Updated',
            html,
            text
        });
    }
}

/**
 * Notify a single employee that a specific shift has been assigned (published).
 */
export async function notifyShiftPublished(shiftId: string) {
    const supabase = await createClient();

    const { data: shift } = await supabase
        .from('Shift')
        .select('*, Employee:employee_id(email, first_name, user_id)')
        .eq('shift_id', shiftId)
        .single();

    if (!shift || !shift.Employee) return;

    const { email, first_name, user_id } = shift.Employee;
    const time = `${shift.start_time.split('T')[1]?.substring(0, 5)} - ${shift.end_time.split('T')[1]?.substring(0, 5)}`;

    if (user_id) {
        await createNotification({
            business_id: shift.business_id,
            user_ids: [user_id],
            type: 'SHIFT_PUBLISHED',
            title: 'New Shift Assigned',
            message: `You have been assigned a new shift on ${shift.shift_date} (${time})`,
            entity_id: shiftId,
            entity_type: 'shift'
        }).catch(err => console.error('[Notify] In-app single shift publish failed:', err));
    }

    await sendEmail({
        to: email,
        subject: 'New Shift Assigned',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
            <h2 style="color:#4f46e5">AU Payroll System</h2>
            <p>Hi ${first_name},</p>
            <p>You have been assigned a <b>new shift</b>:</p>
            <div style="background:#f9fafb;padding:15px;border-radius:8px;margin:20px 0">
                <p style="margin:0"><strong>Date:</strong> ${shift.shift_date}</p>
                <p style="margin:5px 0 0 0"><strong>Time:</strong> ${time}</p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display:inline-block;background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">View Roster</a>
        </div>`,
        text: `Hi ${first_name}, new shift on ${shift.shift_date} (${time}).`,
    });
}

/**
 * Notify a single employee that a published shift has been updated.
 */
export async function notifyShiftUpdated(shiftId: string, previousStart: string, previousEnd: string, businessId?: string, userId?: string) {
    const supabase = await createClient();

    const { data: shift } = await supabase
        .from('Shift')
        .select('*, Employee:employee_id(email, first_name, user_id)')
        .eq('shift_id', shiftId)
        .single();

    if (!shift || !shift.Employee) return;

    const { email, first_name } = shift.Employee;
    const finalUserId = userId || shift.Employee.user_id;
    const finalBusId = businessId || shift.business_id;

    const newTime = `${shift.start_time.split('T')[1]?.substring(0, 5)} - ${shift.end_time.split('T')[1]?.substring(0, 5)}`;
    const oldTime = `${previousStart.split('T')[1]?.substring(0, 5)} - ${previousEnd.split('T')[1]?.substring(0, 5)}`;

    if (finalUserId && finalBusId) {
        await createNotification({
            business_id: finalBusId,
            user_ids: [finalUserId],
            type: 'SHIFT_UPDATED',
            title: 'Shift Updated',
            message: `Your shift on ${shift.shift_date} was changed to ${newTime}`,
            entity_id: shiftId,
            entity_type: 'shift'
        }).catch(err => console.error('[Notify] In-app shift update failed:', err));
    }

    await sendEmail({
        to: email,
        subject: 'Shift Updated',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
            <h2 style="color:#4f46e5">AU Payroll System</h2>
            <p>Hi ${first_name},</p>
            <p>Your shift on <strong>${shift.shift_date}</strong> has been <b>updated</b>:</p>
            <div style="background:#f9fafb;padding:15px;border-radius:8px;margin:20px 0">
                <p style="margin:0"><strong>Previous Time:</strong> <s>${oldTime}</s></p>
                <p style="margin:5px 0 0 0"><strong>New Time:</strong> ${newTime}</p>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display:inline-block;background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">View Roster</a>
        </div>`,
        text: `Hi ${first_name}, your shift on ${shift.shift_date} was updated to ${newTime}.`,
    });
}

/**
 * Notify a single employee their shift has been removed.
 */
export async function notifyShiftDeleted(employeeEmail: string, employeeName: string, shiftDate: string, shiftTime: string, businessId?: string, userId?: string) {
    if (businessId && userId) {
        await createNotification({
            business_id: businessId,
            user_ids: [userId],
            type: 'SHIFT_DELETED',
            title: 'Shift Cancelled',
            message: `Your shift on ${shiftDate} (${shiftTime}) has been removed.`,
            entity_id: null,
            entity_type: 'shift'
        }).catch(err => console.error('[Notify] In-app shift delete failed:', err));
    }

    await sendEmail({
        to: employeeEmail,
        subject: 'Shift Removed',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
            <h2 style="color:#4f46e5">AU Payroll System</h2>
            <p>Hi ${employeeName},</p>
            <p>Your shift on <strong>${shiftDate} (${shiftTime})</strong> has been <b>removed</b> from the roster.</p>
            <p>Please contact your manager if you have any questions.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display:inline-block;background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">View Roster</a>
        </div>`,
        text: `Hi ${employeeName}, your shift on ${shiftDate} (${shiftTime}) has been removed.`,
    });
}
