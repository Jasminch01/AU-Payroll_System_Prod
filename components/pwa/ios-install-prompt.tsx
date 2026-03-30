"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, PlusSquare, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IosInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IosInstallPrompt({ isOpen, onClose }: IosInstallPromptProps) {
  const [step, setStep] = useState<"instructions" | "done">("instructions");

  const handleGotIt = () => {
    setStep("done");
    // Give the user a moment to read the confirmation, then close
    setTimeout(() => {
      setStep("instructions"); // reset for next time
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setStep("instructions");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-full p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <X size={18} />
            </button>

            <AnimatePresence mode="wait">
              {step === "instructions" ? (
                <motion.div
                  key="instructions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))]">
                    <Smartphone size={32} />
                  </div>

                  <h3 className="mb-2 text-xl font-bold">Install AU Payroll</h3>
                  <p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">
                    Install this app on your iPhone for a better experience and real-time notifications.
                  </p>

                  {/* Important clarification for iOS users */}
                  <p className="mb-6 text-xs text-[hsl(var(--muted-foreground))]/70 bg-[hsl(var(--muted))]/30 rounded-lg px-3 py-2 w-full text-left">
                    ℹ️ On iPhone, installation is done through Safari — follow the two steps below.
                  </p>

                  <div className="w-full space-y-3 text-left mb-6">
                    {/* Step 1 */}
                    <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--muted))]/50 p-3 border border-[hsl(var(--border))]/50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                        <Share size={16} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-0.5">STEP 1</p>
                        <p className="text-sm">
                          Tap the <span className="font-bold text-blue-500">Share</span> button{" "}
                          <span className="text-[hsl(var(--muted-foreground))]">(the box with an arrow)</span> at the bottom of Safari.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--muted))]/50 p-3 border border-[hsl(var(--border))]/50">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                        <PlusSquare size={16} className="text-gray-700" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-0.5">STEP 2</p>
                        <p className="text-sm">
                          Scroll down in the share menu and tap{" "}
                          <span className="font-bold">Add to Home Screen</span>, then tap <span className="font-bold">Add</span>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleGotIt} className="w-full" size="lg">
                    Got it — I'll do this now
                  </Button>

                  <button
                    onClick={handleClose}
                    className="mt-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    Maybe later
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center py-4"
                >
                  <CheckCircle size={48} className="text-green-500 mb-3" />
                  <h3 className="text-lg font-bold mb-1">Follow the steps above!</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Tap the Share button in Safari, then "Add to Home Screen".
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}