import { createClient } from '@/lib/supabase/server';
import { TimeSheet, PayrollInsert, PayrollLineInsert } from '@/types/database';

/**
 * Aggregates approved timesheets into a Payroll record.
 */
export async function generatePayroll(
    businessId: string,
    periodStart: string, // YYYY-MM-DD
    periodEnd: string    // YYYY-MM-DD
) {
    const supabase = await createClient();

    // 0. Prevent duplicate payroll for the same period
    const { data: existing } = await supabase
        .from('Payroll')
        .select('payroll_id')
        .eq('business_id', businessId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .limit(1);

    if (existing && existing.length > 0) {
        throw new Error('Payroll for this period already exists.');
    }

    // 1. Fetch Approved Timesheets
    const { data: timesheets, error: tsError } = await supabase
        .from('TimeSheet')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .gte('date', periodStart)
        .lte('date', periodEnd);

    // 1.1 Fetch Approved Leave Requests
    const { data: leaveRequests } = await supabase
        .from('LeaveRequest')
        .select('*, LeaveType(*)')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .gte('start_date', periodStart)
        .lte('end_date', periodEnd);

    if (tsError) throw new Error(tsError.message);

    // 2. Group by Employee
    const employeeIds = new Set([
        ...(timesheets?.map(ts => ts.employee_id) || []),
        ...(leaveRequests?.map(lr => lr.employee_id) || [])
    ]);

    let totalGross = 0;

    // 3. Prepare Payroll Parent
    const payrollData: PayrollInsert = {
        payroll_id: crypto.randomUUID(),
        business_id: businessId,
        period_start: periodStart,
        period_end: periodEnd,
        total_gross: 0, // calculated below
        total_net: 0,   // placeholder
        status: 'draft',
        approved_by: null,
        approved_at: null,
    };

    const { data: payroll, error: payrollErr } = await supabase
        .from('Payroll')
        .insert(payrollData)
        .select()
        .single();

    if (payrollErr || !payroll) throw new Error(payrollErr?.message || 'Failed to create payroll');

    const payrollLines: PayrollLineInsert[] = [];

    // 4. Create Lines
    for (const employeeId of employeeIds) {
        const empTimesheets = timesheets?.filter(ts => ts.employee_id === employeeId) || [];
        const empLeaveRequests = leaveRequests?.filter(lr => lr.employee_id === employeeId) || [];

        // Fetch Employee to get base rate
        const { data: employee } = await supabase
            .from('Employee')
            .select('weekday_rate')
            .eq('employee_id', employeeId)
            .single();

        const baseRate = Number(employee?.weekday_rate || 0);

        let employeeGross = 0;
        const breakdown: any[] = [];

        // Add Timesheet Hours
        for (const ts of empTimesheets) {
            employeeGross += Number(ts.gross_pay);
            breakdown.push({
                type: 'work',
                date: ts.date,
                hours: ts.actual_hours,
                rate: ts.hourly_rate,
                pay: ts.gross_pay
            });
        }

        // Add Leave Hours (only if paid and has balance)
        for (const lr of empLeaveRequests) {
            const isPaidType = lr.LeaveType?.is_paid ?? true;
            if (!isPaidType) continue;

            // Fetch current balance to verify
            const { data: balance } = await supabase
                .from('LeaveBalance')
                .select('accrued_hours, taken_hours')
                .eq('employee_id', employeeId)
                .eq('leave_type_id', lr.leave_type_id)
                .eq('year', new Date(lr.start_date).getFullYear())
                .single();

            const remaining = Number(balance?.accrued_hours || 0) - Number(balance?.taken_hours || 0);

            // If they have balance, pay them. (Note: in Part 7 we update the taken_hours)
            if (remaining >= Number(lr.total_hours)) {
                const leavePay = Number(lr.total_hours) * baseRate;
                employeeGross += leavePay;
                breakdown.push({
                    type: 'leave',
                    leave_type: lr.LeaveType?.name,
                    date: lr.start_date, // Simplify to start_date for the breakdown
                    hours: lr.total_hours,
                    rate: baseRate,
                    pay: Number(leavePay.toFixed(2))
                });
            }
        }

        totalGross += employeeGross;

        payrollLines.push({
            payroll_id: payroll.payroll_id,
            employee_id: employeeId,
            gross_wages: Number(employeeGross.toFixed(2)),
            additions: 0,
            deductions: 0,
            net_pay: Number(employeeGross.toFixed(2)),
            hours_breakdown: breakdown,
            payment_status: 'pending',
            payment_date: null
        });
    }

    // 5. Bulk insert lines
    if (payrollLines.length > 0) {
        const { error: linesErr } = await supabase
            .from('PayrollLine')
            .insert(payrollLines);
        if (linesErr) console.error('Error inserting payroll lines:', linesErr);
    }

    // 6. Update total gross on parent
    await supabase
        .from('Payroll')
        .update({
            total_gross: Number(totalGross.toFixed(2)),
            total_net: Number(totalGross.toFixed(2))
        })
        .eq('payroll_id', payroll.payroll_id);

    // 7. Accrue Leave for Employees
    const { data: leaveTypes } = await supabase
        .from('LeaveType')
        .select('*')
        .eq('business_id', businessId)
        .not('accrual_rate', 'is', null);

    if (leaveTypes && leaveTypes.length > 0) {
        const currentYear = new Date().getFullYear();

        for (const line of payrollLines) {
            // Only accrue based on 'work' hours, not 'leave' hours
            const workHours = (line.hours_breakdown as any[])
                .filter(b => b.type === 'work')
                .reduce((sum, h) => sum + Number(h.hours || 0), 0);

            for (const lt of leaveTypes) {
                const earned = workHours * (lt.accrual_rate || 0);
                if (earned <= 0) continue;

                const { data: currentBalance } = await supabase
                    .from('LeaveBalance')
                    .select('*')
                    .eq('employee_id', line.employee_id)
                    .eq('leave_type_id', lt.leave_type_id)
                    .eq('year', currentYear)
                    .single();

                if (currentBalance) {
                    await supabase
                        .from('LeaveBalance')
                        .update({
                            accrued_hours: Number(currentBalance.accrued_hours) + earned,
                            updated_at: new Date().toISOString()
                        })
                        .eq('balance_id', currentBalance.balance_id);
                } else {
                    await supabase.from('LeaveBalance').insert({
                        employee_id: line.employee_id,
                        leave_type_id: lt.leave_type_id,
                        business_id: businessId,
                        accrued_hours: earned,
                        taken_hours: 0,
                        pending_hours: 0,
                        year: currentYear
                    });
                }
            }
        }
    }

    return { ...payroll, total_gross: totalGross, lines_count: payrollLines.length };
}
