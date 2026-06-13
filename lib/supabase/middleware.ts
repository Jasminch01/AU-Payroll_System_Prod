import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh the auth session
    const { data: { user } } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isRootRoute = pathname === '/';
    const isOwnerRoute = pathname.startsWith('/owner');
    const isManagerRoute = pathname.startsWith('/manager');
    const isEmployeeRoute = pathname.startsWith('/employee');

    // Helper to perform redirects while ensuring updated session cookies are preserved
    const redirectWithCookies = (destination: string) => {
        const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value, {
                path: cookie.path,
                domain: cookie.domain,
                maxAge: cookie.maxAge,
                expires: cookie.expires,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
            });
        });
        return redirectResponse;
    };

    let resolvedRole = user?.user_metadata?.role;
    let businessId = user?.user_metadata?.business_id;

    if (user && (!resolvedRole || !businessId || !('employee_id' in (user.user_metadata || {})))) {
        // Fetch employee and user records safely (cache miss)
        const empPromise = supabase
            .from('Employee')
            .select('employee_id, business_id, first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle();

        let userRes = await supabase
            .from('User')
            .select('role, business_id, first_name, last_name, can_order_liquor')
            .eq('user_id', user.id)
            .maybeSingle();

        // Fallback if can_order_liquor column is missing in database
        if (userRes.error && userRes.error.message.includes('can_order_liquor')) {
            userRes = await supabase
                .from('User')
                .select('role, business_id, first_name, last_name')
                .eq('user_id', user.id)
                .maybeSingle();
        }

        const userRecord = userRes.data;
        const { data: employeeRecord } = await empPromise;

        let metadataToSet: any = null;

        if (userRecord) {
            resolvedRole = userRecord.role;
            businessId = userRecord.business_id;
            metadataToSet = {
                role: userRecord.role,
                business_id: userRecord.business_id,
                first_name: userRecord.first_name,
                last_name: userRecord.last_name,
                employee_id: employeeRecord?.employee_id || 'none',
                can_order_liquor: userRecord.can_order_liquor ?? false,
            };
        } else if (employeeRecord) {
            resolvedRole = 'employee';
            businessId = employeeRecord.business_id;
            metadataToSet = {
                role: 'employee',
                business_id: employeeRecord.business_id,
                first_name: employeeRecord.first_name ?? '',
                last_name: employeeRecord.last_name ?? '',
                employee_id: employeeRecord.employee_id,
                can_order_liquor: false,
            };
        }

        // Sync/cache metadata in background for future fast checks
        if (metadataToSet) {
            supabase.auth.updateUser({
                data: metadataToSet
            }).catch(err => {
                console.error('[Middleware] Background metadata update failed:', err);
            });
        }
    }

    // Intercept logged in users visiting the root/landing page
    if (isRootRoute) {
        if (user) {
            const dashboard = resolvedRole === 'owner'
                ? '/owner/dashboard'
                : (resolvedRole === 'manager' || resolvedRole === 'supervisor')
                    ? '/manager/dashboard'
                    : '/employee/dashboard';
            return redirectWithCookies(dashboard);
        }
        return supabaseResponse;
    }

    // Protect dashboard routes and enforce role-based access
    if (isOwnerRoute || isManagerRoute || isEmployeeRoute) {
        if (!user) {
            return redirectWithCookies('/login');
        }

        // Enforce role-based access
        if (isOwnerRoute && resolvedRole !== 'owner') {
            const fallback = resolvedRole === 'manager' ? '/manager/dashboard' : '/employee/dashboard';
            return redirectWithCookies(resolvedRole ? fallback : '/login');
        }

        if (isManagerRoute) {
            const isSupervisor = resolvedRole === 'supervisor';
            // Allow supervisors to access specific manager routes, including dashboard
            const allowedSupervisorPaths = ['/manager/roster', '/manager/attendance', '/manager/dashboard'];
            
            if (resolvedRole !== 'manager' && resolvedRole !== 'owner' && !isSupervisor) {
                const fallback = resolvedRole === 'owner' ? '/owner/dashboard' : '/employee/dashboard';
                return redirectWithCookies(resolvedRole ? fallback : '/login');
            }
            
            // If supervisor tries to access a restricted manager route, send them to manager dashboard
            if (isSupervisor && !allowedSupervisorPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
                return redirectWithCookies('/manager/dashboard');
            }
        }

        if (isEmployeeRoute && resolvedRole !== 'employee') {
            const fallback = resolvedRole === 'owner' ? '/owner/dashboard' : '/manager/dashboard';
            return redirectWithCookies(resolvedRole ? fallback : '/login');
        }
    }

    return supabaseResponse;
}
