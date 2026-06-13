import { createAdminClient } from '../lib/supabase/admin';

async function checkPolicies() {
  const supabase = createAdminClient();
  
  const { data: policies, error } = await supabase.rpc('get_policies_for_table', { table_name: 'Shift' });
  
  if (error) {
    console.log('rpc get_policies_for_table failed:', error.message);
    
    // Query pg_policies directly using a raw query if possible, but we don't have direct sql.
    // Let's see if we can query via normal postgres views if mapped, or try a different rpc.
    // Wait, let's see if there is any other rpc or if we can run custom sql.
    // Supabase has no raw sql execution unless we create a function.
    // Let's check if we can inspect database schema or RLS by reading migrations or documentation.
  } else {
    console.log('Policies for Shift:', policies);
  }
  
  // Let's try to query pg_policies using custom select from pg_catalog if exposed
  const { data: pgPolicies, error: pgError } = await supabase
    .from('pg_policies' as any)
    .select('*')
    .limit(10);
    
  console.log('pg_policies query result:', { pgPolicies, pgError });
}

checkPolicies();
