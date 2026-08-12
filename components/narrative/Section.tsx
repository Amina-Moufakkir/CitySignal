import type { ReactNode } from "react";

/**
 * One section, one claim. The shell owns the landmark, the heading level, and
 * the measure; sections own their copy.
 */
export function Section({
  id,
  eyebrow,
  title,
  children,
  wide = false,
  lead = false,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** The opening section carries the page's only h1. */
  lead?: boolean;
}) {
  const Heading = lead ? "h1" : "h2";

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={wide ? "section section-wide" : "section"}>
      <p className="eyebrow">{eyebrow}</p>
      <Heading id={`${id}-title`}>{title}</Heading>
      {children}
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

export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p className="status" role="status">
      {children}
    </p>
  );
}
