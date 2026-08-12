/**
 * Static, committed datasets.
 *
 * Everything in this file was produced by a Phase 3 analysis that is not itself
 * committed to this repository. The values are recorded here verbatim from the
 * original static build (`legacy/app.js`) so they remain auditable, and each
 * carries the provenance needed to say plainly where it came from.
 */

export type BoardRow = {
  board: string;
  occupiedHouseholds: number;
  saturdayNightComplaints: number;
};

export type DatasetProvenance = {
  /** What the complaint counts actually count. */
  descriptor: string;
  /** Where the denominator came from. */
  denominatorSource: string;
  /** The complaint period the counts cover. */
  complaintPeriod: string;
  /** When the extract was taken. Null when it was never recorded. */
  extractedOn: string | null;
  /** The known boundary caveat, surfaced in the UI rather than buried. */
  limitation: string;
};

export type BoardDataset = {
  metadata: DatasetProvenance;
  rows: readonly BoardRow[];
};

export const PHASE3_BOARD_DATASET: BoardDataset = {
  metadata: {
    descriptor: "Loud Music/Party complaints, Saturday nights only",
    denominatorSource: "2024 ACS 5-year estimates aggregated to DCP CDTAs",
    complaintPeriod: "2024-01-01 through 2024-12-29",
    extractedOn: null,
    limitation:
      "CDTAs approximate, but are not identical to, legal community-district boundaries, so the complaint numerator and the household denominator are drawn on slightly different geographies.",
  },
  rows: [
    { board: "BK01", occupiedHouseholds: 85708, saturdayNightComplaints: 1256 },
    { board: "BK02", occupiedHouseholds: 61250, saturdayNightComplaints: 355 },
    { board: "BK03", occupiedHouseholds: 71580, saturdayNightComplaints: 1042 },
    { board: "BK04", occupiedHouseholds: 45491, saturdayNightComplaints: 1394 },
    { board: "BK05", occupiedHouseholds: 71948, saturdayNightComplaints: 1128 },
    { board: "BK06", occupiedHouseholds: 52116, saturdayNightComplaints: 240 },
    { board: "BK07", occupiedHouseholds: 41131, saturdayNightComplaints: 313 },
    { board: "BK08", occupiedHouseholds: 48537, saturdayNightComplaints: 407 },
    { board: "BK09", occupiedHouseholds: 40499, saturdayNightComplaints: 398 },
    { board: "BK10", occupiedHouseholds: 49275, saturdayNightComplaints: 239 },
    { board: "BK11", occupiedHouseholds: 62339, saturdayNightComplaints: 278 },
    { board: "BK12", occupiedHouseholds: 55111, saturdayNightComplaints: 279 },
    { board: "BK13", occupiedHouseholds: 46711, saturdayNightComplaints: 262 },
    { board: "BK14", occupiedHouseholds: 59557, saturdayNightComplaints: 400 },
    { board: "BK15", occupiedHouseholds: 58709, saturdayNightComplaints: 261 },
    { board: "BK16", occupiedHouseholds: 37597, saturdayNightComplaints: 448 },
    { board: "BK17", occupiedHouseholds: 58588, saturdayNightComplaints: 672 },
    { board: "BK18", occupiedHouseholds: 63771, saturdayNightComplaints: 572 },
  ],
};

/**
 * Where a figure comes from. Rendered as a sourcing line, in the same voice as
 * any other citation - this is provenance, not a warning.
 */
export type Source = "committed" | "phase-2-3";

export const SOURCE_LABELS: Record<Source, string> = {
  committed: "Computed from data in this repository",
  "phase-2-3": "From Phase 2-3 analysis - see Method",
};

/**
 * The four pre-registered hypotheses that did not survive.
 *
 * Each states what was predicted before the data was examined and what the data
 * returned. Three were computed in Phase 3 analyses that are not committed here;
 * the first is derivable from `PHASE3_BOARD_DATASET` and is recomputed at
 * runtime rather than quoted.
 */
export type FailedHypothesis = {
  id: string;
  /** What was predicted, stated before looking. */
  prediction: string;
  /** What the data returned. */
  outcome: string;
  /** Why the prediction was worth making. */
  rationale: string;
  /** Headline figure, primary period. Null when the figure is computed live. */
  primary: string | null;
  /** Headline figure, stress period. */
  stress: string | null;
  source: Source;
};

export const FAILED_HYPOTHESES: readonly FailedHypothesis[] = [
  {
    id: "concentration",
    prediction:
      "If Saturday-night reporting were driven by a few hotspots, the three highest-count community boards would account for at least 40% of it.",
    outcome:
      "They accounted for less than that, and the reporting was spread across many boards rather than dominated by three.",
    rationale:
      "A concentrated pattern would point somewhere specific. A distributed one does not.",
    primary: null,
    stress: "37.7%",
    source: "committed",
  },
  {
    id: "density",
    prediction:
      "If the pattern were an artefact of how many people live close together, residential density would explain most of the variation in normalized complaint rates.",
    outcome:
      "Density showed only a weak association with normalized rates, and did not account for BK04.",
    rationale:
      "More households per acre means more neighbours within earshot, and more people positioned to file a report.",
    primary: "weak association",
    stress: null,
    source: "phase-2-3",
  },
  {
    id: "nightlife",
    prediction:
      "If nightlife drove the pattern, current on-premises alcohol-license exposure would track normalized complaint rates.",
    outcome:
      "The relationship was very weak, and did not account for BK04.",
    rationale:
      "Bars and venues concentrate late-night activity, and the pattern is a late-night one.",
    primary: "very weak relationship",
    stress: null,
    source: "phase-2-3",
  },
  {
    id: "repeat-locations",
    prediction:
      "If a small number of addresses generated the pattern, the ten most-reported tax lots would account for a large share of BK04's complaints.",
    outcome:
      "The top ten lots accounted for a small fraction, and most lots that appeared did so on a single Saturday night.",
    rationale:
      "A handful of repeatedly-reported buildings would be a different phenomenon from a broad one.",
    primary: "10.4%",
    stress: "8.4%",
    source: "phase-2-3",
  },
];

/** Share of valid tax lots appearing on exactly one Saturday night, Phase 3. */
export const SINGLE_NIGHT_LOCATION_SHARE = "78-81%";
