/**
 * The running order, as data.
 *
 * The progress bar, the dot rail, the "next" links and each section's eyebrow all
 * read from this list, so they cannot disagree about what the piece contains or
 * what order it is in. Adding a section here and rendering it is the whole job.
 *
 * `navLabel` is deliberately separate from the on-page heading: some headings are
 * computed from live data and would make an unstable link label.
 */

export type SectionId =
  | "hook"
  | "guess"
  | "citywide"
  | "borough"
  | "casestudy"
  | "corpus"
  | "rhythm"
  | "reveal"
  | "nights"
  | "saturday"
  | "everynight"
  | "parties"
  | "where"
  | "persistence"
  | "failed"
  | "boundaries";

export type SectionMeta = {
  id: SectionId;
  /** Shown above the heading, and on the dot rail. */
  eyebrow: string;
  /** Stable label for the link that points here. */
  navLabel: string;
  /**
   * Whether the section is one of the graphic-led ones that claims at least a
   * viewport on desktop. The opening, the closing and the method section are
   * prose and are left to their natural height.
   */
  viewportHeight: boolean;
};

export const SECTIONS: readonly SectionMeta[] = [
  { id: "hook", eyebrow: "CitySignal", navLabel: "Where is New York loud?", viewportHeight: false },
  {
    id: "guess",
    eyebrow: "Before the answer",
    navLabel: "Which borough rises most?",
    viewportHeight: false,
  },
  {
    id: "citywide",
    eyebrow: "All five boroughs",
    navLabel: "The weekend rise, city-wide",
    viewportHeight: true,
  },
  {
    id: "borough",
    eyebrow: "Your borough",
    navLabel: "Pick one and look closer",
    viewportHeight: false,
  },
  {
    id: "casestudy",
    eyebrow: "Why Brooklyn next",
    navLabel: "Why the rest is Brooklyn",
    viewportHeight: false,
  },
  {
    id: "corpus",
    eyebrow: "The raw material",
    navLabel: "Every day of the year",
    viewportHeight: true,
  },
  {
    id: "rhythm",
    eyebrow: "The same chart",
    navLabel: "Now colour the weekends",
    viewportHeight: true,
  },
  { id: "reveal", eyebrow: "The answer", navLabel: "The weekend gap, exactly", viewportHeight: true },
  {
    id: "nights",
    eyebrow: "Narrowing",
    navLabel: "It is not days. It is nights.",
    viewportHeight: true,
  },
  {
    id: "saturday",
    eyebrow: "Narrowing further",
    navLabel: "And not every night.",
    viewportHeight: true,
  },
  {
    id: "everynight",
    eyebrow: "Not a few nights",
    navLabel: "Every Saturday, not a few",
    viewportHeight: true,
  },
  {
    id: "parties",
    eyebrow: "The last cut",
    navLabel: "And not every kind of noise.",
    viewportHeight: true,
  },
  {
    id: "where",
    eyebrow: "The obvious next question",
    navLabel: "So where?",
    viewportHeight: true,
  },
  {
    id: "persistence",
    eyebrow: "Does it hold?",
    navLabel: "A different year, same shape",
    viewportHeight: true,
  },
  {
    id: "failed",
    eyebrow: "Four predictions",
    navLabel: "Then the explanations ran out.",
    viewportHeight: false,
  },
  {
    id: "boundaries",
    eyebrow: "The fine print, promoted",
    navLabel: "What this does and does not establish",
    viewportHeight: false,
  },
];

const BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

export function sectionMeta(id: SectionId): SectionMeta {
  const meta = BY_ID.get(id);

  if (meta === undefined) {
    throw new Error(`Unknown section: ${id}`);
  }

  return meta;
}

/** The section after this one, or null at the end of the piece. */
export function nextSection(id: SectionId): SectionMeta | null {
  const index = SECTIONS.findIndex((section) => section.id === id);

  return index >= 0 && index < SECTIONS.length - 1 ? SECTIONS[index + 1] : null;
}
