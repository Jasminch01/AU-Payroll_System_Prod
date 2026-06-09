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
    const isOwnerRoute = pathname.startsWith('/owner');
    const isManagerRoute = pathname.startsWith('/manager');
    const isEmployeeRoute = pathname.startsWith('/employee');

    if (isOwnerRoute || isManagerRoute || isEmployeeRoute) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        let role = user.user_metadata?.role;
        let businessId = user.user_metadata?.business_id;

        if (!role || !businessId) {
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
                role = userRecord.role;
                businessId = userRecord.business_id;
                metadataToSet = {
                    role: userRecord.role,
                    business_id: userRecord.business_id,
                    first_name: userRecord.first_name,
                    last_name: userRecord.last_name,
                    employee_id: employeeRecord?.employee_id,
                    can_order_liquor: userRecord.can_order_liquor ?? false,
                };
            } else if (employeeRecord) {
                role = 'employee';
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

        // Enforce role-based access
        if (isOwnerRoute && role !== 'owner') {
            const fallback = role === 'manager' ? '/manager/dashboard' : '/employee/dashboard';
            return NextResponse.redirect(new URL(role ? fallback : '/login', request.url));
        }

        if (isManagerRoute && role !== 'manager' && role !== 'owner') {
            const fallback = role === 'owner' ? '/owner/dashboard' : '/employee/dashboard';
            return NextResponse.redirect(new URL(role ? fallback : '/login', request.url));
        }

        if (isEmployeeRoute && role !== 'employee') {
            const fallback = role === 'owner' ? '/owner/dashboard' : '/manager/dashboard';
            return NextResponse.redirect(new URL(role ? fallback : '/login', request.url));
        }
    }

    return supabaseResponse;
}
