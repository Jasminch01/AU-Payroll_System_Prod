import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { signKioskToken } from '@/lib/kiosk-auth';

// POST /api/kiosk/authorize
// Manager authorizes a browser as a Kiosk device
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) { }
                }
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return errorResponse('Unauthorized. Please log in as an owner or manager.', 401);
        }

        // Fetch user metadata/business
        const { data: userData, error: userError } = await supabase
            .from('User')
            .select('role, business_id')
            .eq('user_id', user.id)
            .single();

        if (userError || !userData || (userData.role !== 'owner' && userData.role !== 'manager')) {
            return errorResponse('Only owners and managers can authorize a kiosk device.', 403);
        }

        const token = await signKioskToken(userData.business_id);

        // Calculate expires Date for cookies (10 years)
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 10);

        // We can't set cookies via the standard NextResponse directly easily with 'cookies()',
        // but wait, we can just use `cookieStore.set` in Nextjs 14+:
        // Actually, returning a Next.js `Response` with `Set-Cookie` header is safer

        const response = successResponse({ authorized: true, redirect: '/kiosk' }, 'Kiosk device authorized securely');
        response.cookies.set('device_kiosk_token', token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: expires
        });

        return response;
    } catch (err) {
        console.error('Kiosk Auth Error:', err);
        return errorResponse('Internal error authorizing kiosk', 500);
    }
}
