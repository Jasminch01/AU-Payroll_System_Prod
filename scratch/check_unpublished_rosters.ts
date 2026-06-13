import { createAdminClient } from '../lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();
  
  const { data: shifts } = await supabase
    .from('Shift')
    .select(`
      shift_id,
      employee_id,
      shift_status,
      Roster (
        status,
        published_at
      )
    `)
    .eq('shift_status', 'published');
    
  console.log('Published shifts count:', shifts?.length);
  
  const draftRosterShifts = (shifts || []).filter((s: any) => !s.Roster || (Array.isArray(s.Roster) ? s.Roster[0]?.status === 'draft' || !s.Roster[0]?.published_at : (s.Roster as any).status === 'draft' || !(s.Roster as any).published_at));
  console.log('Published shifts under draft rosters count:', draftRosterShifts?.length);
  
  for (const s of draftRosterShifts) {
    const roster: any = Array.isArray(s.Roster) ? s.Roster[0] : s.Roster;
    console.log({
      shift_id: s.shift_id,
      employee_id: s.employee_id,
      roster_status: roster?.status,
      roster_published_at: roster?.published_at
    });
  }
}

check();
