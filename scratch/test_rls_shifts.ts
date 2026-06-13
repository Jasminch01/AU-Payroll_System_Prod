import { createAdminClient } from '../lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

async function run() {
  const adminSupabase = createAdminClient();
  
  // Let's target BEA0016 (Jasmin Outlook, email: jasmin@outlook.com or whatever we can find)
  // Let's find the email of user '97d68398-6f23-49f2-9bcb-192fb163bc9f'
  const { data: userRecord, error: userError } = await adminSupabase.auth.admin.getUserById('97d68398-6f23-49f2-9bcb-192fb163bc9f');
  if (userError || !userRecord?.user) {
    console.error('Error fetching auth user:', userError);
    return;
  }
  
  const email = userRecord.user.email;
  console.log('User email:', email);
  
  // Update password to 'testpass123'
  console.log('Updating password...');
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
    '97d68398-6f23-49f2-9bcb-192fb163bc9f',
    { password: 'testpass123' }
  );
  
  if (updateError) {
    console.error('Error updating password:', updateError);
    return;
  }
  
  // Now initialize client with anon key
  const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Sign in
  console.log('Signing in with anon client...');
  const { data: sessionData, error: signInError } = await anonSupabase.auth.signInWithPassword({
    email: email!,
    password: 'testpass123'
  });
  
  if (signInError) {
    console.error('Error signing in:', signInError);
    return;
  }
  
  console.log('Signed in successfully. Token:', sessionData.session?.access_token.slice(0, 20) + '...');
  
  // Now query shifts using anonSupabase (enforces RLS!)
  const { data: shifts, error: queryError } = await anonSupabase
    .from('Shift')
    .select(`
        shift_id,
        shift_date,
        shift_status,
        roster_id,
        Roster (
            roster_id,
            status,
            published_at
        )
    `);
    
  console.log('Query result with RLS:');
  if (queryError) {
    console.error('Query error:', queryError);
  } else {
    console.log(`Fetched ${shifts?.length} shifts`);
    console.log(JSON.stringify(shifts, null, 2));
  }
}

run();
