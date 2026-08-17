"use client";

/**
 * Where you are, and how much is left.
 *
 * Three things, deliberately in three places:
 *
 *   - the top chrome carries the active section's *name*, as status;
 *   - the dot rail on the right carries reading position and the links;
 *   - the eyebrow inside each section carries identity in the page itself.
 *
 * The name used to hang off the rail and align with the active section's
 * eyebrow. That made it an annotation pointing at a heading, which cost it a
 * gutter carved out of the article to sit in, and cost the reader the name
 * itself the moment the heading scrolled away. A reader who wants to know what
 * they are reading should not have to scroll back to a heading to find out. It
 * is status, so it sits in the chrome and stays put until the section changes.
 *
 * Everything here reads from the running order in `lib/sections.ts`, so the
 * header, the rail and the arrow cannot drift from the page: the arrow appears
 * at whatever section is last, rather than at a hardcoded "explore".
 *
 * Like the theme control and unlike everything else on the page, this is chrome
 * rather than content: without JavaScript it is absent, because a progress bar
 * that cannot track progress is worse than none. Nothing it does is required to
 * read the piece - the "next" links under each section are plain anchors that
 * work regardless.
 *
 * Scroll is never driven or blocked. The observer reads; the anchors are native,
 * so the arrow inherits the stylesheet's smooth scrolling and, under
 * `prefers-reduced-motion`, its instant jump.
 */

import { useEffect, useState } from "react";

import { SECTIONS, type SectionId } from "@/lib/sections";

/** The end of the piece, wherever the running order happens to put it. */
const LAST_INDEX = SECTIONS.length - 1;

export function ReadingNav() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  if (activeIndex === null) {
    return null;
  }

  const active: SectionId = SECTIONS[activeIndex].id;

  return (
    <>
      <div className="chrome">
        <div className="progress" aria-hidden="true">
          {SECTIONS.map((section, index) => (
            <span
              key={section.id}
              className={index <= activeIndex ? "progress-segment progress-segment-done" : "progress-segment"}
            />
          ))}
        </div>

        {/*
          `aria-hidden` because the rail below already exposes the active section
          through `aria-current`, and a screen reader should hear that once. This
          is the sighted reader's copy of the same fact.
        */}
        <p className="chrome-section" aria-hidden="true">
          {SECTIONS[activeIndex].eyebrow}
        </p>
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
