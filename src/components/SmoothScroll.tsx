"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Lenis, { type ScrollToOptions } from "lenis";

export type SmoothScrollValue = {
  /** The live Lenis instance, or null before it mounts. */
  lenis: Lenis | null;
  /** True while the header should stay out of the way (scrolling down). */
  hidden: boolean;
  /** True once the page has moved past the opening frame. */
  scrolled: boolean;
  /** Current interpolated scroll offset. */
  scrollY: number;
  /** Scroll to an element or offset, using Lenis so it stays in sync. */
  scrollTo: (target: string | number, options?: ScrollToOptions) => void;
};

const SmoothScrollContext = createContext<SmoothScrollValue>({
  lenis: null,
  hidden: false,
  scrolled: false,
  scrollY: 0,
  scrollTo: () => {},
});

/** Distance past the top before the header starts hiding on the way down. */
const HIDE_AFTER = 140;
/** Smallest movement that counts as a new scroll direction. */
const DIRECTION_EPSILON = 2;
/** How far the reader may drift from a target before we stop correcting it. */
const ANCHOR_TOLERANCE = 240;

/** Resolve a selector to an absolute scroll offset, honouring scroll-margin. */
function offsetFor(target: string): number | null {
  const element = document.querySelector(target);
  if (!element) return null;
  const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return element.getBoundingClientRect().top + window.scrollY - margin;
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [hash, setHash] = useState("");
  const lastY = useRef(0);

  // The studio and lab tools keep native scrolling: they have code panels and
  // long diagnostic lists that should not be hijacked.
  const enabled = pathname === "/" || pathname === "/" + "read" || pathname.startsWith("/read/");

  useEffect(() => {
    if (!enabled) {
      setLenis(null);
      setHidden(false);
      setScrolled(false);
      setScrollY(0);
      return;
    }

    const instance = new Lenis({
      autoRaf: true,
      // Anchors are handled here so the target is measured after the layout
      // settles rather than before it.
      anchors: false,
      lerp: 0.11,
      wheelMultiplier: 1,
      smoothWheel: true,
      overscroll: false,
      // Let panels that scroll on their own keep native scrolling.
      prevent: (node) =>
        node instanceof HTMLElement && node.hasAttribute("data-lenis-prevent"),
    });

    const onScroll = (event: Lenis) => {
      const y = event.animatedScroll;
      const delta = y - lastY.current;
      setScrollY(y);
      setScrolled(y > 24);
      if (Math.abs(delta) < DIRECTION_EPSILON) return;
      lastY.current = y;
      setHidden(y > HIDE_AFTER && delta > 0);
    };

    const onAnchorClick = (event: MouseEvent) => {
      const origin = event.target as HTMLElement | null;
      const link = origin?.closest?.("a[href^='#']");
      const href = link?.getAttribute("href");
      if (!href || href === "#") return;
      const y = offsetFor(href);
      if (y === null) return;
      event.preventDefault();
      instance.scrollTo(y, { duration: 1.1 });
      window.history.replaceState(null, "", href);
      setHash(href);
    };

    instance.on("scroll", onScroll);
    document.addEventListener("click", onAnchorClick);
    setLenis(instance);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      instance.off("scroll", onScroll);
      instance.destroy();
      setLenis(null);
    };
  }, [enabled]);

  // Keep the current hash in state so a jump can be corrected as the page
  // settles: the browser jumps before the layout is final, so it lands short.
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  useEffect(() => {
    if (!lenis || !hash) return;

    const anchor = () => {
      const y = offsetFor(hash);
      if (y === null) return;
      // Never pull the reader back once they have moved on.
      if (Math.abs(window.scrollY - y) > ANCHOR_TOLERANCE) return;
      lenis.scrollTo(y, { immediate: true });
    };

    const timers = [0, 150, 600, 1400].map((delay) =>
      window.setTimeout(anchor, delay),
    );
    const observer = new ResizeObserver(() => anchor());
    observer.observe(document.body);

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [lenis, hash]);

  const value = useMemo<SmoothScrollValue>(
    () => ({
      lenis,
      hidden,
      scrolled,
      scrollY,
      scrollTo: (target, options) => {
        const y = typeof target === "string" ? offsetFor(target) : target;
        if (y === null) return;
        if (lenis) {
          lenis.scrollTo(y, options);
          return;
        }
        window.scrollTo({ top: y, behavior: "smooth" });
      },
    }),
    [lenis, hidden, scrolled, scrollY],
  );

  return (
    <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>
  );
}

/** Access the shared scroll instance and header state. */
export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}
