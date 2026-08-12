"use client";

/**
 * Theme control: system, light, or dark.
 *
 * System is the default and stays a real option rather than being collapsed into
 * a two-way switch - a reader whose OS follows daylight should be able to keep
 * that, and a binary toggle quietly takes it away.
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
 * Native radio inputs carry the keyboard behaviour - arrow keys move within the
 * group, the group is one tab stop - which hand-rolled `role="radio"` buttons
 * only get with a roving tabindex.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "citysignal-theme";

export type ThemeChoice = "system" | "light" | "dark";

const CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;

  try {
    if (choice === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", choice);
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The attribute
    // still applies for this page view; only persistence is lost.
    if (choice === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", choice);
    }
  }
}

export function ThemeToggle() {
  // Null until mounted: the server cannot know the stored choice, so rendering
  // nothing first avoids a hydration mismatch and a wrongly-checked radio.
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-theme");
    setChoice(stamped === "light" || stamped === "dark" ? stamped : "system");
  }, []);

  if (choice === null) {
    return null;
  }

  return (
    <div className="theme-toggle">
      <span className="theme-toggle-label" id="theme-toggle-label">
        Theme
      </span>
      <fieldset className="theme-options">
        <legend className="visually-hidden">Colour theme</legend>
        {CHOICES.map((option) => (
          <div className="theme-option" key={option.value}>
            <input
              type="radio"
              id={`theme-${option.value}`}
              name="theme"
              value={option.value}
              checked={choice === option.value}
              onChange={() => {
                setChoice(option.value);
                applyChoice(option.value);
              }}
            />
            <label htmlFor={`theme-${option.value}`}>{option.label}</label>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
