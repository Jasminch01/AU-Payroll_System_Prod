import { createAdminClient } from '../lib/supabase/admin';

async function testRelation() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('Shift')
    .select(`
        shift_id,
        ShiftChecklistItem (
            status
        )
    `)
    .limit(5);

  console.log('Relation test result:', { error, count: data?.length, sample: data?.[0] });
}

testRelation();
