"use client";

import { useState, useEffect } from 'react';

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS (iPhone, iPad, iPod — including iPad Pro which reports MacIntel)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Check if already running as installed PWA
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // iOS: show install option if not already installed
    // (iOS never fires beforeinstallprompt — we handle iOS separately via the modal)
    if (isIOSDevice && !isStandaloneMode) {
      setIsInstallable(true);
    }

    // Android / Chrome: listen for the native install prompt
    const handler = (e: any) => {
      e.preventDefault(); // prevent mini-infobar
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Hide install button once the app is actually installed
    const handleInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installPWA = async (): Promise<boolean> => {
    // iOS: caller is responsible for showing the manual instructions modal
    if (isIOS) return false;

    if (!deferredPrompt) return false;

    // Show the native Android/Chrome install prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setIsInstallable(false);
      return true;
    }
    return false;
  };

  return { isInstallable, installPWA, isIOS, isStandalone };
}