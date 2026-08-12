"use client";

/**
 * Theme control: a single button that cycles system → light → dark → system.
 *
 * One target rather than three. System stays in the cycle rather than being
 * dropped for a binary switch, because a reader whose OS follows daylight should
 * be able to keep that; the icon shows which of the three is active, so the state
 * is still legible from one glyph.
 *
 * Two details matter more than the control itself:
 *
 * 1. No flash. An inline script in the document head stamps `data-theme` before
 *    first paint (see app/layout.tsx). Applying the stored choice from React
 *    instead would paint the wrong palette first and correct it after hydration.
 *
 * 2. This is a control, not content, so unlike everything else on the page it is
 *    absent without JavaScript rather than present. Rendering a dead button that
 *    cannot do anything would be worse than rendering nothing.
 *
 * A cycling button hides its next state, so the accessible name carries both:
 * what is active now and what pressing will do. The change is also announced,
 * since the icon alone is silent.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "citysignal-theme";

export type ThemeChoice = "system" | "light" | "dark";

/** Cycle order. Each entry names itself and what choosing the next one means. */
const ORDER: ThemeChoice[] = ["system", "light", "dark"];

const DESCRIPTION: Record<ThemeChoice, string> = {
  system: "following your system",
  light: "light",
  dark: "dark",
};

function nextChoice(current: ThemeChoice): ThemeChoice {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;

  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }

  try {
    if (choice === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The attribute
    // still applies for this page view; only persistence is lost.
  }
}

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const shared = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (choice === "light") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
      </svg>
    );
  }

  if (choice === "dark") {
    return (
      <svg {...shared}>
        <path d="M20.5 13.4A8.6 8.6 0 1 1 10.6 3.5a6.8 6.8 0 0 0 9.9 9.9Z" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <rect x="3" y="4.2" width="18" height="12.4" rx="2.2" />
      <path d="M9 20.4h6M12 16.6v3.8" />
    </svg>
  );
}

export function ThemeToggle() {
  // Null until mounted: the server cannot know the stored choice, so rendering
  // nothing first avoids both a hydration mismatch and a wrong initial icon.
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-theme");
    setChoice(stamped === "light" || stamped === "dark" ? stamped : "system");
  }, []);

  if (choice === null) {
    return null;
  }

  const upcoming = nextChoice(choice);

  return (
    <div className="theme-toggle">
      <button
        type="button"
        className="theme-button"
        title={`Theme: ${DESCRIPTION[choice]}. Switch to ${DESCRIPTION[upcoming]}.`}
        aria-label={`Theme: ${DESCRIPTION[choice]}. Switch to ${DESCRIPTION[upcoming]}.`}
        onClick={() => {
          setChoice(upcoming);
          applyChoice(upcoming);
        }}
      >
        <ThemeIcon choice={choice} />
      </button>
      {/* The icon is silent, so the change is announced separately. */}
      <span className="visually-hidden" role="status">
        Theme: {DESCRIPTION[choice]}
      </span>
    </div>
  );
}
