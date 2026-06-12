import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { verifyKioskToken } from './lib/kiosk-auth';

export async function proxy(request: NextRequest) {
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
            return NextResponse.redirect(new URL('/kiosk/setup', request.url));
        }

        // Verify the token
        const payload = await verifyKioskToken(kioskToken.value);
        if (!payload) {
            // Invalid token => Redirect to setup page.
            return NextResponse.redirect(new URL('/kiosk/setup', request.url));
        }
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
        // Match all routes except Next.js internals, static assets, PWA files, and Stripe webhook
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)',
    ],
};
