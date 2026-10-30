"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Shown above the title, e.g. the colour's hex. */
  eyebrow?: ReactNode;
}

/**
 * A bottom sheet that works with one thumb on a phone.
 *
 * It takes the whole lower half of the screen, scrolls on its own, and keeps
 * the page behind it still. Escape closes it, and focus moves into the sheet
 * so a keyboard or a screen reader lands in the right place.
 */
export function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  eyebrow,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="gal-sheet-layer" role="presentation">
      <button
        type="button"
        className="gal-sheet-scrim"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="gal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="gal-sheet-grab" aria-hidden="true" />
        <div className="gal-sheet-head">
          <div className="gal-sheet-headings">
            {eyebrow ? <div className="gal-sheet-eyebrow">{eyebrow}</div> : null}
            <h2 className="gal-sheet-title">{title}</h2>
            {subtitle ? <p className="gal-sheet-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="gal-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="gal-sheet-body">{children}</div>
        {footer ? <div className="gal-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
