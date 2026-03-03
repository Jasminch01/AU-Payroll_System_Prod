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

    if (tsError || !timesheets || timesheets.length === 0) {
        return null;
    }

    // 2. Group by Employee
    const employeeGroups = timesheets.reduce((acc: Record<string, TimeSheet[]>, ts) => {
        if (!acc[ts.employee_id]) acc[ts.employee_id] = [];
        acc[ts.employee_id].push(ts);
        return acc;
    }, {});

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
    for (const [employeeId, logs] of Object.entries(employeeGroups)) {
        const grossWages = logs.reduce((sum, log) => sum + Number(log.gross_pay), 0);
        totalGross += grossWages;

        payrollLines.push({
            payroll_id: payroll.payroll_id,
            employee_id: employeeId,
            gross_wages: Number(grossWages.toFixed(2)),
            additions: 0,
            deductions: 0,
            net_pay: Number(grossWages.toFixed(2)), // Placeholder: net = gross
            hours_breakdown: logs.map(l => ({ date: l.date, hours: l.actual_hours, rate: l.hourly_rate })),
            payment_status: 'pending',
            payment_date: null
        });
    }

    // 5. Bulk insert lines
    const { error: linesErr } = await supabase
        .from('PayrollLine')
        .insert(payrollLines);

    if (linesErr) console.error('Error inserting payroll lines:', linesErr);

    // 6. Update total gross on parent
    await supabase
        .from('Payroll')
        .update({ total_gross: Number(totalGross.toFixed(2)), total_net: Number(totalGross.toFixed(2)) })
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
            const totalHours = (line.hours_breakdown as any[]).reduce((sum, h) => sum + Number(h.hours || 0), 0);

            for (const lt of leaveTypes) {
                if (!lt.accrual_rate) continue;

                const earned = totalHours * lt.accrual_rate;
                if (earned <= 0) continue;

                // Atomic increment in DB or fetch and update?
                // For simplicity in MVP, we fetch the current and add
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
                    // Fallback create if initialization failed earlier
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
