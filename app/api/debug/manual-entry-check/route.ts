import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';

/**
 * GET /api/debug/manual-entry-check?employee_id=BEA0015&hours=2
 * 
 * Check if manual entries are being saved to the database
 * Shows all attendance logs for an employee from the last N hours
 */
export async function GET(request: NextRequest) {
    try {
        await requireRole('owner', 'manager');

        const { searchParams } = new URL(request.url);
        const employee_id = searchParams.get('employee_id');
        const hoursBack = parseInt(searchParams.get('hours') || '2', 10);

        if (!employee_id) {
            return errorResponse('employee_id parameter required', 400);
        }

        const supabase = await createClient();

        // Get all logs for the employee from the last N hours
        const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

        const { data: logs, error } = await supabase
            .from('AttendanceLog')
            .select('*')
            .eq('employee_id', employee_id)
            .gte('timestamp', cutoffTime)
            .order('timestamp', { ascending: false });

        if (error) {
            return errorResponse(error.message, 400);
        }

        console.log(`[DEBUG] Manual entry check for ${employee_id} (last ${hoursBack}h):`, {
            cutoffTime,
            count: logs?.length || 0,
            logs: logs?.map(log => ({
                log_id: log.log_id,
                event_type: log.event_type,
                timestamp: log.timestamp,
                override_by: log.override_by,
                override_reason: log.override_reason,
                business_id: log.business_id,
                created_at: log.created_at
            }))
        });

        return successResponse({
            employee_id,
            cutoffTime,
            logsFound: logs?.length || 0,
            logs: logs || [],
            message: `Found ${logs?.length || 0} logs for ${employee_id} in the last ${hoursBack} hours`
        });
    } catch (err) {
        console.error('Manual entry check error:', err);
        return errorResponse('Internal server error', 500);
    }
}
