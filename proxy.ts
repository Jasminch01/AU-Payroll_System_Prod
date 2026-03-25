import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { verifyKioskToken } from './lib/kiosk-auth';

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check kiosk security before standard routing
    if (pathname === '/kiosk' || pathname.startsWith('/kiosk/')) {
        // Exception: allowed to visit setup
        if (pathname === '/kiosk/setup') {
            return await updateSession(request);
        }

        const kioskToken = request.cookies.get('device_kiosk_token');
        if (!kioskToken) {
            // No token => Block Kiosk access. Redirect to setup page.
            return Response.redirect(new URL('/kiosk/setup', request.url));
        }

        // Verify the token
        const payload = await verifyKioskToken(kioskToken.value);
        if (!payload) {
            // Invalid token => Redirect to setup page.
            return Response.redirect(new URL('/kiosk/setup', request.url));
        }
    }

    // Check auth status for root page to intercept logged in users
    if (pathname === '/') {
        const response = await updateSession(request);

        // Check if there is a session cookie
        const authCookie = request.cookies.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0] + '-auth-token');

        if (authCookie) {
            try {
                // Parse the session cookie to get the user data
                // The cookie is a JSON array stringified
                const sessionStr = decodeURIComponent(authCookie.value);

                // Hacky check for base64 encoded JSON
                let decodedStr = sessionStr;
                if (sessionStr.startsWith('base64-')) {
                    decodedStr = atob(sessionStr.replace('base64-', ''));
                }

                const sessionData = JSON.parse(decodedStr);

                // Note: The role is usually stored in the DB, not the raw JWT, unless customized. 
                // Since edge middleware can't efficiently query the DB on every request, 
                // the safest approach is to redirect them to a generic dashboard handler, or their primary entry point
                // and let the client-side/server-components route them further if needed.

                // For now, redirect to /owner/dashboard as a catch-all if they are logged in.
                // If they don't have access, the dashboard's own layout/protection will bounce them.
                return Response.redirect(new URL('/owner/dashboard', request.url));

            } catch (e) {
                // Ignore parse errors, just continue to landing page
            }
        }

        return response;
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
        // Match all routes except static files and API auth routes
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
