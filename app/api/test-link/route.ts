import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const ac = createAdminClient();
    const res = await ac.auth.admin.generateLink({ type: 'magiclink', email: 'test@example.com', options: { redirectTo: 'http://localhost:3000/onboarding' } });
    return Response.json(res);
}
