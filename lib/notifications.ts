import { createClient } from './supabase/server';
import { sendEmail } from './email';
import { sendPushNotification } from './push-notifications';

// --- NEW APP NOTIFICATION TYPES ---
export type NotificationType = 
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
    | 'BROADCAST';

export interface CreateNotificationParams {
    business_id: string;
    user_ids: string[];
    actor_id?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    entity_id?: string | null;
    entity_type?: string | null;
}

export async function createNotification(params: CreateNotificationParams) {
    const { business_id, user_ids, actor_id, type, title, message, entity_id, entity_type } = params;
    
    if (!user_ids || user_ids.length === 0) {
        return { success: false, error: 'No recipients provided' };
    }

    try {
        const supabase = await createClient();
        const insertData = user_ids.map((user_id) => ({
            business_id,
            user_id,
            actor_id: actor_id || null,
            type,
            title,
            message,
            entity_id: entity_id || null,
            entity_type: entity_type || null,
            is_read: false
        }));

        const { error } = await supabase.from('notifications').insert(insertData);
        if (error) {
            console.error('Failed to insert bulk notifications into DB:', error);
            return { success: false, error: error.message };
        }

        // Trigger mobile push notifications asynchronously
        Promise.allSettled(
            user_ids.map(user_id => 
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
 * Notify employees that their shifts have been published.
 * Accepts the pre-fetched draft shifts directly from the publish route
 * so there is no timestamp-comparison guessing — we notify EXACTLY
 * the shifts that were in 'draft' status at publish time.
 */
export async function notifyRosterPublished(rosterId: string, businessId: string, updatedBy: string, draftShifts: any[]) {
    if (!draftShifts || draftShifts.length === 0) return;

    const emailNotifications: any[] = [];

    for (const shift of draftShifts) {
        // Skip unassigned or shifts without employee data
        if (!shift.Employee) continue;

        const { email, first_name, user_id } = shift.Employee;
        const shiftTime = `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        // Send in-app notification per employee
        if (user_id) {
            createNotification({
                business_id: businessId,
                user_ids: [user_id],
                type: 'SHIFT_PUBLISHED',
                title: 'New Shift Assigned',
                message: `You have a new shift on ${shift.shift_date} (${shiftTime})`,
                entity_id: shift.shift_id,
                entity_type: 'shift'
            }).catch(err => console.error('[Notify] In-app targeted notification failed:', err));
        }

        if (email && first_name) {
            emailNotifications.push({ email, name: first_name, date: shift.shift_date, time: shiftTime });
        }
    }

    if (emailNotifications.length === 0) return;

    console.log(`[Notification] Sending ${emailNotifications.length} targeted email notifications for roster ${rosterId}`);

    // Send emails
    for (const n of emailNotifications) {
        const html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">AU Payroll System</h2>
            <p>Hi ${n.name},</p>
            <p>You have been assigned a <b>new shift</b> for the upcoming roster:</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Date:</strong> ${n.date}</p>
                <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${n.time}</p>
            </div>
            <p>Please log in to your dashboard to view your full schedule.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Full Roster</a>
            <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">This is an automated notification. Please do not reply.</p>
        </div>`;
        const text = `Hi ${n.name}, you have a new shift on ${n.date} (${n.time}). View: ${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts`;

        await sendEmail({ to: n.email, subject: 'New Shift Assigned', html, text });
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
