"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PwaInstallBannerProps {
  isVisible: boolean;
  onInstall: () => void;
  onClose: () => void;
}

export function PwaInstallBanner({ isVisible, onInstall, onClose }: PwaInstallBannerProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-lg overflow-hidden rounded-2xl border border-[hsl(var(--brand))]/20 bg-[hsl(var(--card))]/90 p-4 shadow-xl backdrop-blur-lg md:hidden sm:bottom-8"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--brand))] text-white shadow-lg shadow-[hsl(var(--brand))]/20">
              <Download size={24} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-[hsl(var(--foreground))] truncate">Install AU Payroll</h4>
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                Add to home screen for faster access and offline support.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onInstall} className="shadow-sm">
                Install
              </Button>
              <button 
                onClick={onClose}
                className="rounded-full p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
