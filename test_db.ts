import { createAdminClient } from './lib/supabase/admin';

async function testConnection() {
  console.log('Testing Supabase connection with Admin Client...');
  try {
    const supabase = createAdminClient();
    
    // Check all employees to see statuses and business_ids
    const { data: employees, error: empError } = await supabase
      .from('Employee')
      .select('employee_id, first_name, last_name, status, business_id');
    
    if (empError) {
      console.error('Error fetching employees:', empError);
    } else {
      console.log('Employees found:', employees?.length);
      console.log('Sample employees:', employees?.slice(0, 5));
      
      const activeCount = employees?.filter(e => e.status === 'active').length;
      console.log('Active count (manual filter):', activeCount);
    }

    // Check User table
    const { data: users, error: userError } = await supabase
      .from('User')
      .select('*');
    
    if (userError) {
      console.error('Error fetching users:', userError);
    } else {
      console.log('Users found:', users?.length);
      console.log('Sample users:', users?.map(u => ({ user_id: u.user_id, role: u.role, business_id: u.business_id })));
    }

    // Check Business table
    const { data: businesses, error: bizError } = await supabase
      .from('Business')
      .select('*');
    
    if (bizError) {
      console.error('Error fetching businesses:', bizError);
    } else {
      console.log('Businesses found:', businesses?.length);
      console.log('Sample businesses:', businesses?.map(b => ({ business_id: b.business_id, business_name: b.business_name })));
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();
