"use client";

import { useEffect } from "react";
import { FEEDBACK_ENDPOINT } from "@/lib/beta";

/**
 * Reports uncaught client errors to the feedback endpoint so they land in the
 * server log during public testing. No stack traces are stored and nothing is
 * sent that the page did not already contain.
 */
export function ErrorReporter() {
  useEffect(() => {
    function report(kind: "error" | "rejection", detail: string) {
      try {
        void fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "error",
            message: detail.slice(0, 1_000),
            path: window.location.pathname,
            context: kind,
          }),
          keepalive: true,
        });
      } catch {
        // Reporting must never break the page.
      }
    }

    function onError(event: ErrorEvent) {
      report("error", event.message || "Unknown client error");
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      report("rejection", reason instanceof Error ? reason.message : String(reason));
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
