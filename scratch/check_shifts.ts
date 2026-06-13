import { createAdminClient } from '../lib/supabase/admin';

async function diagnose() {
  const supabase = createAdminClient();
  
  // Get all users
  const { data: users } = await supabase.from('User').select('*');
  console.log('--- USERS ---');
  console.table(users?.map(u => ({
    user_id: u.user_id,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    business_id: u.business_id
  })));

  // Get all employees
  const { data: employees } = await supabase.from('Employee').select('*');
  console.log('\n--- EMPLOYEES ---');
  console.table(employees?.map(e => ({
    employee_id: e.employee_id,
    user_id: e.user_id,
    first_name: e.first_name,
    last_name: e.last_name,
    business_id: e.business_id,
    status: e.status
  })));

  // Get shifts and group them by employee
  const { data: shifts } = await supabase.from('Shift').select('*');
  console.log('\n--- SHIFTS COUNT BY EMPLOYEE ---');
  const countByEmp: Record<string, { total: number, published: number, draft: number }> = {};
  for (const s of shifts || []) {
    const key = s.employee_id || 'unassigned';
    if (!countByEmp[key]) {
      countByEmp[key] = { total: 0, published: 0, draft: 0 };
    }
    countByEmp[key].total++;
    if (s.shift_status === 'published') countByEmp[key].published++;
    else countByEmp[key].draft++;
  }
  console.table(countByEmp);
}

diagnose();
