console.log('Checking Environment Variables...');
console.log('URL Type:', typeof process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('ANON_KEY Type:', typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('SERVICE_ROLE_KEY Type:', typeof process.env.SUPABASE_SERVICE_ROLE_KEY);

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log('URL starts with https:', process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https'));
}
if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('ANON_KEY length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length);
}
