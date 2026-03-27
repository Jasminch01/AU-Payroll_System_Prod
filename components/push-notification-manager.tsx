'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);

      // Silently sync the subscription to the backend. Useful for when a user 
      // subscribes while logged out, and later logs in.
      const syncSubscription = async () => {
        if (Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
               await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscription: sub }),
               });
            }
          } catch (e) {
             console.error('Silent push subscription sync failed:', e);
          }
        }
      };
      
      syncSubscription();
      
      const checkPermission = async () => {
        if (Notification.permission === 'default' && !localStorage.getItem('push_prompt_dismissed')) {
          // Show a toast to prompt the user
          toast("Enable Push Notifications", {
            description: "Get notified immediately about your latest shifts, updates, and more.",
            duration: Infinity, // Keep it visible until action is taken
            action: {
              label: "Enable",
              onClick: subscribeToPush
            },
            cancel: {
              label: "Later",
              onClick: () => localStorage.setItem('push_prompt_dismissed', 'true')
            }
          });
        }
      };
      
      // Delay the check slightly to let the app load cleanly without immediate interruptions
      const timer = setTimeout(checkPermission, 3000);

      // Also trigger prompt immediately if PWA installation finishes
      window.addEventListener('appinstalled', checkPermission);

      return () => {
          clearTimeout(timer);
          window.removeEventListener('appinstalled', checkPermission);
      };
    }
  }, []);

  const subscribeToPush = async () => {
    toast.dismiss();
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
         toast.error("Notifications were not allowed.", {
             description: "You can enable them in your browser/device settings."
         });
         return;
      }

      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
         toast.error("Service worker not active yet.");
         return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
         console.error('VAPID public key not found in env');
         return;
      }
      
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      
      const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
      });

      // Send the subscription to the backend using the existing route
      const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
          throw new Error('Failed to save subscription');
      }

      toast.success("Push notifications enabled!", {
          description: "You're all set to receive realtime shift updates."
      });
      
    } catch (error) {
       console.error('Error subscribing to push:', error);
       toast.error("Failed to enable push notifications.", {
           description: "Ensure your browser supports web push and try again."
       });
    }
  };

  // We do not render any UI inline; we only use toasts.
  return null;
}
