import { createClient } from './supabase/server';
import { logAudit } from './audit';
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
 * Notify employees that a roster has been published or updated.
 * Currently logs to audit log and console.
 * Can be extended to send real emails via Resend/SendGrid.
 */
export async function notifyRosterPublished(rosterId: string, businessId: string, updatedBy: string, since?: string) {
    const supabase = await createClient();

    // 1. Get roster details
    const { data: roster } = await supabase
        .from('Roster')
        .select('start_date, end_date, published_at')
        .select('*')
        .eq('id', rosterId)
        .single();

    if (!roster) return;

    // Get all shifts in this roster
    const { data: shifts } = await supabase
        .from('Shift')
        .select('*, Employee:employee_id(email, first_name, user_id)')
        .eq('roster_id', rosterId);

    if (!shifts || shifts.length === 0) return;

    // Determine which shifts are new or updated since last publish
    const lastPublish = since || roster.published_at;
    const emailNotifications: any[] = [];

    for (const shift of shifts) {
        let type: 'new' | 'updated' | 'unchanged' = 'unchanged';
        const updatedAt = new Date(shift.updated_at);

        if (!lastPublish) {
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
            const shiftTime = `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            
            emailNotifications.push({
                email: shift.Employee.email,
                name: shift.Employee.first_name,
                date: shift.shift_date,
                type,
                time: shiftTime
            });

            // Send INDIVIDUAL in-app notification per employee
            if (shift.Employee.user_id) {
                createNotification({
                    business_id: businessId,
                    user_ids: [shift.Employee.user_id],
                    type: type === 'new' ? 'SHIFT_PUBLISHED' : 'SHIFT_UPDATED',
                    title: type === 'new' ? 'New Shift Assigned' : 'Shift Updated',
                    message: type === 'new' 
                        ? `You have a new shift on ${shift.shift_date} (${shiftTime})`
                        : `Your shift on ${shift.shift_date} was updated to ${shiftTime}`,
                    entity_id: shift.shift_id,
                    entity_type: 'shift'
                }).catch(err => console.error('[Notify] In-app targeted notification failed:', err));
            }
        }
    }

    if (emailNotifications.length === 0) return;

    console.log(`[Notification] Sending ${emailNotifications.length} targeted email notifications for roster ${rosterId}`);
    
    // unique employees who received notifications (for audit summary)
    const notifiedEmails = new Set(emailNotifications.map(n => n.email));

    // 4. Log the notification event summary
    await logAudit({
        businessId,
        tableName: 'Roster',
        recordId: rosterId,
        action: 'UPDATE',
        changedBy: updatedBy,
        afterValue: {
            notifiedCount: emailNotifications.length,
            uniqueEmployees: notifiedEmails.size,
            startDate: roster.start_date,
            endDate: roster.end_date
        },
        reason: 'Targeted shift notifications triggered'
    });

    // 5. Send actual emails
    for (const n of emailNotifications) {
        const subject = n.type === 'new' ? 'New Shift Assigned' : 'Shift Updated';
        const bodyContent = n.type === 'new' 
            ? `you have been assigned a <b>new shift</b>`
            : `your shift has been <b>updated</b>`;

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">AU Payroll System</h2>
                <p>Hi ${n.name},</p>
                <p>${bodyContent} for the upcoming roster:</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Date:</strong> ${n.date}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${n.time}</p>
                </div>
                <p>Please log in to your dashboard to view your full schedule.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Full Roster</a>
                <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">This is an automated notification. Please do not reply.</p>
            </div>
        `;

        const text = `Hi ${n.name}, ${n.type === 'new' ? 'new shift assigned' : 'shift updated'} on ${n.date} (${n.time}). View your schedule: ${process.env.NEXT_PUBLIC_APP_URL}/employee/shifts`;

        await sendEmail({
            to: n.email,
            subject,
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
