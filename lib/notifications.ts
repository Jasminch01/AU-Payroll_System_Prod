import { createClient } from './supabase/server';
import { logAudit } from './audit';
import { sendEmail } from './email';

/**
 * Notify employees that a roster has been published or updated.
 * Currently logs to audit log and console.
 * Can be extended to send real emails via Resend/SendGrid.
 */
export async function notifyRosterPublished(rosterId: string, businessId: string, updatedBy: string) {
    const supabase = await createClient();

    // 1. Get roster details
    const { data: roster } = await supabase
        .from('Roster')
        .select('start_date, end_date, published_at')
        .eq('roster_id', rosterId)
        .single();

    if (!roster) return;

    // Use a baseline for what is "new" vs "updated"
    // If it's the first publish, everything is new.
    // If it was published before, we check what changed since the PREVIOUS published_at.
    const lastPublish = roster.published_at;

    // 2. Get all shifts in this roster with employee details
    const { data: shifts } = await supabase
        .from('Shift')
        .select('*, Employee:employee_id(email, first_name)')
        .eq('roster_id', rosterId);

    if (!shifts || shifts.length === 0) return;

    // 3. Categorize changes per employee
    const notifications = [];

    for (const shift of shifts) {
        if (!shift.employee_id || !shift.Employee) continue;

        let type: 'new' | 'updated' | 'unchanged' = 'unchanged';

        if (!lastPublish) {
            type = 'new';
        } else {
            const updatedAt = new Date(shift.updated_at);
            const createdAt = new Date(shift.created_at);
            const pubAt = new Date(lastPublish);

            if (createdAt > pubAt) {
                type = 'new';
            } else if (updatedAt > pubAt) {
                type = 'updated';
            }
        }

        if (type !== 'unchanged') {
            notifications.push({
                email: shift.Employee.email,
                name: shift.Employee.first_name,
                date: shift.shift_date,
                type,
                time: `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            });
        }
    }

    if (notifications.length === 0) return;

    console.log(`[Notification] Sending ${notifications.length} targeted notifications for roster ${rosterId}`);

    // unique employees who received notifications (for audit summary)
    const notifiedEmails = new Set(notifications.map(n => n.email));

    // 4. Log the notification event summary
    await logAudit({
        businessId,
        tableName: 'Roster',
        recordId: rosterId,
        action: 'UPDATE',
        changedBy: updatedBy,
        afterValue: {
            notifiedCount: notifications.length,
            uniqueEmployees: notifiedEmails.size,
            startDate: roster.start_date,
            endDate: roster.end_date
        },
        reason: 'Targeted shift notifications triggered'
    });

    // 5. Send actual emails
    for (const n of notifications) {
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
