"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";

/** Non-blocking messages: never needs dismissing. Sits near the top of the stage, under the order's name plate and clear of the instruction line. */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => clearToast(toast.id), 3600);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[9.75rem] z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="sf-tile sf-tone-deep max-w-md rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
