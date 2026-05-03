import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY as string;

// Initialize web-push if keys are available
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@au-payroll.com',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('VAPID keys are missing! Push notifications cannot be sent.');
}

/**
 * Sends a push notification to all recorded devices for a specific user.
 * 
 * @param userId - The ID of the Supabase user to notify
 * @param title - Notification title
 * @param body - Notification body/message
 * @param url - The URL to redirect to when notification is clicked
 */
export async function sendPushNotification(userId: string, title: string, body: string, url: string = '/') {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('Cannot send push notification: VAPID keys not configured.');
    return;
  }

  const supabase = await createClient();
  
  // Get all active subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching subscriptions from Supabase:', error);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.warn(`[Push Service] No active subscriptions found for user ${userId}. Push skipped.`);
    return; // User has no subscriptions
  }

  const payload = JSON.stringify({ title, body, url });


  const notifications = subscriptions.map((sub: any) => 
    webpush.sendNotification(sub.subscription, payload)
      .then(() => {})
      .catch((err: any) => {
         // Auto-delete expired/invalid subscriptions
         if (err.statusCode === 404 || err.statusCode === 410) {
            const expiredEndpoint = sub.subscription.endpoint;

            // Try deleting by the dedicated endpoint column first; fall back to filtering the jsonb
            supabase.from('push_subscriptions')
                .delete()
                .eq('user_id', userId)
                .eq('endpoint', expiredEndpoint)
                .then(({ error, count }) => {
                   if (error || count === 0) {
                     // Fallback: filter on the jsonb endpoint field
                     return supabase.from('push_subscriptions')
                       .delete()
                       .eq('user_id', userId)
                       .filter('subscription->>endpoint', 'eq', expiredEndpoint);
                   }
                })
                .then(({ error }: any = {}) => {
                   if (error) console.error('[Push Service] Failed to cleanup expired subscription', error);
                });
         } else {
            console.error('[Push Service] Error delivering signal to one endpoint:', err);
         }
      })
  );

  await Promise.allSettled(notifications);
}
