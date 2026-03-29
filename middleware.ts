import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { verifyKioskToken } from './lib/kiosk-auth';

export async function middleware(request: NextRequest) {
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
                const sessionStr = decodeURIComponent(authCookie.value);

                // Check for base64 encoded JSON
                let decodedStr = sessionStr;
                if (sessionStr.startsWith('base64-')) {
                    decodedStr = atob(sessionStr.replace('base64-', ''));
                }

                const sessionData = JSON.parse(decodedStr);

                // Redirect to owner/dashboard if they are logged in.
                // The dashboard itself will handle specific role redirects if necessary.
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
        // Match all routes except Next.js internals, static assets, and PWA files
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)',
    ],
};