import type { ReactNode } from "react";

import { nextSection, sectionMeta, type SectionId } from "@/lib/sections";

/**
 * One section, one claim.
 *
 * The shell owns the landmark, the heading level, the measure, and the link to
 * whatever comes next. The eyebrow comes from the running order in
 * `lib/sections.ts` rather than being repeated here, so the dot rail and the
 * page cannot label the same section differently.
 */
export function Section({
  id,
  title,
  children,
  wide = false,
  lead = false,
}: {
  id: SectionId;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** The opening section carries the page's only h1. */
  lead?: boolean;
}) {
  const meta = sectionMeta(id);
  const next = nextSection(id);
  const Heading = lead ? "h1" : "h2";
  const className = [
    "section",
    wide ? "section-wide" : "",
    meta.viewportHeight ? "section-tall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={className}>
      <p className="eyebrow">{meta.eyebrow}</p>
      <Heading id={`${id}-title`}>{title}</Heading>
      {children}
      {next && (
        <p className="next-link">
          <a href={`#${next.id}`}>
            <span className="next-link-label">Next</span>
            <span className="next-link-title">{next.navLabel}</span>
            <span aria-hidden="true"> ↓</span>
          </a>
        </p>
      )}
    </section>
  );
}

/** A boundary on what the evidence supports. Never trimmed for pacing. */
export function Boundary({ children }: { children: ReactNode }) {
  return <p className="boundary">{children}</p>;
}

/** Where a figure came from. A citation, in the same voice as any other. */
export function SourceLine({ children }: { children: ReactNode }) {
  return <p className="source-line">{children}</p>;
}

/**
 * Detail that belongs under the chart rather than above it: caveats, method
 * notes, provenance. Same content as before, less weight.
 */
export function Secondary({ children }: { children: ReactNode }) {
  return <p className="secondary">{children}</p>;
}

/**
 * The number a section is about, set at display scale rather than as bold body
 * text. One per section at most - a page of hero figures has none.
 */
export function KeyFigure({ value, children }: { value: string; children: ReactNode }) {
  return (
    <p className="key-figure">
      <span className="key-figure-value">{value}</span>
      <span className="key-figure-caption">{children}</span>
    </p>
  );
}

/** A line lifted out of the flow, at reading scale rather than display scale. */
export function PullQuote({ children }: { children: ReactNode }) {
  return <p className="pull-quote">{children}</p>;
}

export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p className="status" role="status">
      {children}
    </p>
  );
}
