import { createAdminClient } from '../lib/supabase/admin';

async function runDiagnosisFor(userId: string, employeeId: string | null, businessId: string) {
  const supabase = createAdminClient();
  
  console.log(`\n================ DIAGNOSIS FOR user_id: ${userId}, employee_id: ${employeeId} ================`);
  
  const diagnosis: any = {};
  
  // 1. Employee Record
  if (employeeId) {
    const { data: empRecord } = await supabase
      .from('Employee')
      .select('*')
      .eq('employee_id', employeeId)
      .single();
    diagnosis.employeeRecord = empRecord ? { status: empRecord.status, business_id: empRecord.business_id } : null;
  }
  
  // 2. All shifts for this employee (no filters)
  if (employeeId) {
    const { data: allShifts, error: shiftsError } = await supabase
      .from('Shift')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('business_id', businessId);
      
    diagnosis.allShifts = {
      count: allShifts?.length || 0,
      error: shiftsError?.message,
      sample: allShifts?.map(s => ({ shift_id: s.shift_id, shift_status: s.shift_status, shift_date: s.shift_date, start_time: s.start_time })),
    };
  }
  
  // 3. Exact query from /api/shifts/me
  if (employeeId) {
    const { data: visibleShifts, error: queryError } = await supabase
      .from('Shift')
      .select(`
          *,
          Roster (
              roster_id,
              status,
              start_date,
              end_date,
              published_at
          )
      `)
      .eq('employee_id', employeeId)
      .eq('business_id', businessId)
      .eq('shift_status', 'published')
      .order('shift_date', { ascending: true });
      
    diagnosis.visibleShiftsQuery = {
      count: visibleShifts?.length || 0,
      error: queryError?.message,
      shifts: visibleShifts?.map(s => ({
        shift_id: s.shift_id,
        shift_status: s.shift_status,
        roster_status: s.Roster?.status,
        roster_published_at: s.Roster?.published_at
      }))
    };
  }
  
  console.log(JSON.stringify(diagnosis, null, 2));
}

async function start() {
  // Let's diagnose for BEA0001 (manager) and BEA0016 (employee) under business 9dc6e37e-d2b4-4910-9ad8-ee50c74b3ddb
  await runDiagnosisFor('ba8b55fe-3136-4700-89e0-acb216e06c4c', 'BEA0001', '9dc6e37e-d2b4-4910-9ad8-ee50c74b3ddb');
  await runDiagnosisFor('97d68398-6f23-49f2-9bcb-192fb163bc9f', 'BEA0016', '9dc6e37e-d2b4-4910-9ad8-ee50c74b3ddb');
}

start();
