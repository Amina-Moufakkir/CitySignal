"use client";

/**
 * Where you are, and how much is left.
 *
 * A segmented bar across the top - one segment per section, filled up to the one
 * being read - plus a dot rail on the right above 1024px using the same labels,
 * plus an arrow back to the top once the reader reaches the last section. All
 * three read the running order from `lib/sections.ts`, so none of them can drift
 * from the page: the arrow appears at whatever section is last, rather than at a
 * hardcoded "explore".
 *
 * Like the theme control and unlike everything else on the page, this is chrome
 * rather than content: without JavaScript it is absent, because a progress bar
 * that cannot track progress is worse than none. Nothing it does is required to
 * read the piece - the "next" links under each section are plain anchors that
 * work regardless. That is also why the arrow may start hidden in CSS: it exists
 * only when this component runs, so there is no state where the stylesheet hides
 * something a reader without JavaScript needed.
 *
 * Scroll is never driven or blocked. The observer reads; the anchors are native,
 * so the arrow inherits the stylesheet's smooth scrolling and, under
 * `prefers-reduced-motion`, its instant jump.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { SECTIONS, type SectionId } from "@/lib/sections";

/** The end of the piece, wherever the running order happens to put it. */
const LAST_INDEX = SECTIONS.length - 1;

/**
 * The width at which a full label clears the article. It has to agree with the
 * `@media (min-width: 104rem)` block that paints the label in globals.css: below
 * it the label is not rendered, so there is nothing to position and the geometry
 * is not read at all.
 */
const LABEL_SHOWN = "(min-width: 104rem)";

/**
 * The inset that defines the safe region: the label is shown only while the
 * eyebrow it names has its text centre this far inside the viewport, top and
 * bottom. Outside it there is no honest position to draw, so nothing is drawn.
 */
const SAFE_INSET = 24;

/**
 * Whether the label is currently pointing at something.
 *
 * An explicit state on the element rather than a position the stylesheet has to
 * interpret: `data-aligned="false"` is the resting value in the markup too, so
 * the label is absent until a measurement says otherwise and there is no frame
 * where it appears somewhere arbitrary. Written only on a change, so a long
 * scroll through a section with no eyebrow on screen touches the DOM once.
 */
function setAligned(marker: HTMLElement, aligned: boolean) {
  const next = aligned ? "true" : "false";

  if (marker.dataset.aligned !== next) {
    marker.dataset.aligned = next;
  }
}

