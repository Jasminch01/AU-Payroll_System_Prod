import { createAdminClient } from '../lib/supabase/admin';

async function checkSchema() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_schema_info', {}); // maybe not exists
  
  if (error) {
    // Try querying information_schema
    const { data: cols, error: colsError } = await supabase
      .from('_prisma_migrations') // check if prisma is used
      .select('*')
      .limit(1);
    
    console.log('Prisma test:', { colsError });
    
    // Let's run a raw sql query via supabase or check tables
    // Since we don't have a direct raw SQL endpoint, we can do a query to see column names
    const { data: shiftSample } = await supabase
      .from('Shift')
      .select('*')
      .limit(1);
    
    console.log('Shift sample keys:', Object.keys(shiftSample?.[0] || {}));
    console.log('Shift sample data:', shiftSample?.[0]);
  } else {
    console.log('Schema info:', data);
  }
}

checkSchema();
