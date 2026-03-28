import { createClient } from '@supabase/supabase-js';

async function testAnonInsert() {
  console.log('Testing Business Insert with Anon Key...');
  
  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const business_name = "Anon Test Business " + Date.now();
  const abnClean = "12345678901";
  const state = "NSW";

  const { data, error } = await supabase
      .from('Business')
      .insert({
          business_name,
          abn: abnClean,
          state,
      })
      .select()
      .single();

  if (error) {
      console.error('Anon insert failed:', error);
  } else {
      console.log('Anon insert succeeded:', data);
  }
}

testAnonInsert();
