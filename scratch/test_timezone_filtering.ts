import { createAdminClient } from '../lib/supabase/admin';
import { createBusinessTimestamp, resolveTimezone } from '../lib/timezone-utils';

function parseShiftTime(isoStr: string, businessTimezone: string): Date {
  if (!isoStr) return new Date(0);
  if (isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr)) {
      return new Date(isoStr);
  }
  const [datePart, timePart] = isoStr.split('T');
  const hhmm = (timePart || '00:00').substring(0, 5);
  const utcIso = createBusinessTimestamp(datePart, hhmm, businessTimezone);
  return new Date(utcIso);
}

async function run() {
  const supabase = createAdminClient();
  const employeeId = 'BEA0016'; // Let's check BEA0016 first
  
  const { data: employee } = await supabase
    .from('Employee')
    .select('*, Business:business_id(timezone)')
    .eq('employee_id', employeeId)
    .single();

  if (!employee) {
    console.error('Employee not found');
    return;
  }

  const rawTz = (employee as any).Business?.timezone ?? null;
  const businessTimezone = resolveTimezone(rawTz);
  console.log('Employee:', employee.first_name, employee.last_name);
  console.log('Business Timezone:', businessTimezone);

  // Get shifts from the database like the API does
  const { data: shifts, error } = await supabase
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
    .eq('business_id', employee.business_id)
    .eq('shift_status', 'published')
    .order('shift_date', { ascending: true });

  if (error) {
    console.error('Error fetching shifts:', error);
    return;
  }

  console.log(`Fetched ${shifts?.length} shifts`);

  const now = new Date();
  console.log('Current system time (local):', now.toString());
  console.log('Current system time (ISO):', now.toISOString());

  for (const s of shifts || []) {
    const start = parseShiftTime(s.start_time, businessTimezone);
    const end = parseShiftTime(s.end_time, businessTimezone);
    
    console.log('\nShift ID:', s.shift_id);
    console.log('Raw start_time:', s.start_time);
    console.log('Parsed start (Date):', start.toString(), 'ISO:', start.toISOString());
    console.log('Raw end_time:', s.end_time);
    console.log('Parsed end (Date):', end.toString(), 'ISO:', end.toISOString());
    
    const isOngoing = start <= now && end >= now;
    const isUpcoming = start > now;
    const isPast = end < now;
    
    console.log('Classification:', { isOngoing, isUpcoming, isPast });
  }
}

run();
