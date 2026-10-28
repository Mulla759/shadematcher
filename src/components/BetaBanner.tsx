"use client";

import { useEffect, useState } from "react";
import { BETA_MODE, FEEDBACK_ENDPOINT, FEEDBACK_URL } from "@/lib/beta";

/**
 * Slim public-testing bar: says what state the build is in, collects feedback
 * in one click, and can be dismissed for the rest of the session.
 */
export function BetaBanner() {
  // Rendered server-side so the notice is visible without JavaScript; the
  // dismissal only applies once the component mounts.
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem("auriga:beta-dismissed") === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!BETA_MODE || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem("auriga:beta-dismissed", "1");
    } catch {
      // Private mode: the banner simply reappears next reload.
    }
    setDismissed(true);
    setOpen(false);
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (message.trim().length === 0) return;
    setState("sending");
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "feedback",
          message: message.trim(),
          email: email.trim() || undefined,
          path: window.location.pathname,
        }),
      });
      if (!response.ok) throw new Error("feedback failed");
      setState("sent");
      setMessage("");
      setEmail("");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="beta-bar" role="region" aria-label="Public beta">
      <div className="beta-bar-inner">
        <p className="beta-bar-note">
          <strong>Public beta.</strong> Colours are a guide — check the cloth in daylight.
        </p>
        <div className="beta-bar-actions">
          {FEEDBACK_URL ? (
            <a className="beta-bar-link" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
              Give feedback
            </a>
          ) : (
            <button
              type="button"
              className="beta-bar-link"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              Give feedback
            </button>
          )}
          <button type="button" className="beta-bar-close" onClick={dismiss} aria-label="Hide the beta notice">
            ×
          </button>
        </div>
      </div>

      {open && (
        <form className="beta-form" onSubmit={send}>
          <label className="beta-field">
            <span>What worked, what did not?</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2_000}
              rows={3}
              placeholder="The reading drifted when I moved away from the window…"
            />
          </label>
          <label className="beta-field beta-field--inline">
            <span>Email (optional, if you want a reply)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={200}
              placeholder="you@example.com"
            />
          </label>
          <div className="beta-form-actions">
            <button type="submit" className="beta-submit" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send"}
            </button>
            {state === "sent" && <span className="beta-form-status">Thank you — it landed.</span>}
            {state === "error" && <span className="beta-form-status beta-form-status--error">Could not send. Try again.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