export function ReadingNav() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const markerRef = useRef<HTMLDivElement | null>(null);
  /*
   * The active index and the per-section eyebrow lines are held in refs rather
   * than in state because placing the label is a write to one custom property,
   * not a render: nothing about the tree changes as the reader scrolls through a
   * section, only where that one element sits.
   */
  const activeRef = useRef<number | null>(null);
  const eyebrowsRef = useRef<(HTMLElement | null)[]>([]);
  const mediaRef = useRef<MediaQueryList | null>(null);

  /**
   * Put the label on the active section's eyebrow line, or take it away.
   *
   * One rule for every section: the centre of the label's line box meets the
   * centre of the eyebrow's. The target is the eyebrow's own text span rather
   * than the `.eyebrow` box, because that box starts at the 2px rule above it
   * and its centre therefore sits above the words - matching box centres would
   * put every label a few pixels high.
   *
   * The label points at a line. Once that line has left the viewport there is no
   * line to point at, so the label goes rather than parking at the edge: a label
   * pinned to the top of the screen still looks like it is naming something up
   * there, and it is naming a heading the reader scrolled past. Absence is the
   * honest state, and the dots carry the position on their own until the next
   * eyebrow arrives.
   */
  const placeMarker = useCallback(() => {
    const marker = markerRef.current;
    const index = activeRef.current;

    if (marker === null || index === null) {
      return;
    }

    mediaRef.current ??= window.matchMedia(LABEL_SHOWN);

    const eyebrow = mediaRef.current.matches ? eyebrowsRef.current[index] : null;

    if (!eyebrow) {
      setAligned(marker, false);

      return;
    }

    const line = eyebrow.getBoundingClientRect();
    const half = marker.offsetHeight / 2;
    const centre = line.top + line.height / 2;

    // A tall section scrolls its eyebrow off the top long before it stops being
    // the section being read. That is the window with no label in it.
    if (centre < SAFE_INSET + half || centre > window.innerHeight - SAFE_INSET - half) {
      setAligned(marker, false);

      return;
    }

    const next = `${Math.round(centre * 10) / 10}px`;

    // The position is set before the label is shown, so a label coming back into
    // range fades in where it belongs rather than travelling there.
    if (marker.style.getPropertyValue("--rail-marker-y") !== next) {
      marker.style.setProperty("--rail-marker-y", next);
    }

    setAligned(marker, true);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const elements = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    );

    if (elements.length === 0) {
      return;
    }

    // Indexed alongside `elements`, so whatever `update` decides is active is
    // the same row in both.
    eyebrowsRef.current = elements.map((element) => {
      const eyebrow = element.querySelector<HTMLElement>(".eyebrow");

      return eyebrow?.querySelector<HTMLElement>(":scope > span:last-child") ?? eyebrow;
    });

    // The active section is the last one whose top has passed the reading line,
    // which is steadier than "whichever is most visible" when a tall section and
    // a short one are on screen together.
    const READING_LINE = 0.35;

    const update = () => {
      const line = window.innerHeight * READING_LINE;
      let current = 0;

      elements.forEach((element, index) => {
        if (element.getBoundingClientRect().top <= line) {
          current = index;
        }
      });

      setActiveIndex(current);
      activeRef.current = current;
      // Placed from the same pass that decided the active section: the observer,
      // the scroll callback and the resize callback all arrive here, so the label
      // needs no listener of its own.
      placeMarker();
    };

    const observer = new IntersectionObserver(update, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    for (const element of elements) {
      observer.observe(element);
    }

    let frame = 0;
    const onScroll = () => {
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    /*
     * The section entrance moves the eyebrow after the reader has stopped.
     *
     * `.reveal-pending` holds a section 14px low and `.reveal-in` releases it
     * over 520ms. Arriving at a heading and stopping to read is the ordinary
     * case, and it lands the label 14px below the words: it was placed from the
     * translated rect, and no scroll follows to correct it. So the end of that
     * transform is a geometry change like any other, and the label is placed
     * again from the settled position. It is not a scroll listener and it does
     * not fire while scrolling - only when an entrance finishes.
     */
    const article = elements[0].closest("article");
    const onRevealed = (event: TransitionEvent) => {
      if (event.propertyName === "transform" && (event.target as HTMLElement).matches?.(".reveal")) {
        update();
      }
    };

    article?.addEventListener("transitionend", onRevealed);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    return () => {
      observer.disconnect();
      article?.removeEventListener("transitionend", onRevealed);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [placeMarker]);

  /*
   * The first pass runs before the label exists - nothing is rendered until a
   * section is active - so the label is placed again once it is in the tree, and
   * again whenever the active section changes.
   */
  useEffect(() => {
    placeMarker();
  }, [activeIndex, placeMarker]);

  /*
   * A display face that arrives after first paint re-flows the eyebrow, which
   * moves the line the label is sitting on. One promise, resolved once; not a
   * listener, and not a loop.
   */
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      return;
    }

    let live = true;

    void document.fonts.ready.then(() => {
      if (live) {
        placeMarker();
      }
    });

    return () => {
      live = false;
    };
  }, [placeMarker]);

  if (activeIndex === null) {
    return null;
  }

  const active: SectionId = SECTIONS[activeIndex].id;

  return (
    <>
      <div className="progress" aria-hidden="true">
        {SECTIONS.map((section, index) => (
          <span
            key={section.id}
            className={index <= activeIndex ? "progress-segment progress-segment-done" : "progress-segment"}
          />
        ))}
      </div>

      <nav className="rail" aria-label="Sections">
        <ol>
          {SECTIONS.map((section, index) => (
            <li key={section.id} className={index === activeIndex ? "rail-item rail-item-active" : "rail-item"}>
              <a href={`#${section.id}`} aria-current={section.id === active ? "true" : undefined}>
                <span className="rail-label">{section.eyebrow}</span>
                <span className="rail-dot" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/*
        The rail's pointer at the section it names, outside the rail on purpose.

        `.rail` is centred with a transform, and a transform makes a containing
        block, so a `position: fixed` child of it would be positioned against the
        rail rather than against the viewport - it would inherit exactly the
        geometry this is trying to escape. As a sibling it is free to sit on the
        active section's line while the dots stay where they are.

        `aria-hidden` because it is a second rendering of the active link's own
        text. The navigation's accessible names are the ones inside the rail, and
        this must not add a fifteenth.
      */}
      <div className="rail-marker" ref={markerRef} data-aligned="false" aria-hidden="true">
        {SECTIONS[activeIndex].eyebrow}
      </div>

      {/*
        A plain anchor, not a scripted scroll: #main is the top of the document,
        so this works the same way the "next" links do and moves focus with it.
        Hidden rather than unmounted so that arriving at the last section is a
        transition rather than a pop.
      */}
      <a
        className={activeIndex === LAST_INDEX ? "to-top to-top-shown" : "to-top"}
        href="#main"
        title="Back to the top"
        aria-label="Back to the top of the piece"
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          focusable={false}
        >
          <path d="M12 19.4V5.4M5.4 12 12 5.4l6.6 6.6" />
        </svg>
      </a>
    </>
  );
}
