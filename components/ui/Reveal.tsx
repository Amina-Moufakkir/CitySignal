"use client";

/**
 * Section entrance, as an enhancement that can only ever be additive.
 *
 * The usual implementation puts `opacity: 0` in the stylesheet and lets
 * JavaScript raise it. That makes the whole page blank without scripting, and it
 * is the single most common way a scrollytelling piece becomes unreadable.
 *
 * This does the opposite. The server renders every section visible and the
 * stylesheet leaves it visible. Only after mount does JavaScript add the
 * `reveal-pending` class, and only to sections still below the fold - so nothing
 * already on screen ever flashes out and back in. With scripting off, without
 * IntersectionObserver, under reduced motion, or if the effect throws, no class
 * is ever added and the page is simply complete.
 *
 * The sweep is the important part. An IntersectionObserver only reports
 * threshold crossings, so a section that is *jumped over* - find-in-page, the
 * End key, an anchor link, restored scroll - never fires a callback and would
 * stay hidden forever. That is exactly the failure the brief forbids: an effect
 * gating content. So every callback, and every settled scroll, sweeps the whole
 * pending set and reveals anything that has reached the fold. A section cannot
 * be on screen and hidden at the same time.
 *
 * Scroll is never driven, blocked, or hijacked: the listener is passive, throttled
 * to a frame, and only reads.
 */

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Begin the entrance slightly before a section reaches the bottom edge. The
 * mount check uses the same fraction, so there is no band where a section is
 * hidden at mount but not yet eligible to be revealed.
 */
const REVEAL_FRACTION = 0.9;
const ROOT_MARGIN = `0px 0px -${(1 - REVEAL_FRACTION) * 100}% 0px`;

const pending = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;
let scrollBound = false;
let frame = 0;

function reveal(element: HTMLElement): void {
  element.classList.add("reveal-in");
  pending.delete(element);
  observer?.unobserve(element);
}

/** Reveal every pending section that has reached the fold, however it got there. */
function sweep(): void {
  if (pending.size === 0) {
    return;
  }

  const fold = window.innerHeight * REVEAL_FRACTION;

  for (const element of [...pending]) {
    if (element.getBoundingClientRect().top < fold) {
      reveal(element);
    }
  }

  if (pending.size === 0) {
    teardown();
  }
}

function onScroll(): void {
  if (frame !== 0) {
    return;
  }

  frame = window.requestAnimationFrame(() => {
    frame = 0;
    sweep();
  });
}

function teardown(): void {
  observer?.disconnect();
  observer = null;

  if (scrollBound) {
    window.removeEventListener("scroll", onScroll);
    scrollBound = false;
  }

  if (frame !== 0) {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }
}

function watch(element: HTMLElement): void {
  pending.add(element);

  if (observer === null) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
          }
        }

        // Catches anything the crossings missed.
        sweep();
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );
  }

  if (!scrollBound) {
    window.addEventListener("scroll", onScroll, { passive: true });
    scrollBound = true;
  }

  observer.observe(element);
}

export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    try {
      if (
        typeof IntersectionObserver === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      if (element.getBoundingClientRect().top < window.innerHeight * REVEAL_FRACTION) {
        return;
      }

      element.classList.add("reveal-pending");
      watch(element);
    } catch {
      // Anything unexpected leaves the section exactly as the server sent it.
      element.classList.remove("reveal-pending");
    }

    return () => {
      pending.delete(element);
      observer?.unobserve(element);
    };
  }, []);

  return (
    <div className="reveal" ref={ref}>
      {children}
    </div>
  );
}
