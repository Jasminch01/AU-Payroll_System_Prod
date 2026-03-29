import { createClient } from './lib/supabase/server';


async function checkTable() {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('push_subscriptions')
            .select('count')
            .limit(1);

        if (error) {
            console.error('push_subscriptions table does NOT exist or is inaccessible:', error.message);
        } else {
            console.log('push_subscriptions table exists.');
        }

        const { error: notifError } = await supabase
            .from('notifications')
            .select('count')
            .limit(1);

        if (notifError) {
            console.error('notifications table does NOT exist or is inaccessible:', notifError.message);
        } else {
            console.log('notifications table exists.');
        }
    } catch (err) {
        console.error('Error checking table:', err);
    }
}

checkTable();
