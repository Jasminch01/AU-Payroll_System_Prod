import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    const supabase = createAdminClient();
    const { data: notifs } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(2);
    return NextResponse.json({ notifs });
}
