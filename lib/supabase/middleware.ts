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

        // Fetch user role
        // Check User table first (Owner/Manager)
        const { data: userRecord } = await supabase
            .from('User')
            .select('role')
            .eq('user_id', user.id)
            .single();

        let role: string | null = userRecord?.role || null;

        if (!role) {
            // Check Employee table
            const { data: employeeRecord } = await supabase
                .from('Employee')
                .select('employee_id')
                .eq('user_id', user.id)
                .single();

            if (employeeRecord) {
                role = 'employee';
            }
        }

        // Enforce role-based access
        if (isOwnerRoute && role !== 'owner') {
            const fallback = role === 'manager' ? '/manager/dashboard' : '/employee/dashboard';
            return NextResponse.redirect(new URL(role ? fallback : '/login', request.url));
        }

        if (isManagerRoute && role !== 'manager') {
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
