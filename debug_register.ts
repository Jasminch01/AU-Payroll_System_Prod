import { createAdminClient } from './lib/supabase/admin';

async function debugRegister() {
  console.log('Testing Business Registration Logic...');
  const supabase = createAdminClient();

  const business_name = "Debug Business " + Date.now();
  const abnClean = "12345678901";
  const state = "NSW";

  console.log('Step 1: Inserting Business record...');
  const { data: businessData, error: businessError } = await supabase
      .from('Business')
      .insert({
          business_name,
          abn: abnClean,
          state,
      })
      .select()
      .single();

  if (businessError) {
      console.error('Failed to create business:', businessError);
      return;
  }

  console.log('Business created:', businessData);

  const userId = '00000000-0000-0000-0000-000000000000'; // Dummy UID for admin test

  console.log('Step 2: Inserting User record...');
  const { data: userData, error: userError } = await supabase
      .from('User')
      .insert({
          user_id: userId,
          business_id: businessData.business_id,
          role: 'owner',
          first_name: 'Debug',
          last_name: 'User',
      })
      .select()
      .single();

  if (userError) {
      console.error('Failed to create user profile:', userError);
      return;
  }

  console.log('User profile created:', userData);
}

debugRegister();
