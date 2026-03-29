"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IosInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IosInstallPrompt({ isOpen, onClose }: IosInstallPromptProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-sm overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                <Smartphone size={32} />
              </div>

              <h3 className="mb-2 text-xl font-bold">Install AU Payroll</h3>
              <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
                Install this app on your iPhone for a better experience and real-time notifications.
              </p>

              <div className="w-full space-y-4 text-left">
                <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--muted))]/50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                    <Share size={16} className="text-blue-500" />
                  </div>
                  <p className="text-sm">
                    Tap the <span className="font-semibold">Share</span> button in the Safari menu.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--muted))]/50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                    <PlusSquare size={16} className="text-gray-700" />
                  </div>
                  <p className="text-sm">
                    Scroll down and tap <span className="font-semibold">Add to Home Screen</span>.
                  </p>
                </div>
              </div>

              <Button onClick={onClose} className="mt-8 w-full" size="lg">
                Got it
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
