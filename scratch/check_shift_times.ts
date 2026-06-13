import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data: shifts, error } = await supabase
    .from('Shift')
    .select('shift_id, shift_status, start_time, end_time')
    .limit(3);

  if (error) {
    console.error('Error fetching shifts:', error);
    return;
  }

  console.log('Sample shifts from database:');
  for (const s of shifts || []) {
    console.log({
      shift_id: s.shift_id,
      shift_status: s.shift_status,
      start_time: s.start_time,
      end_time: s.end_time,
      parsed_start: new Date(s.start_time).toISOString(),
      parsed_end: new Date(s.end_time).toISOString(),
      now: new Date().toISOString(),
      is_start_in_past: new Date() >= new Date(s.start_time),
      is_end_in_past: new Date() >= new Date(s.end_time),
    });
  }
}

main();
