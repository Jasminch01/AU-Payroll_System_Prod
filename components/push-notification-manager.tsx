'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

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

  const subscribeToPush = async (isSilent: boolean = false) => {
    if (!isSilent) console.log('[PushManager] Starting subscribeToPush process...');
    if (!isSilent) toast.dismiss();
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported by this browser.');
      }
      if (!('PushManager' in window)) {
        throw new Error('Push notifications are not supported by this browser.');
      }

      if (!isSilent) console.log('[PushManager] Requesting permission...');
      const permission = await Notification.requestPermission();
      if (!isSilent) console.log('[PushManager] Permission status:', permission);
      
      if (permission !== 'granted') {
        if (!isSilent) {
          toast.error("Notifications were not allowed.", {
            description: "You can enable them in your browser/device settings."
          });
        }
        return;
      }

      if (!isSilent) console.log('[PushManager] Waiting for service worker to be ready...');
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration) {
        if (!isSilent) toast.error("Service worker not active yet.");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        if (!isSilent) toast.error("Missing configuration", { description: "VAPID public key not found in env" });
        console.error('VAPID public key not found in env');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      if (!isSilent) toast.loading("Communicating with push service...", { id: 'push-sub' });

      // Unsubscribe first to ensure a clean slate if we're re-registering
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

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

      if (!isSilent) toast.dismiss('push-sub');

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      if (!isSilent) {
        toast.success("Push notifications enabled!", {
          description: "This device is now registered to receive realtime updates."
        });
      } else {
        console.log('[PushManager] Silent subscription successful');
      }

    } catch (error: any) {
      if (!isSilent) {
        toast.dismiss('push-sub');
        console.error('Error subscribing to push:', error);
        toast.error("Failed to enable push notifications.", {
          description: error.message || "Ensure your browser supports web push and try again."
        });
      } else {
        console.error('[PushManager] Silent subscription error:', error);
      }
    }
  };

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.user_id && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);

      // Silently sync the subscription to the backend.
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
            } else {
              // We have permission, but no subscription exists (e.g., SW was re-registered or sub lost)
              console.log('[PushManager] Permission granted but no active subscription found. Silently subscribing...');
              await subscribeToPush(true);
            }
          } catch (e) {
            console.error('Silent push subscription sync failed:', e);
          }
        }
      };

      syncSubscription();

      const checkPermission = async () => {
        // Only trigger the prompt if the app is actually installed (PWA Standalone)
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        if (isPWA && Notification.permission === 'default') {
          console.log('[PushManager] Automatically triggering native OS prompt...');
          subscribeToPush(false);
        }
      };

      // Delay the check slightly to let the app load cleanly
      const timer = setTimeout(checkPermission, 3000);

      // Also trigger prompt immediately if PWA installation finishes
      window.addEventListener('appinstalled', checkPermission);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('appinstalled', checkPermission);
      };
    }
  }, [isAuthenticated, user?.user_id]);

  // Expose the subscribe function to the window
  useEffect(() => {
    const handleTrigger = () => subscribeToPush(false);
    window.addEventListener('trigger-push-subscribe', handleTrigger);
    return () => window.removeEventListener('trigger-push-subscribe', handleTrigger);
  }, []);

  // We do not render any UI inline; we only use toasts.
  return null;
}
