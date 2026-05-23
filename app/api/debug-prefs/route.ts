import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    const supabase = createAdminClient();
    
    // Check notifications table for latest ATTENDANCE_CLOCK_EVENT
    const { data: notifs } = await supabase.from('notifications')
        .select('*')
        .eq('type', 'ATTENDANCE_CLOCK_EVENT')
        .order('created_at', { ascending: false })
        .limit(5);

    return NextResponse.json({ notifs });
}
