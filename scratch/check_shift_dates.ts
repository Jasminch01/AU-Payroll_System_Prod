import { createAdminClient } from '../lib/supabase/admin';

async function checkShiftDates() {
  const supabase = createAdminClient();
  
  const { data: shifts } = await supabase
    .from('Shift')
    .select(`
      shift_id,
      shift_date,
      start_time,
      created_at,
      updated_at,
      shift_status,
      Roster (
        published_at
      )
    `)
    .eq('employee_id', 'BEA0016');
    
  console.log('Shifts for BEA0016:');
  console.log(JSON.stringify(shifts, null, 2));
}

checkShiftDates();
