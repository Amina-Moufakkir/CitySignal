"use client";

/**
 * Where you are, and how much is left.
 *
 * A segmented bar across the top - one segment per section, filled up to the one
 * being read - plus a dot rail on the right above 1024px using the same labels.
 * Both read the running order from `lib/sections.ts`, so neither can drift from
 * the page.
 *
 * Like the theme control and unlike everything else on the page, this is chrome
 * rather than content: without JavaScript it is absent, because a progress bar
 * that cannot track progress is worse than none. Nothing it does is required to
 * read the piece - the "next" links under each section are plain anchors that
 * work regardless.
 *
 * Scroll is never driven or blocked. The observer reads; the anchors are native.
 */

import { useEffect, useState } from "react";

import { SECTIONS, type SectionId } from "@/lib/sections";

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
    </>
  );
}
