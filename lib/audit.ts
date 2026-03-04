import { createAdminClient } from '@/lib/supabase/admin';
import { AuditAction } from '@/types/database';

interface AuditParams {
    businessId: string;
    tableName: string;
    recordId: string;
    action: AuditAction;
    changedBy: string | null;
    beforeValue?: any;
    afterValue?: any;
    reason?: string;
}

/**
 * Log an audit entry to the database.
 * Uses the admin client to ensure logging happens regardless of user RLS.
 */
export async function logAudit({
    businessId,
    tableName,
    recordId,
    action,
    changedBy,
    beforeValue,
    afterValue,
    reason
}: AuditParams) {
    const supabase = createAdminClient();

    const { error } = await supabase
        .from('AuditLog')
        .insert({
            business_id: businessId,
            table_name: tableName,
            record_id: recordId,
            action,
            changed_by: changedBy,
            before_value: beforeValue || null,
            after_value: afterValue || null,
            reason: reason || null,
            changed_at: new Date().toISOString()
        });

    if (error) {
        console.error('Failed to write audit log:', error);
    }
}
